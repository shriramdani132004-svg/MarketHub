import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../database/prisma.service';
import { SellersService } from '../sellers/sellers.service';
import { InventoryService } from '../inventory/inventory.service';
import { AdminService } from '../admin/admin.service';
import { money, ZERO } from '../common/utils/money.util';

@Injectable()
export class AnalyticsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sellersService: SellersService,
    private readonly inventoryService: InventoryService,
    private readonly adminService: AdminService,
  ) {}

  async customer(userId: string) {
    await this.inventoryService.expireOverdueReservations(5);
    const [orders, statusGroups, payments] = await Promise.all([
      this.prisma.order.findMany({
        where: { customerId: userId },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: {
          id: true,
          orderNumber: true,
          orderStatus: true,
          paymentStatus: true,
          grandTotal: true,
          createdAt: true,
        },
      }),
      this.prisma.order.groupBy({
        by: ['orderStatus'],
        where: { customerId: userId },
        _count: { _all: true },
      }),
      this.prisma.payment.findMany({
        where: {
          status: { in: ['SUCCEEDED', 'REFUNDED'] },
          order: { customerId: userId },
        },
        select: { amount: true, status: true },
      }),
    ]);

    const spent = payments
      .filter((payment) => payment.status === 'SUCCEEDED')
      .reduce((total, payment) => total.plus(payment.amount), ZERO);
    return {
      recentOrders: orders.map((order) => ({
        ...order,
        grandTotal: money(order.grandTotal),
      })),
      orderCount: statusGroups.reduce((sum, group) => sum + group._count._all, 0),
      delivered: statusGroups.find((group) => group.orderStatus === 'DELIVERED')?._count._all ?? 0,
      pendingPayment:
        statusGroups.find((group) => group.orderStatus === 'PENDING_PAYMENT')?._count._all ?? 0,
      cancelled: statusGroups.find((group) => group.orderStatus === 'CANCELLED')?._count._all ?? 0,
      simulatedSpend: money(spent),
      note: 'Spend reflects simulated demo payments only.',
    };
  }

  async seller(userId: string) {
    const seller = await this.sellersService.getOwnProfile(userId);
    await this.inventoryService.expireOverdueReservations(5);
    if (!seller) throw new NotFoundException('Seller profile not found');

    const paidStatuses: Array<
      'PAID' | 'PROCESSING' | 'SHIPPED' | 'DELIVERED'
    > = ['PAID', 'PROCESSING', 'SHIPPED', 'DELIVERED'];

    const since = new Date(Date.now() - 29 * 24 * 60 * 60 * 1000);
    since.setUTCHours(0, 0, 0, 0);

    const [
      products,
      sellerOrderGroups,
      sales,
      productSales,
      movements,
      recentOrders,
      salesLines,
    ] = await Promise.all([
      this.prisma.product.findMany({
        where: { sellerId: seller.id },
        select: { id: true, status: true, stockOnHand: true, reservedStock: true },
      }),
      this.prisma.sellerOrder.groupBy({
        by: ['status'],
        where: { sellerId: seller.id },
        _count: { _all: true },
      }),
      this.prisma.sellerOrder.aggregate({
        where: { sellerId: seller.id, status: { in: paidStatuses } },
        _sum: { subtotal: true, shippingAmount: true },
        _count: { _all: true },
      }),
      this.prisma.orderItem.groupBy({
        by: ['productId'],
        where: {
          sellerOrder: { sellerId: seller.id, status: { in: paidStatuses } },
        },
        _sum: { quantity: true, lineTotal: true },
        orderBy: { _sum: { lineTotal: 'desc' } },
        take: 8,
      }),
      this.prisma.inventoryMovement.findMany({
        where: { sellerId: seller.id },
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: { product: { select: { id: true, name: true, sku: true } } },
      }),
      this.prisma.sellerOrder.findMany({
        where: { sellerId: seller.id },
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: {
          order: {
            select: {
              id: true,
              orderNumber: true,
              orderStatus: true,
              customer: { select: { name: true } },
            },
          },
          items: { select: { productNameSnapshot: true, quantity: true } },
        },
      }),
      this.prisma.orderItem.findMany({
        where: {
          sellerOrder: {
            sellerId: seller.id,
            status: { in: paidStatuses },
            createdAt: { gte: since },
          },
        },
        select: { lineTotal: true, sellerOrder: { select: { createdAt: true } } },
      }),
    ]);

    const productIds = productSales.map((row) => row.productId);
    const productNames = await this.prisma.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true, name: true, sku: true, imageUrl: true },
    });
    const nameMap = new Map(productNames.map((product) => [product.id, product]));

    const lowStock = products.filter((product) => {
      const available = product.stockOnHand - product.reservedStock;
      return available > 0 && available <= 5;
    }).length;

    return {
      store: {
        id: seller.id,
        storeName: seller.storeName,
        storeSlug: seller.storeSlug,
        approvalStatus: seller.approvalStatus,
      },
      products: {
        total: products.length,
        published: products.filter((product) => product.status === 'PUBLISHED').length,
        draft: products.filter((product) => product.status === 'DRAFT').length,
        outOfStock: products.filter((product) => product.status === 'OUT_OF_STOCK').length,
        archived: products.filter((product) => product.status === 'ARCHIVED').length,
        lowStock,
      },
      orders: {
        pendingPayment:
          sellerOrderGroups.find((group) => group.status === 'PENDING_PAYMENT')?._count._all ?? 0,
        paid: sellerOrderGroups.find((group) => group.status === 'PAID')?._count._all ?? 0,
        processing:
          sellerOrderGroups.find((group) => group.status === 'PROCESSING')?._count._all ?? 0,
        shipped:
          sellerOrderGroups.find((group) => group.status === 'SHIPPED')?._count._all ?? 0,
        delivered:
          sellerOrderGroups.find((group) => group.status === 'DELIVERED')?._count._all ?? 0,
        cancelled:
          sellerOrderGroups.find((group) => group.status === 'CANCELLED')?._count._all ?? 0,
      },
      simulatedSales: {
        orders: sales._count._all,
        merchandise: money(sales._sum.subtotal ?? ZERO),
        shipping: money(sales._sum.shippingAmount ?? ZERO),
        gross: money(
          (sales._sum.subtotal ?? ZERO).plus(sales._sum.shippingAmount ?? ZERO),
        ),
        note: 'Paid demo orders only. No real money is processed.',
      },
      productPerformance: productSales.map((row) => ({
        productId: row.productId,
        product: nameMap.get(row.productId) ?? null,
        units: row._sum.quantity ?? 0,
        revenue: money(row._sum.lineTotal ?? ZERO),
      })),
      inventoryMovements: movements.map((movement) => ({
        ...movement,
        metadata: movement.metadata,
      })),
      recentOrders: recentOrders.map((sellerOrder) => ({
        id: sellerOrder.id,
        status: sellerOrder.status,
        subtotal: money(sellerOrder.subtotal),
        createdAt: sellerOrder.createdAt,
        order: sellerOrder.order,
        unitCount: sellerOrder.items.reduce((sum, item) => sum + item.quantity, 0),
      })),
      salesTrend: buildSellerTrend(salesLines),
    };
  }

  async admin(days: number) {
    const dashboard = await this.adminService.dashboard();
    return { ...dashboard, days };
  }

  async products(userId: string, role: string, days: number) {
    const since = new Date(Date.now() - (days - 1) * 24 * 60 * 60 * 1000);
    since.setUTCHours(0, 0, 0, 0);

    let sellerId: string | undefined;
    if (role === 'SELLER') {
      sellerId = (await this.sellersService.getOwnProfile(userId)).id;
    }

    const rows = await this.prisma.orderItem.groupBy({
      by: ['productId'],
      where: {
        sellerOrder: {
          ...(sellerId ? { sellerId } : {}),
          status: { in: ['PAID', 'PROCESSING', 'SHIPPED', 'DELIVERED'] },
          createdAt: { gte: since },
        },
      },
      _sum: { quantity: true, lineTotal: true },
      orderBy: { _sum: { lineTotal: 'desc' } },
      take: 20,
    });
    const products = await this.prisma.product.findMany({
      where: { id: { in: rows.map((row) => row.productId) } },
      select: {
        id: true,
        name: true,
        sku: true,
        imageUrl: true,
        price: true,
        seller: { select: { storeName: true, storeSlug: true } },
      },
    });
    const map = new Map(products.map((product) => [product.id, product]));
    return {
      days,
      items: rows.map((row) => ({
        productId: row.productId,
        product: map.get(row.productId) ?? null,
        units: row._sum.quantity ?? 0,
        revenue: money(row._sum.lineTotal ?? ZERO),
      })),
      note: 'Only paid demo orders are counted.',
    };
  }

  async sales(userId: string, role: string, days: number) {
    if (role === 'ADMIN') {
      const dashboard = await this.adminService.dashboard();
      return { days, trend: dashboard.salesTrend, note: dashboard.note };
    }
    const seller = await this.sellersService.getOwnProfile(userId);
    const since = new Date(Date.now() - (days - 1) * 24 * 60 * 60 * 1000);
    since.setUTCHours(0, 0, 0, 0);
    const lines = await this.prisma.orderItem.findMany({
      where: {
        sellerOrder: {
          sellerId: seller.id,
          status: { in: ['PAID', 'PROCESSING', 'SHIPPED', 'DELIVERED'] },
          createdAt: { gte: since },
        },
      },
      select: { lineTotal: true, sellerOrder: { select: { createdAt: true } } },
    });
    return {
      days,
      trend: buildSellerTrend(lines, days),
      note: 'Paid demo orders only. No real money is processed.',
    };
  }
}

function buildSellerTrend(
  lines: Array<{ lineTotal: Prisma.Decimal; sellerOrder: { createdAt: Date } }>,
  days = 30,
) {
  const result: Array<{ date: string; amount: number; orders: number }> = [];
  const map = new Map<string, { amount: number; orders: Set<string> }>();
  for (let i = days - 1; i >= 0; i -= 1) {
    const date = new Date(Date.now() - i * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);
    map.set(date, { amount: 0, orders: new Set() });
    result.push({ date, amount: 0, orders: 0 });
  }
  for (const line of lines) {
    const key = line.sellerOrder.createdAt.toISOString().slice(0, 10);
    const bucket = map.get(key);
    if (bucket) {
      bucket.amount += Number(line.lineTotal.toFixed(2));
      bucket.orders.add(key + line.sellerOrder.createdAt.getTime());
    }
  }
  return result.map((row) => ({
    ...row,
    amount: Number((map.get(row.date)?.amount ?? 0).toFixed(2)),
    orders: map.get(row.date)?.orders.size ?? 0,
  }));
}
