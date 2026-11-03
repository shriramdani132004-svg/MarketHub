import { AppModule } from '../../src/app.module';
import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import * as argon2 from 'argon2';
import type { PrismaClient } from '../../src/generated/prisma/client';
import { AllExceptionsFilter } from '../../src/common/filters/all-exceptions.filter';
import {
  createTestClient,
  hasTestDatabase,
  uniqueSuffix,
} from '../support/test-db';

const describeDb = hasTestDatabase() ? describe : describe.skip;
const PASSWORD = 'StrongPass123';

type Agent = ReturnType<typeof request.agent>;

interface Created {
  adminId: string;
  adminEmail: string;
  customerEmail: string;
  sellerEmail: string;
  sellerSlug: string;
  categoryId: string;
  productId: string;
  orderId: string;
  paymentId: string;
  customerId: string;
  sellerId: string;
}

describeDb('MarketHub commerce flow (e2e over HTTP)', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  const created: Created = {
    adminId: '',
    adminEmail: '',
    customerEmail: '',
    sellerEmail: '',
    sellerSlug: '',
    categoryId: '',
    productId: '',
    orderId: '',
    paymentId: '',
    customerId: '',
    sellerId: '',
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    const nestApp = moduleRef.createNestApplication<NestExpressApplication>();
    nestApp.use(cookieParser());
    nestApp.setGlobalPrefix('api/v1');
    nestApp.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        stopAtFirstError: false,
      }),
    );
    nestApp.useGlobalFilters(new AllExceptionsFilter());
    await nestApp.init();
    app = nestApp;

    prisma = createTestClient();
    await prisma.$connect();
  });

  afterAll(async () => {
    if (prisma) {
      const userIds = [created.customerId, created.sellerId, created.adminId].filter(Boolean);
      if (userIds.length) {
        await prisma.idempotencyRecord.deleteMany({ where: { userId: { in: userIds } } });
        if (created.productId) {
          await prisma.inventoryMovement.deleteMany({
            where: { productId: created.productId },
          });
        }
        if (created.customerId) {
          await prisma.order.deleteMany({ where: { customerId: created.customerId } });
          await prisma.notification.deleteMany({ where: { userId: created.customerId } });
          await prisma.cart.deleteMany({ where: { customerId: created.customerId } });
        }
        await prisma.notification.deleteMany({ where: { userId: { in: userIds } } });
        if (created.productId) {
          await prisma.product.deleteMany({ where: { id: created.productId } });
        }
        if (created.categoryId) {
          await prisma.category.deleteMany({ where: { id: created.categoryId } });
        }
        if (created.sellerId) {
          await prisma.sellerProfile.deleteMany({ where: { id: created.sellerId } });
        }
        await prisma.user.deleteMany({ where: { id: { in: userIds } } });
      }
      await prisma.$disconnect();
    }
    if (app) await app.close();
  });

  function http() {
    return request(app.getHttpServer());
  }

  async function csrf(agent: Agent): Promise<string> {
    const response = await agent.get('/api/v1/auth/csrf').expect(200);
    const cookies = response.headers['set-cookie'] as unknown as string[];
    const csrfCookie = cookies.find((cookie) => cookie.startsWith('mh_csrf='));
    expect(csrfCookie).toBeTruthy();
    return decodeURIComponent(csrfCookie!.split(';')[0].split('=')[1]);
  }

  function post(agent: Agent, path: string, token: string, body?: unknown) {
    const req = agent.post(path).set('x-csrf-token', token);
    return body === undefined ? req : req.send(body as object);
  }

  function patch(agent: Agent, path: string, token: string, body?: unknown) {
    const req = agent.patch(path).set('x-csrf-token', token);
    return body === undefined ? req : req.send(body as object);
  }

  it('runs register → approve → publish → cart → checkout → pay → fulfil', async () => {
    const suffix = uniqueSuffix();
    created.adminEmail = `admin-e2e-${suffix}@markethub.test`;
    created.customerEmail = `customer-e2e-${suffix}@markethub.test`;
    created.sellerEmail = `seller-e2e-${suffix}@markethub.test`;
    created.sellerSlug = `e2e-store-${suffix}`;

    // Seed an administrator directly so the flow does not depend on the
    // one-time bootstrap secret being available on the test database.
    const admin = await prisma.user.create({
      data: {
        name: 'E2E Administrator',
        email: created.adminEmail,
        passwordHash: await argon2.hash(PASSWORD, { type: argon2.argon2id }),
        role: 'ADMIN',
      },
    });
    created.adminId = admin.id;

    const health = await http().get('/api/v1/health/live').expect(200);
    expect(health.body.status).toBe('ok');
    await http().get('/api/v1/health/ready').expect(200);

    // Customer registration.
    const customer = request.agent(app.getHttpServer());
    let customerCsrf = await csrf(customer);
    const registered = await post(customer, '/api/v1/auth/register', customerCsrf, {
      name: 'E2E Customer',
      email: created.customerEmail,
      password: PASSWORD,
      phone: '+91 90000 00001',
    }).expect(201);
    expect(registered.body.user.email).toBe(created.customerEmail);
    created.customerId = registered.body.user.id;

    // Authenticating rotates the CSRF cookie, mirroring the browser client.
    customerCsrf = await csrf(customer);
    await post(customer, '/api/v1/auth/register', customerCsrf, {
      name: 'Duplicate',
      email: created.customerEmail,
      password: PASSWORD,
    }).expect(409);

    // Seller application.
    const seller = request.agent(app.getHttpServer());
    let sellerCsrf = await csrf(seller);
    const applied = await post(seller, '/api/v1/auth/seller/apply', sellerCsrf, {
      name: 'E2E Seller',
      email: created.sellerEmail,
      password: PASSWORD,
      storeName: `E2E Store ${suffix}`,
      storeSlug: created.sellerSlug,
      description: 'Store created by the automated end-to-end test.',
      businessContact: 'seller@markethub.test',
    }).expect(201);
    expect(applied.body.user.role).toBe('SELLER');

    // Administrator logs in and approves the store.
    const adminAgent = request.agent(app.getHttpServer());
    let adminCsrf = await csrf(adminAgent);
    const adminLogin = await post(adminAgent, '/api/v1/auth/login', adminCsrf, {
      email: created.adminEmail,
      password: PASSWORD,
    }).expect(200);
    expect(adminLogin.body.user.role).toBe('ADMIN');
    adminCsrf = await csrf(adminAgent);

    const pending = await adminAgent
      .get(`/api/v1/admin/sellers?q=${encodeURIComponent(created.sellerSlug)}`)
      .expect(200);
    expect(pending.body.items.length).toBeGreaterThan(0);
    created.sellerId = pending.body.items[0].id;
    await patch(
      adminAgent,
      `/api/v1/admin/sellers/${created.sellerId}/approve`,
      adminCsrf,
      {},
    ).expect(200);

    // Admin creates an isolated category for the test product.
    const category = await post(adminAgent, '/api/v1/admin/categories', adminCsrf, {
      name: `E2E Category ${suffix}`,
      slug: `e2e-category-${suffix}`,
      isActive: true,
    }).expect(201);
    created.categoryId = category.body.id;

    // Seller publishes a product.
    sellerCsrf = await csrf(seller);
    await post(seller, '/api/v1/auth/login', sellerCsrf, {
      email: created.sellerEmail,
      password: PASSWORD,
    }).expect(200);
    sellerCsrf = await csrf(seller);
    const product = await post(seller, '/api/v1/seller/products', sellerCsrf, {
      name: `E2E Product ${suffix}`,
      description: 'A product published by the automated end-to-end test flow.',
      categoryId: created.categoryId,
      sku: `E2E-${suffix}`.toUpperCase(),
      price: '1499.00',
      stockOnHand: 5,
      status: 'PUBLISHED',
    }).expect(201);
    created.productId = product.body.id;
    expect(product.body.status).toBe('PUBLISHED');

    // Customer address and cart.
    const customerCsrfAgain = await csrf(customer);
    const address = await post(customer, '/api/v1/addresses', customerCsrfAgain, {
      recipientName: 'E2E Customer',
      phone: '+91 90000 00001',
      addressLine1: '42 Test Avenue',
      city: 'Bengaluru',
      state: 'Karnataka',
      postalCode: '560001',
      country: 'India',
      isDefault: true,
    }).expect(201);

    await post(customer, '/api/v1/cart/items', customerCsrfAgain, {
      productId: created.productId,
      quantity: 1,
    }).expect(201);

    const checkout = await post(customer, '/api/v1/checkout', customerCsrfAgain, {
      addressId: address.body.id,
    }).expect(201);
    created.orderId = checkout.body.orderId;
    created.paymentId = checkout.body.paymentId;
    expect(checkout.body.sellerOrderCount).toBe(1);
    expect(checkout.body.grandTotal).toBe('1499.00');

    const reserved = await prisma.product.findUniqueOrThrow({
      where: { id: created.productId },
    });
    expect(reserved.reservedStock).toBe(1);

    // Simulated payment succeeds.
    const paid = await post(
      customer,
      `/api/v1/payments/${created.paymentId}/simulate`,
      customerCsrfAgain,
      { outcome: 'SUCCESS' },
    ).expect(200);
    expect(paid.body.status).toBe('SUCCEEDED');
    expect(paid.body.simulated).toBe(true);

    const afterPayment = await prisma.product.findUniqueOrThrow({
      where: { id: created.productId },
    });
    expect(afterPayment.stockOnHand).toBe(4);
    expect(afterPayment.reservedStock).toBe(0);

    // Seller fulfils the group: processing → shipped → delivered.
    const sellerOrders = await seller
      .get('/api/v1/seller/orders')
      .expect(200);
    const sellerOrderId = sellerOrders.body.items[0].id;
    const sellerCsrfFulfil = await csrf(seller);
    await patch(seller, `/api/v1/seller/orders/${sellerOrderId}/status`, sellerCsrfFulfil, {
      status: 'PROCESSING',
    }).expect(200);
    await patch(seller, `/api/v1/seller/orders/${sellerOrderId}/status`, sellerCsrfFulfil, {
      status: 'SHIPPED',
      trackingReference: 'E2E-TRACK-123',
    }).expect(200);
    await patch(seller, `/api/v1/seller/orders/${sellerOrderId}/status`, sellerCsrfFulfil, {
      status: 'DELIVERED',
    }).expect(200);

    const order = await customer.get(`/api/v1/orders/${created.orderId}`).expect(200);
    expect(order.body.orderStatus).toBe('DELIVERED');
    expect(order.body.sellerOrders[0].trackingReference).toBe('E2E-TRACK-123');

    // Security: missing CSRF token is rejected.
    await customer
      .post('/api/v1/cart/items')
      .send({ productId: created.productId, quantity: 1 })
      .expect(403);

    // Security: customers cannot access administration.
    await customer.get('/api/v1/admin/dashboard').expect(403);

    // Security: sellers cannot access customer-only carts.
    await seller.get('/api/v1/cart').expect(403);

    // Analytics reflect the real simulated order.
    const analytics = await seller.get('/api/v1/analytics/seller').expect(200);
    expect(analytics.body.simulatedSales.orders).toBe(1);
    expect(analytics.body.simulatedSales.merchandise).toBe('1499.00');
    expect(analytics.body.orders.delivered).toBe(1);
  });
});
