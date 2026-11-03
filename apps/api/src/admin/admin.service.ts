import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../database/prisma.service';
import { OrdersService } from '../orders/orders.service';
import { InventoryService } from '../inventory/inventory.service';
import { orderInclude, presentOrder } from '../orders/order-presenter';
import { paginate } from '../common/dto/pagination.dto';
import { money, ZERO } from '../common/utils/money.util';
import type {
  AdminInventoryQueryDto,
  AdminOrderQueryDto,
  AdminPaymentQueryDto,
  AdminProductQueryDto,
  AdminSellerActionDto,
  AdminSellerQueryDto,
  AdminUserQueryDto,
  AdminUserStatusDto,
  ModerateProductDto,
} from './dto/admin.dto';

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ordersService: OrdersService,
    private readonly inventoryService: InventoryService,
  ) {}

  async dashboard() {
    await this.inventoryService.expireOverdueReservations(15);
    const since = new Date(Date.now() - 13 * 24 * 60 * 60 * 1000);
    since.setUTCHours(0, 0, 0, 0);

    const [
      customers,
      sellers,
      pendingSellers,
      approvedSellers,
      activeProducts,
      outOfStock,
      totalOrders,
      failedPayments,
      revenue,
      recentOrders,
      recentApplications,
      statusGroups,
      trendPayments,
      lowStockCandidates,
    ] = await Promise.all([
      this.prisma.user.count({ where: { role: 'CUSTOMER' } }),
      this.prisma.sellerProfile.count(),
      this.prisma.sellerProfile.count({ where: { approvalStatus: 'PENDING' } }),
      this.prisma.sellerProfile.count({ where: { approvalStatus: 'APPROVED' } }),
      this.prisma.product.count({
        where: {
          status: { in: ['PUBLISHED', 'OUT_OF_STOCK'] },
          seller: { approvalStatus: 'APPROVED' },
        },
      }),
      this.prisma.product.count({ where: { status: 'OUT_OF_STOCK' } }),
      this.prisma.order.count(),
      this.prisma.payment.count({ where: { status: 'FAILED' } }),
      this.prisma.payment.aggregate({
        where: { status: 'SUCCEEDED' },
        _sum: { amount: true },
      }),
      this.prisma.order.findMany({
        orderBy: { createdAt: 'desc' },
        take: 8,
        select: {
          id: true,
          orderNumber: true,
          orderStatus: true,
          paymentStatus: true,
          grandTotal: true,
          createdAt: true,
          customer: { select: { name: true, email: true } },
          sellerOrders: {
            select: { seller: { select: { storeName: true } } },
          },
        },
      }),
      this.prisma.sellerProfile.findMany({
        orderBy: { createdAt: 'desc' },
        take: 6,
        select: {
          id: true,
          storeName: true,
          storeSlug: true,
          approvalStatus: true,
          createdAt: true,
          user: { select: { name: true, email: true } },
        },
      }),
      this.prisma.order.groupBy({
        by: ['orderStatus'],
        _count: { _all: true },
      }),
      this.prisma.payment.findMany({
        where: { status: 'SUCCEEDED', createdAt: { gte: since } },
        select: { amount: true, createdAt: true },
      }),
      this.prisma.product.findMany({
        where: {
          status: { in: ['PUBLISHED', 'OUT_OF_STOCK'] },
          seller: { approvalStatus: 'APPROVED' },
        },
        select: { stockOnHand: true, reservedStock: true },
      }),
    ]);

    return {
      customers,
      sellers,
      pendingSellers,
      approvedSellers,
      activeProducts,
      outOfStock,
      lowStock: lowStockCandidates.filter((product) => {
        const available = product.stockOnHand - product.reservedStock;
        return available > 0 && available <= 5;
      }).length,
      totalOrders,
      failedPayments,
      simulatedRevenue: money(revenue._sum.amount ?? ZERO),
      recentOrders: recentOrders.map((order) => ({
        id: order.id,
        orderNumber: order.orderNumber,
        orderStatus: order.orderStatus,
        paymentStatus: order.paymentStatus,
        grandTotal: money(order.grandTotal),
        createdAt: order.createdAt,
        customer: order.customer,
        sellerCount: order.sellerOrders.length,
      })),
      recentApplications,
      orderStatusDistribution: statusGroups.map((group) => ({
        status: group.orderStatus,
        count: group._count._all,
      })),
      salesTrend: buildTrend(trendPayments),
      note: 'Revenue figures reflect confirmed simulated demo payments only. No real money is processed.',
    };
  }

  async listSellers(query: AdminSellerQueryDto) {
    const where: Prisma.SellerProfileWhereInput = {};
    if (query.status) where.approvalStatus = query.status as never;
    if (query.q?.trim()) {
      const term = query.q.trim();
      where.OR = [
        { storeName: { contains: term, mode: 'insensitive' } },
        { storeSlug: { contains: term, mode: 'insensitive' } },
        { user: { email: { contains: term, mode: 'insensitive' } } },
        { user: { name: { contains: term, mode: 'insensitive' } } },
      ];
    }
    const [items, total] = await Promise.all([
      this.prisma.sellerProfile.findMany({
        where,
        include: {
          user: { select: { id: true, name: true, email: true, status: true } },
          _count: { select: { products: true, sellerOrders: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.sellerProfile.count({ where }),
    ]);
    return paginate(
      items.map((seller) => ({
        ...seller,
        productCount: seller._count.products,
        orderCount: seller._count.sellerOrders,
        _count: undefined,
      })),
      total,
      query.page,
      query.pageSize,
    );
  }

  async approveSeller(id: string, _dto: AdminSellerActionDto) {
    const seller = await this.requireSeller(id);
    if (seller.approvalStatus === 'APPROVED') {
      return { seller, changed: false };
    }
    const updated = await this.prisma.$transaction(async (tx) => {
      const changed = await tx.sellerProfile.update({
        where: { id },
        data: {
          approvalStatus: 'APPROVED',
          approvedAt: new Date(),
          rejectionReason: null,
        },
      });
      await tx.notification.create({
        data: {
          userId: seller.userId,
          type: 'SELLER_APPROVED',
          title: 'Your store is approved',
          message: `${seller.storeName} is now live on MarketHub. You can publish products.`,
          link: '/seller/',
        },
      });
      return changed;
    });
    return { seller: updated, changed: true };
  }

  async rejectSeller(id: string, dto: AdminSellerActionDto) {
    const seller = await this.requireSeller(id);
    if (seller.approvalStatus === 'APPROVED') {
      throw new ConflictException(
        'Approved stores must be suspended instead of rejected',
      );
    }
    const updated = await this.prisma.$transaction(async (tx) => {
      const changed = await tx.sellerProfile.update({
        where: { id },
        data: {
          approvalStatus: 'REJECTED',
          rejectionReason: dto.reason?.trim() || 'Application did not meet marketplace requirements',
        },
      });
      await tx.notification.create({
        data: {
          userId: seller.userId,
          type: 'SELLER_APPLICATION',
          title: 'Seller application update',
          message: `Your application for ${seller.storeName} was not approved. ${
            dto.reason?.trim() || 'Contact support for details.'
          }`,
          link: '/seller/settings/',
        },
      });
      return changed;
    });
    return { seller: updated };
  }

  async suspendSeller(id: string, dto: AdminSellerActionDto) {
    const seller = await this.requireSeller(id);
    if (seller.approvalStatus === 'SUSPENDED') {
      return { seller, changed: false };
    }
    const updated = await this.prisma.$transaction(async (tx) => {
      const changed = await tx.sellerProfile.update({
        where: { id },
        data: {
          approvalStatus: 'SUSPENDED',
          rejectionReason: dto.reason?.trim() || 'Suspended by marketplace administration',
        },
      });
      await tx.notification.create({
        data: {
          userId: seller.userId,
          type: 'SELLER_APPLICATION',
          title: 'Store suspended',
          message: `${seller.storeName} has been suspended. Existing orders remain visible. ${
            dto.reason?.trim() || ''
          }`,
          link: '/seller/settings/',
        },
      });
      return changed;
    });
    return { seller: updated, changed: true };
  }

  async reactivateSeller(id: string) {
    const seller = await this.requireSeller(id);
    if (seller.approvalStatus === 'APPROVED') {
      return { seller, changed: false };
    }
    const updated = await this.prisma.sellerProfile.update({
      where: { id },
      data: {
        approvalStatus: 'APPROVED',
        approvedAt: new Date(),
        rejectionReason: null,
      },
    });
    return { seller: updated, changed: true };
  }

  async listOrders(query: AdminOrderQueryDto) {
    await this.inventoryService.expireOverdueReservations(10);
    const where: Prisma.OrderWhereInput = {};
    if (query.status) where.orderStatus = query.status as never;
    if (query.paymentStatus) where.paymentStatus = query.paymentStatus as never;
    if (query.q?.trim()) {
      const term = query.q.trim();
      where.OR = [
        { orderNumber: { contains: term, mode: 'insensitive' } },
        { customer: { email: { contains: term, mode: 'insensitive' } } },
        { customer: { name: { contains: term, mode: 'insensitive' } } },
      ];
    }
    const [orders, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        include: orderInclude,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.order.count({ where }),
    ]);
    return paginate(
      orders.map((order) => presentOrder(order, 'admin')),
      total,
      query.page,
      query.pageSize,
    );
  }

  async getOrder(id: string) {
    await this.inventoryService.expireOrder(id);
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: orderInclude,
    });
    if (!order) throw new NotFoundException('Order not found');
    return presentOrder(order, 'admin');
  }

  async cancelOrder(id: string) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      select: { customerId: true },
    });
    if (!order) throw new NotFoundException('Order not found');
    return this.ordersService.cancel(order.customerId, id);
  }

  async listProducts(query: AdminProductQueryDto) {
    const where: Prisma.ProductWhereInput = {};
    if (query.status) where.status = query.status as never;
    if (query.sellerId) where.sellerId = query.sellerId;
    if (query.q?.trim()) {
      const term = query.q.trim();
      where.OR = [
        { name: { contains: term, mode: 'insensitive' } },
        { sku: { contains: term, mode: 'insensitive' } },
        { seller: { storeName: { contains: term, mode: 'insensitive' } } },
      ];
    }
    const select = {
      id: true,
      name: true,
      slug: true,
      sku: true,
      price: true,
      stockOnHand: true,
      reservedStock: true,
      status: true,
      imageUrl: true,
      createdAt: true,
      category: { select: { id: true, name: true, slug: true } },
      seller: {
        select: {
          id: true,
          storeName: true,
          storeSlug: true,
          approvalStatus: true,
        },
      },
    } as const;

    if (query.lowStock) {
      const candidates = await this.prisma.product.findMany({
        where,
        select,
        orderBy: { updatedAt: 'desc' },
      });
      const low = candidates.filter((product) => {
        const available = product.stockOnHand - product.reservedStock;
        return available > 0 && available <= 5;
      });
      const start = (query.page - 1) * query.pageSize;
      return paginate(
        low.slice(start, start + query.pageSize).map(mapAdminProduct),
        low.length,
        query.page,
        query.pageSize,
      );
    }

    const [items, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        select,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.product.count({ where }),
    ]);
    return paginate(
      items.map(mapAdminProduct),
      total,
      query.page,
      query.pageSize,
    );
  }

  async moderateProduct(id: string, dto: ModerateProductDto) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: { seller: { select: { userId: true, storeName: true, approvalStatus: true } } },
    });
    if (!product) throw new NotFoundException('Product not found');
    if (product.status === dto.status) {
      return { product, changed: false };
    }
    if (dto.status === 'PUBLISHED') {
      if (product.seller.approvalStatus !== 'APPROVED') {
        throw new BadRequestException('The seller must be approved before products go live');
      }
      if (product.stockOnHand - product.reservedStock < 1) {
        throw new BadRequestException('Product has no available stock');
      }
    }
    const updated = await this.prisma.$transaction(async (tx) => {
      const changed = await tx.product.update({
        where: { id },
        data: {
          status: dto.status,
          ...(dto.status === 'ARCHIVED' ? {} : {}),
        },
      });
      await tx.notification.create({
        data: {
          userId: product.seller.userId,
          type: 'SELLER_APPLICATION',
          title: 'Product listing updated by marketplace',
          message: `${product.name} was moved to ${dto.status} by an administrator.${
            dto.reason ? ` Reason: ${dto.reason}` : ''
          }`,
          link: `/seller/product/?id=${product.id}`,
        },
      });
      return changed;
    });
    return { product: updated, changed: true };
  }

  async listPayments(query: AdminPaymentQueryDto) {
    const where: Prisma.PaymentWhereInput = {};
    if (query.status) where.status = query.status as never;
    if (query.q?.trim()) {
      const term = query.q.trim();
      where.OR = [
        { paymentReference: { contains: term, mode: 'insensitive' } },
        { order: { orderNumber: { contains: term, mode: 'insensitive' } } },
        { order: { customer: { email: { contains: term, mode: 'insensitive' } } } },
      ];
    }
    const [items, total] = await Promise.all([
      this.prisma.payment.findMany({
        where,
        include: {
          order: {
            select: {
              id: true,
              orderNumber: true,
              orderStatus: true,
              customer: { select: { name: true, email: true } },
            },
          },
          _count: { select: { events: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.payment.count({ where }),
    ]);
    return paginate(
      items.map((payment) => ({
        id: payment.id,
        paymentReference: payment.paymentReference,
        provider: payment.provider,
        method: payment.method,
        amount: money(payment.amount),
        currency: payment.currency,
        status: payment.status,
        simulated: true,
        createdAt: payment.createdAt,
        eventCount: payment._count.events,
        order: payment.order,
      })),
      total,
      query.page,
      query.pageSize,
    );
  }

  async listInventory(query: AdminInventoryQueryDto) {
    const where: Prisma.InventoryMovementWhereInput = {};
    if (query.movementType) where.movementType = query.movementType as never;
    if (query.sellerId) where.sellerId = query.sellerId;
    if (query.productId) where.productId = query.productId;
    if (query.q?.trim()) {
      const term = query.q.trim();
      where.OR = [
        { reference: { contains: term, mode: 'insensitive' } },
        { product: { name: { contains: term, mode: 'insensitive' } } },
        { seller: { storeName: { contains: term, mode: 'insensitive' } } },
      ];
    }
    const [items, total] = await Promise.all([
      this.prisma.inventoryMovement.findMany({
        where,
        include: {
          product: { select: { id: true, name: true, sku: true } },
          seller: { select: { id: true, storeName: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.inventoryMovement.count({ where }),
    ]);
    return paginate(items, total, query.page, query.pageSize);
  }

  async listUsers(query: AdminUserQueryDto) {
    const where: Prisma.UserWhereInput = {};
    if (query.role) where.role = query.role as never;
    if (query.status) where.status = query.status as never;
    if (query.q?.trim()) {
      const term = query.q.trim();
      where.OR = [
        { name: { contains: term, mode: 'insensitive' } },
        { email: { contains: term, mode: 'insensitive' } },
      ];
    }
    const [items, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          phone: true,
          status: true,
          createdAt: true,
          sellerProfile: {
            select: {
              id: true,
              storeName: true,
              storeSlug: true,
              approvalStatus: true,
            },
          },
          _count: { select: { orders: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.user.count({ where }),
    ]);
    return paginate(
      items.map(({ _count, ...user }) => ({
        ...user,
        orderCount: _count.orders,
      })),
      total,
      query.page,
      query.pageSize,
    );
  }

  async setUserStatus(adminId: string, id: string, dto: AdminUserStatusDto) {
    if (id === adminId) {
      throw new ForbiddenException('You cannot change your own account status');
    }
    const target = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true, role: true, status: true, name: true },
    });
    if (!target) throw new NotFoundException('User not found');
    if (target.role === 'ADMIN') {
      throw new ForbiddenException('Administrator accounts cannot be suspended here');
    }
    const user = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.user.update({
        where: { id },
        data: { status: dto.status },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          status: true,
          createdAt: true,
        },
      });
      if (dto.status === 'SUSPENDED') {
        await tx.session.updateMany({
          where: { userId: id, revokedAt: null },
          data: { revokedAt: new Date() },
        });
      }
      return updated;
    });
    return { user };
  }

  private async requireSeller(id: string) {
    const seller = await this.prisma.sellerProfile.findUnique({ where: { id } });
    if (!seller) throw new NotFoundException('Seller not found');
    return seller;
  }
}

function mapAdminProduct(product: {
  price: Prisma.Decimal;
  stockOnHand: number;
  reservedStock: number;
  [key: string]: unknown;
}) {
  const available = Math.max(0, product.stockOnHand - product.reservedStock);
  return {
    ...product,
    price: money(product.price),
    available,
    lowStock: available > 0 && available <= 5,
  };
}

function buildTrend(payments: Array<{ amount: Prisma.Decimal; createdAt: Date }>) {
  const days: Array<{ date: string; amount: number; count: number }> = [];
  const map = new Map<string, { amount: number; count: number }>();
  for (let i = 13; i >= 0; i -= 1) {
    const date = new Date(Date.now() - i * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);
    map.set(date, { amount: 0, count: 0 });
    days.push({ date, amount: 0, count: 0 });
  }
  for (const payment of payments) {
    const key = payment.createdAt.toISOString().slice(0, 10);
    const entry = map.get(key);
    if (entry) {
      entry.amount += Number(payment.amount.toFixed(2));
      entry.count += 1;
    }
  }
  return days.map((day) => ({
    ...day,
    amount: Number((map.get(day.date)?.amount ?? 0).toFixed(2)),
    count: map.get(day.date)?.count ?? 0,
  }));
}
