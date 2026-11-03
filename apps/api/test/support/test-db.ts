import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../src/generated/prisma/client';

export function hasTestDatabase(): boolean {
  return (
    process.env.MARKETHUB_TEST_DATABASE === '1' &&
    Boolean(process.env.DATABASE_URL) &&
    process.env.NODE_ENV === 'test'
  );
}

export function createTestClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is not configured for tests');
  }
  return new PrismaClient({
    adapter: new PrismaPg({ connectionString, max: 10 }),
    log: [],
    transactionOptions: { maxWait: 10_000, timeout: 20_000 },
  });
}

export function uniqueSuffix(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

export interface Fixture {
  sellerUserId: string;
  sellerId: string;
  categoryId: string;
  productId: string;
  customerIds: string[];
  addressIds: string[];
  cartIds: string[];
  emails: string[];
  skus: string[];
  slugs: string[];
  orderIds: string[];
}

export async function createFixture(
  prisma: PrismaClient,
  options: { stockOnHand: number; customerCount: number; quantityPerCustomer: number },
): Promise<Fixture> {
  const suffix = uniqueSuffix();
  const fixture: Fixture = {
    sellerUserId: '',
    sellerId: '',
    categoryId: '',
    productId: '',
    customerIds: [],
    addressIds: [],
    cartIds: [],
    emails: [],
    skus: [`SKU-${suffix}`],
    slugs: [`product-${suffix}`, `category-${suffix}`, `store-${suffix}`],
    orderIds: [],
  };

  const sellerUser = await prisma.user.create({
    data: {
      name: `Test Seller ${suffix}`,
      email: `seller-${suffix}@markethub.test`,
      passwordHash: 'not-used-in-tests',
      role: 'SELLER',
    },
  });
  fixture.sellerUserId = sellerUser.id;
  fixture.emails.push(sellerUser.email);

  const seller = await prisma.sellerProfile.create({
    data: {
      userId: sellerUser.id,
      storeName: `Test Store ${suffix}`,
      storeSlug: fixture.slugs[2],
      approvalStatus: 'APPROVED',
      approvedAt: new Date(),
    },
  });
  fixture.sellerId = seller.id;

  const category = await prisma.category.create({
    data: {
      name: `Test Category ${suffix}`,
      slug: fixture.slugs[1],
    },
  });
  fixture.categoryId = category.id;

  const product = await prisma.product.create({
    data: {
      sellerId: seller.id,
      categoryId: category.id,
      name: `Test Product ${suffix}`,
      slug: fixture.slugs[0],
      description: 'A product created only for automated tests.',
      sku: fixture.skus[0],
      price: '1499.00',
      stockOnHand: options.stockOnHand,
      reservedStock: 0,
      status: 'PUBLISHED',
    },
  });
  fixture.productId = product.id;

  for (let index = 0; index < options.customerCount; index += 1) {
    const customer = await prisma.user.create({
      data: {
        name: `Test Customer ${suffix} ${index}`,
        email: `customer-${suffix}-${index}@markethub.test`,
        passwordHash: 'not-used-in-tests',
        role: 'CUSTOMER',
      },
    });
    fixture.customerIds.push(customer.id);
    fixture.emails.push(customer.email);

    const address = await prisma.address.create({
      data: {
        userId: customer.id,
        recipientName: customer.name,
        phone: '+91 90000 00000',
        addressLine1: '1 Test Street',
        city: 'Bengaluru',
        state: 'Karnataka',
        postalCode: '560001',
        country: 'India',
      },
    });
    fixture.addressIds.push(address.id);

    const cart = await prisma.cart.create({
      data: {
        customerId: customer.id,
        status: 'ACTIVE',
        items: {
          create: {
            productId: product.id,
            quantity: options.quantityPerCustomer,
          },
        },
      },
    });
    fixture.cartIds.push(cart.id);
  }

  return fixture;
}

export async function cleanupFixture(
  prisma: PrismaClient,
  fixture: Fixture,
): Promise<void> {
  const orders = await prisma.order.findMany({
    where: { customerId: { in: fixture.customerIds } },
    select: { id: true },
  });
  const orderIds = orders.map((order) => order.id);

  await prisma.idempotencyRecord.deleteMany({
    where: { userId: { in: fixture.customerIds } },
  });
  await prisma.inventoryMovement.deleteMany({
    where: {
      OR: [
        { productId: fixture.productId },
        ...(orderIds.length ? [{ orderId: { in: orderIds } }] : []),
      ],
    },
  });
  // Orders cascade to payments, payment events, seller orders and order items.
  await prisma.order.deleteMany({ where: { id: { in: orderIds } } });
  await prisma.notification.deleteMany({
    where: {
      userId: { in: [fixture.sellerUserId, ...fixture.customerIds] },
    },
  });
  // Carts cascade to cart items, which reference the product with Restrict.
  await prisma.cart.deleteMany({ where: { customerId: { in: fixture.customerIds } } });
  await prisma.product.deleteMany({ where: { id: fixture.productId } });
  await prisma.category.deleteMany({ where: { id: fixture.categoryId } });
  await prisma.sellerProfile.deleteMany({ where: { id: fixture.sellerId } });
  await prisma.user.deleteMany({
    where: { id: { in: [fixture.sellerUserId, ...fixture.customerIds] } },
  });
}
