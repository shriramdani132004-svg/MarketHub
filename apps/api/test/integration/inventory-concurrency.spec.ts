import type { PrismaClient } from '../../src/generated/prisma/client';
import { CheckoutService } from '../../src/checkout/checkout.service';
import { InventoryService } from '../../src/inventory/inventory.service';
import { PrismaService } from '../../src/database/prisma.service';
import {
  cleanupFixture,
  createFixture,
  createTestClient,
  hasTestDatabase,
  type Fixture,
} from '../support/test-db';

const describeDb = hasTestDatabase() ? describe : describe.skip;

describeDb('inventory reservation concurrency (PostgreSQL)', () => {
  let prisma: PrismaClient;
  let inventory: InventoryService;
  let checkout: CheckoutService;
  const fixtures: Fixture[] = [];

  beforeAll(async () => {
    prisma = createTestClient();
    await prisma.$connect();
    inventory = new InventoryService(prisma as unknown as PrismaService);
    checkout = new CheckoutService(prisma as unknown as PrismaService, inventory);
  });

  afterAll(async () => {
    for (const fixture of fixtures) {
      await cleanupFixture(prisma, fixture);
    }
    await prisma.$disconnect();
  });

  it('lets exactly one of two concurrent checkouts reserve the last unit', async () => {
    const fixture = await createFixture(prisma, {
      stockOnHand: 1,
      customerCount: 2,
      quantityPerCustomer: 1,
    });
    fixtures.push(fixture);

    const results = await Promise.allSettled([
      checkout.checkout(fixture.customerIds[0], { addressId: fixture.addressIds[0] }),
      checkout.checkout(fixture.customerIds[1], { addressId: fixture.addressIds[1] }),
    ]);

    const fulfilled = results.filter((result) => result.status === 'fulfilled');
    const rejected = results.filter((result) => result.status === 'rejected');

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(String((rejected[0] as PromiseRejectedResult).reason)).toMatch(
      /stock|units|conflict/i,
    );

    const product = await prisma.product.findUniqueOrThrow({
      where: { id: fixture.productId },
    });
    expect(product.stockOnHand).toBe(1);
    expect(product.reservedStock).toBe(1);

    const orders = await prisma.order.findMany({
      where: { customerId: { in: fixture.customerIds } },
      include: { sellerOrders: { include: { items: true } }, payment: true },
    });
    expect(orders).toHaveLength(1);
    expect(orders[0].orderStatus).toBe('PENDING_PAYMENT');
    expect(orders[0].paymentStatus).toBe('PENDING');
    expect(orders[0].sellerOrders).toHaveLength(1);
    expect(orders[0].sellerOrders[0].items).toHaveLength(1);
    expect(orders[0].payment?.status).toBe('PENDING');

    const reservations = await prisma.inventoryMovement.count({
      where: { productId: fixture.productId, movementType: 'STOCK_RESERVED' },
    });
    expect(reservations).toBe(1);

    const carts = await prisma.cart.findMany({
      where: { customerId: { in: fixture.customerIds } },
      select: { status: true },
    });
    expect(carts.filter((cart) => cart.status === 'CHECKED_OUT')).toHaveLength(1);
    expect(carts.filter((cart) => cart.status === 'ACTIVE')).toHaveLength(1);
  });

  it('is idempotent for a repeated checkout key', async () => {
    const fixture = await createFixture(prisma, {
      stockOnHand: 5,
      customerCount: 1,
      quantityPerCustomer: 2,
    });
    fixtures.push(fixture);

    const first = await checkout.checkout(
      fixture.customerIds[0],
      { addressId: fixture.addressIds[0] },
      'integration-idempotency-key',
    );
    const second = await checkout.checkout(
      fixture.customerIds[0],
      { addressId: fixture.addressIds[0] },
      'integration-idempotency-key',
    );

    expect(second.orderId).toBe(first.orderId);
    expect(second.paymentId).toBe(first.paymentId);
    expect(second.idempotent).toBe(true);

    const product = await prisma.product.findUniqueOrThrow({
      where: { id: fixture.productId },
    });
    expect(product.reservedStock).toBe(2);
    expect(
      await prisma.order.count({ where: { customerId: fixture.customerIds[0] } }),
    ).toBe(1);
  });

  it('releases an expired reservation exactly once', async () => {
    const fixture = await createFixture(prisma, {
      stockOnHand: 3,
      customerCount: 1,
      quantityPerCustomer: 2,
    });
    fixtures.push(fixture);

    const summary = await checkout.checkout(fixture.customerIds[0], {
      addressId: fixture.addressIds[0],
    });

    await prisma.order.update({
      where: { id: summary.orderId },
      data: { reservationExpiresAt: new Date(Date.now() - 60_000) },
    });

    await expect(inventory.expireOrder(summary.orderId)).resolves.toBe(true);
    await expect(inventory.expireOrder(summary.orderId)).resolves.toBe(false);

    const product = await prisma.product.findUniqueOrThrow({
      where: { id: fixture.productId },
    });
    expect(product.reservedStock).toBe(0);
    expect(product.stockOnHand).toBe(3);

    const order = await prisma.order.findUniqueOrThrow({
      where: { id: summary.orderId },
      include: { sellerOrders: true, payment: true },
    });
    expect(order.orderStatus).toBe('CANCELLED');
    expect(order.paymentStatus).toBe('CANCELLED');
    expect(order.cancelledAt).not.toBeNull();
    expect(order.sellerOrders.every((group) => group.status === 'CANCELLED')).toBe(true);
    expect(order.payment?.status).toBe('CANCELLED');

    const released = await prisma.inventoryMovement.count({
      where: {
        productId: fixture.productId,
        movementType: 'STOCK_RELEASED',
      },
    });
    expect(released).toBe(1);
  });
});
