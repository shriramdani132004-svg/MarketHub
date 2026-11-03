import { Prisma } from '../../generated/prisma/client';

export type Money = Prisma.Decimal;

export const ZERO = new Prisma.Decimal(0);
export const FREE_SHIPPING_THRESHOLD = new Prisma.Decimal('999.00');
export const STANDARD_SHIPPING = new Prisma.Decimal('49.00');

export function decimal(value: string | number | Prisma.Decimal): Prisma.Decimal {
  return new Prisma.Decimal(value);
}

export function money(value: Prisma.Decimal): string {
  return value.toFixed(2);
}

export function moneyNumber(value: Prisma.Decimal): number {
  return Number(value.toFixed(2));
}

export function shippingForSubtotal(subtotal: Prisma.Decimal): Prisma.Decimal {
  if (subtotal.greaterThanOrEqualTo(FREE_SHIPPING_THRESHOLD)) return ZERO;
  return STANDARD_SHIPPING;
}

export function addMoney(...values: Prisma.Decimal[]): Prisma.Decimal {
  return values.reduce((total, value) => total.plus(value), ZERO);
}

export const ORDER_STATUS_VALUES = [
  'PENDING_PAYMENT',
  'PAID',
  'PROCESSING',
  'PARTIALLY_SHIPPED',
  'SHIPPED',
  'PARTIALLY_DELIVERED',
  'DELIVERED',
  'CANCELLED',
] as const;

export type OrderStatusValue = (typeof ORDER_STATUS_VALUES)[number];

export const SELLER_ORDER_STATUS_VALUES = [
  'PENDING_PAYMENT',
  'PAID',
  'PROCESSING',
  'SHIPPED',
  'DELIVERED',
  'CANCELLED',
] as const;

export type SellerOrderStatusValue = (typeof SELLER_ORDER_STATUS_VALUES)[number];

const SELLER_TRANSITIONS: Record<string, SellerOrderStatusValue[]> = {
  PAID: ['PROCESSING'],
  PROCESSING: ['SHIPPED'],
  SHIPPED: ['DELIVERED'],
  PENDING_PAYMENT: [],
  DELIVERED: [],
  CANCELLED: [],
};

export function canTransitionSellerOrder(
  from: string,
  to: string,
): boolean {
  return (SELLER_TRANSITIONS[from] ?? []).includes(to as SellerOrderStatusValue);
}

/**
 * Derives the parent order status from every seller group. The parent order is
 * never edited by hand; it always reflects the aggregate fulfilment state.
 */
export function aggregateOrderStatus(
  statuses: string[],
  current: string,
): OrderStatusValue {
  if (statuses.length === 0) return current as OrderStatusValue;
  if (statuses.every((status) => status === 'CANCELLED')) return 'CANCELLED';
  if (statuses.every((status) => status === 'DELIVERED')) return 'DELIVERED';
  if (statuses.some((status) => status === 'DELIVERED')) return 'PARTIALLY_DELIVERED';
  if (statuses.every((status) => status === 'SHIPPED' || status === 'DELIVERED')) {
    return 'SHIPPED';
  }
  if (statuses.some((status) => status === 'SHIPPED')) return 'PARTIALLY_SHIPPED';
  if (statuses.some((status) => status === 'PROCESSING')) return 'PROCESSING';
  if (statuses.every((status) => status === 'CANCELLED' || status === 'PENDING_PAYMENT')) {
    return 'CANCELLED';
  }
  return 'PAID';
}

export function orderTimeline(order: {
  createdAt: Date;
  paidAt?: Date | null;
  cancelledAt?: Date | null;
  orderStatus: string;
  sellerOrders?: Array<{
    status: string;
    shippedAt?: Date | null;
    deliveredAt?: Date | null;
    createdAt: Date;
  }>;
  payment?: { status: string; createdAt: Date } | null;
}): Array<{ label: string; status: string; at: string | null }> {
  const events: Array<{ label: string; status: string; at: string | null; atDate: Date }> = [
    {
      label: 'Order placed',
      status: 'PENDING_PAYMENT',
      at: order.createdAt.toISOString(),
      atDate: order.createdAt,
    },
  ];
  if (order.paidAt) {
    events.push({
      label: 'Payment confirmed (simulated)',
      status: 'PAID',
      at: order.paidAt.toISOString(),
      atDate: order.paidAt,
    });
  }
  for (const sellerOrder of order.sellerOrders ?? []) {
    if (sellerOrder.status === 'PROCESSING') {
      events.push({
        label: 'Seller is preparing the parcel',
        status: 'PROCESSING',
        at: sellerOrder.createdAt.toISOString(),
        atDate: sellerOrder.createdAt,
      });
    }
    if (sellerOrder.shippedAt) {
      events.push({
        label: 'Parcel shipped',
        status: 'SHIPPED',
        at: sellerOrder.shippedAt.toISOString(),
        atDate: sellerOrder.shippedAt,
      });
    }
    if (sellerOrder.deliveredAt) {
      events.push({
        label: 'Parcel delivered',
        status: 'DELIVERED',
        at: sellerOrder.deliveredAt.toISOString(),
        atDate: sellerOrder.deliveredAt,
      });
    }
  }
  if (order.cancelledAt) {
    events.push({
      label: 'Order cancelled',
      status: 'CANCELLED',
      at: order.cancelledAt.toISOString(),
      atDate: order.cancelledAt,
    });
  }
  return events
    .sort((a, b) => a.atDate.getTime() - b.atDate.getTime())
    .map(({ label, status, at }) => ({ label, status, at }));
}

