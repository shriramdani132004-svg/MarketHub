import { Prisma } from '../../src/generated/prisma/client';
import {
  addMoney,
  aggregateOrderStatus,
  canTransitionSellerOrder,
  decimal,
  FREE_SHIPPING_THRESHOLD,
  money,
  moneyNumber,
  orderTimeline,
  shippingForSubtotal,
  STANDARD_SHIPPING,
  ZERO,
} from '../../src/common/utils/money.util';

describe('money utilities', () => {
  describe('decimal and formatting', () => {
    it('parses strings without floating point drift', () => {
      expect(decimal('0.1').plus(decimal('0.2')).toFixed(2)).toBe('0.30');
      expect(decimal('1234.567').toFixed(2)).toBe('1234.57');
    });

    it('formats money with exactly two decimal places', () => {
      expect(money(decimal('999'))).toBe('999.00');
      expect(money(decimal('0'))).toBe('0.00');
    });

    it('converts to a number rounded to two decimals', () => {
      expect(moneyNumber(decimal('1499.999'))).toBe(1500);
      expect(moneyNumber(ZERO)).toBe(0);
    });
  });

  describe('addMoney', () => {
    it('returns zero with no arguments', () => {
      expect(addMoney().equals(ZERO)).toBe(true);
    });

    it('adds many values precisely', () => {
      const total = addMoney(decimal('10.10'), decimal('20.20'), decimal('30.30'));
      expect(money(total)).toBe('60.60');
    });
  });

  describe('shippingForSubtotal', () => {
    it('charges standard shipping below the free threshold', () => {
      expect(shippingForSubtotal(decimal('998.99')).equals(STANDARD_SHIPPING)).toBe(true);
      expect(money(shippingForSubtotal(decimal('0')))).toBe('49.00');
    });

    it('is free at and above the threshold', () => {
      expect(shippingForSubtotal(FREE_SHIPPING_THRESHOLD).equals(ZERO)).toBe(true);
      expect(shippingForSubtotal(decimal('5000')).equals(ZERO)).toBe(true);
    });
  });

  describe('canTransitionSellerOrder', () => {
    it('allows only the forward fulfilment path', () => {
      expect(canTransitionSellerOrder('PAID', 'PROCESSING')).toBe(true);
      expect(canTransitionSellerOrder('PROCESSING', 'SHIPPED')).toBe(true);
      expect(canTransitionSellerOrder('SHIPPED', 'DELIVERED')).toBe(true);
    });

    it('rejects skipping, reversing and terminal states', () => {
      expect(canTransitionSellerOrder('PAID', 'SHIPPED')).toBe(false);
      expect(canTransitionSellerOrder('SHIPPED', 'PROCESSING')).toBe(false);
      expect(canTransitionSellerOrder('DELIVERED', 'SHIPPED')).toBe(false);
      expect(canTransitionSellerOrder('CANCELLED', 'PAID')).toBe(false);
      expect(canTransitionSellerOrder('PENDING_PAYMENT', 'PAID')).toBe(false);
    });

    it('rejects unknown statuses', () => {
      expect(canTransitionSellerOrder('UNKNOWN', 'SHIPPED')).toBe(false);
    });
  });

  describe('aggregateOrderStatus', () => {
    it('keeps the current status when there are no seller groups', () => {
      expect(aggregateOrderStatus([], 'PAID')).toBe('PAID');
    });

    it('cancels only when every group is cancelled', () => {
      expect(aggregateOrderStatus(['CANCELLED', 'CANCELLED'], 'PAID')).toBe('CANCELLED');
      expect(aggregateOrderStatus(['CANCELLED', 'PAID'], 'PAID')).toBe('PAID');
    });

    it('detects full delivery', () => {
      expect(aggregateOrderStatus(['DELIVERED', 'DELIVERED'], 'SHIPPED')).toBe('DELIVERED');
    });

    it('detects partial delivery before partial shipment', () => {
      expect(aggregateOrderStatus(['DELIVERED', 'SHIPPED'], 'SHIPPED')).toBe(
        'PARTIALLY_DELIVERED',
      );
    });

    it('marks a mix of shipped and delivered as partially delivered', () => {
      expect(aggregateOrderStatus(['SHIPPED', 'DELIVERED'], 'PROCESSING')).toBe(
        'PARTIALLY_DELIVERED',
      );
      expect(aggregateOrderStatus(['SHIPPED', 'SHIPPED'], 'PROCESSING')).toBe('SHIPPED');
    });

    it('marks partially shipped when some groups shipped', () => {
      expect(aggregateOrderStatus(['SHIPPED', 'PROCESSING'], 'PAID')).toBe(
        'PARTIALLY_SHIPPED',
      );
    });

    it('marks processing when any group is being prepared', () => {
      expect(aggregateOrderStatus(['PROCESSING', 'PAID'], 'PAID')).toBe('PROCESSING');
    });

    it('cancels when remaining groups are unpaid or cancelled', () => {
      expect(aggregateOrderStatus(['CANCELLED', 'PENDING_PAYMENT'], 'PAID')).toBe(
        'CANCELLED',
      );
    });

    it('falls back to paid for groups awaiting fulfilment', () => {
      expect(aggregateOrderStatus(['PAID', 'PAID'], 'PENDING_PAYMENT')).toBe('PAID');
    });
  });

  describe('orderTimeline', () => {
    const createdAt = new Date('2026-01-01T10:00:00.000Z');

    it('always starts with order placement', () => {
      const timeline = orderTimeline({ createdAt, orderStatus: 'PENDING_PAYMENT' });
      expect(timeline).toEqual([
        {
          label: 'Order placed',
          status: 'PENDING_PAYMENT',
          at: createdAt.toISOString(),
        },
      ]);
    });

    it('sorts seller, payment and cancellation events chronologically', () => {
      const paidAt = new Date('2026-01-01T11:00:00.000Z');
      const shippedAt = new Date('2026-01-02T09:00:00.000Z');
      const deliveredAt = new Date('2026-01-03T09:00:00.000Z');
      const cancelledAt = new Date('2026-01-04T09:00:00.000Z');

      const timeline = orderTimeline({
        createdAt,
        paidAt,
        cancelledAt,
        orderStatus: 'CANCELLED',
        sellerOrders: [
          {
            status: 'DELIVERED',
            createdAt: new Date('2026-01-01T10:30:00.000Z'),
            shippedAt,
            deliveredAt,
          },
        ],
        payment: { status: 'REFUNDED', createdAt: paidAt },
      });

      expect(timeline.map((event) => event.status)).toEqual([
        'PENDING_PAYMENT',
        'PAID',
        'SHIPPED',
        'DELIVERED',
        'CANCELLED',
      ]);
      expect(timeline[4].at).toBe(cancelledAt.toISOString());
    });

    it('adds a preparation event for processing seller groups', () => {
      const preparedAt = new Date('2026-01-01T12:00:00.000Z');
      const timeline = orderTimeline({
        createdAt,
        orderStatus: 'PROCESSING',
        sellerOrders: [{ status: 'PROCESSING', createdAt: preparedAt }],
      });
      expect(timeline.some((event) => event.status === 'PROCESSING')).toBe(true);
    });

    it('does not mutate input dates', () => {
      const snapshot = createdAt.getTime();
      orderTimeline({ createdAt, orderStatus: 'PENDING_PAYMENT' });
      expect(createdAt.getTime()).toBe(snapshot);
    });
  });

  it('uses Decimal instances everywhere money is returned', () => {
    expect(shippingForSubtotal(decimal('10'))).toBeInstanceOf(Prisma.Decimal);
    expect(addMoney(decimal('1'))).toBeInstanceOf(Prisma.Decimal);
  });
});
