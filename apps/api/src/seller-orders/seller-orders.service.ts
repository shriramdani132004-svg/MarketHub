import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../database/prisma.service';
import { SellersService } from '../sellers/sellers.service';
import { InventoryService } from '../inventory/inventory.service';
import { withSerializableRetry } from '../common/utils/transaction.util';
import {
  aggregateOrderStatus,
  canTransitionSellerOrder,
  money,
} from '../common/utils/money.util';
import { paginate } from '../common/dto/pagination.dto';
import type {
  SellerOrderQueryDto,
  UpdateSellerOrderStatusDto,
} from './dto/seller-order.dto';

const sellerOrderInclude = {
  seller: {
    select: {
      id: true,
      storeName: true,
      storeSlug: true,
      logoUrl: true,
      approvalStatus: true,
    },
  },
  items: {
    include: {
      product: { select: { id: true, name: true, slug: true, imageUrl: true } },
    },
  },
  order: {
    select: {
      id: true,
      orderNumber: true,
      orderStatus: true,
      paymentStatus: true,
      grandTotal: true,
      currency: true,
      shippingAddressSnapshot: true,
      createdAt: true,
      paidAt: true,
      customer: { select: { id: true, name: true, email: true, phone: true } },
      payment: { select: { id: true, status: true, paymentReference: true } },
    },
  },
} satisfies Prisma.SellerOrderInclude;

type SellerOrderFull = Prisma.SellerOrderGetPayload<{
  include: typeof sellerOrderInclude;
}>;

@Injectable()
export class SellerOrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sellersService: SellersService,
    private readonly inventoryService: InventoryService,
  ) {}

  async list(userId: string, query: SellerOrderQueryDto) {
    const seller = await this.sellersService.getOwnProfile(userId);
    await this.inventoryService.expireOverdueReservations(10);

    const where: Prisma.SellerOrderWhereInput = { sellerId: seller.id };
    if (query.status) where.status = query.status as never;
    if (query.q?.trim()) {
      const term = query.q.trim();
      where.OR = [
        { order: { orderNumber: { contains: term, mode: 'insensitive' } } },
        { order: { customer: { name: { contains: term, mode: 'insensitive' } } } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.sellerOrder.findMany({
        where,
        include: sellerOrderInclude,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.sellerOrder.count({ where }),
    ]);
    return paginate(items.map(presentSellerOrder), total, query.page, query.pageSize);
  }

  async getOne(userId: string, id: string) {
    const seller = await this.sellersService.getOwnProfile(userId);
    await this.inventoryService.expireOverdueReservations(10);
    const sellerOrder = await this.prisma.sellerOrder.findFirst({
      where: { id, sellerId: seller.id },
      include: sellerOrderInclude,
    });
    if (!sellerOrder) throw new NotFoundException('Order group not found');
    return presentSellerOrder(sellerOrder);
  }

  async updateStatus(
    userId: string,
    id: string,
    dto: UpdateSellerOrderStatusDto,
  ) {
    const seller = await this.sellersService.requireApprovedSeller(userId);
    await this.inventoryService.expireOverdueReservations(10);

    const current = await this.prisma.sellerOrder.findFirst({
      where: { id, sellerId: seller.id },
      select: { orderId: true, status: true },
    });
    if (!current) throw new NotFoundException('Order group not found');
    if (!canTransitionSellerOrder(current.status, dto.status)) {
      throw new ConflictException(
        `Cannot move this order from ${current.status} to ${dto.status}`,
      );
    }
    if (dto.status === 'SHIPPED' && !dto.trackingReference && !dto.trackingUrl) {
      throw new BadRequestException(
        'Add a shipment reference or tracking URL before marking as shipped',
      );
    }

    const result = await withSerializableRetry(() =>
      this.prisma.$transaction(
        async (tx) => {
          await this.inventoryService.lockOrder(tx, current.orderId);
          await tx.$queryRaw`SELECT "id" FROM "SellerOrder" WHERE "id" = ${id} FOR UPDATE`;

          const sellerOrder = await tx.sellerOrder.findUniqueOrThrow({
            where: { id },
            include: sellerOrderInclude,
          });
          if (sellerOrder.sellerId !== seller.id) {
            throw new NotFoundException('Order group not found');
          }
          if (!canTransitionSellerOrder(sellerOrder.status, dto.status)) {
            throw new ConflictException(
              `This order is already ${sellerOrder.status.toLowerCase()}`,
            );
          }
          if (sellerOrder.order.orderStatus === 'CANCELLED') {
            throw new ConflictException('Cancelled orders cannot be fulfilled');
          }

          const now = new Date();
          await tx.sellerOrder.update({
            where: { id },
            data: {
              status: dto.status,
              ...(dto.status === 'SHIPPED'
                ? {
                    shippedAt: now,
                    trackingReference: dto.trackingReference?.trim() || null,
                    trackingUrl: dto.trackingUrl?.trim() || null,
                  }
                : {}),
              ...(dto.status === 'DELIVERED' ? { deliveredAt: now } : {}),
            },
          });

          const siblings = await tx.sellerOrder.findMany({
            where: { orderId: current.orderId },
            select: { status: true },
          });
          const parentStatus = aggregateOrderStatus(
            siblings.map((sibling) => sibling.status),
            sellerOrder.order.orderStatus,
          );
          await tx.order.update({
            where: { id: current.orderId },
            data: { orderStatus: parentStatus },
          });

          if (dto.status === 'SHIPPED') {
            await tx.notification.create({
              data: {
                userId: sellerOrder.order.customer.id,
                type: 'ORDER_SHIPPED',
                title: 'Your parcel is on the way',
                message: `${sellerOrder.seller.storeName} shipped part of order ${sellerOrder.order.orderNumber}${
                  dto.trackingReference ? ` (ref: ${dto.trackingReference})` : ''
                }.`,
                link: `/order-tracking/?id=${sellerOrder.orderId}`,
              },
            });
          } else if (dto.status === 'DELIVERED') {
            await tx.notification.create({
              data: {
                userId: sellerOrder.order.customer.id,
                type: 'ORDER_DELIVERED',
                title: 'Parcel delivered',
                message: `${sellerOrder.seller.storeName} marked part of order ${sellerOrder.order.orderNumber} as delivered. You can now review the items.`,
                link: `/order/?id=${sellerOrder.orderId}`,
              },
            });
          }

          const updated = await tx.sellerOrder.findUniqueOrThrow({
            where: { id },
            include: sellerOrderInclude,
          });
          return presentSellerOrder(updated);
        },
        { isolationLevel: 'Serializable', maxWait: 10_000, timeout: 15_000 },
      ),
    );

    return result;
  }
}

function presentSellerOrder(sellerOrder: SellerOrderFull) {
  return {
    id: sellerOrder.id,
    status: sellerOrder.status,
    subtotal: money(sellerOrder.subtotal),
    shippingAmount: money(sellerOrder.shippingAmount),
    trackingReference: sellerOrder.trackingReference,
    trackingUrl: sellerOrder.trackingUrl,
    shippedAt: sellerOrder.shippedAt,
    deliveredAt: sellerOrder.deliveredAt,
    createdAt: sellerOrder.createdAt,
    updatedAt: sellerOrder.updatedAt,
    seller: sellerOrder.seller,
    items: sellerOrder.items.map((item) => ({
      id: item.id,
      productId: item.productId,
      name: item.productNameSnapshot,
      sku: item.skuSnapshot,
      unitPrice: money(item.unitPriceSnapshot),
      quantity: item.quantity,
      lineTotal: money(item.lineTotal),
      product: item.product,
    })),
    order: {
      id: sellerOrder.order.id,
      orderNumber: sellerOrder.order.orderNumber,
      orderStatus: sellerOrder.order.orderStatus,
      paymentStatus: sellerOrder.order.paymentStatus,
      grandTotal: money(sellerOrder.order.grandTotal),
      currency: sellerOrder.order.currency,
      createdAt: sellerOrder.order.createdAt,
      paidAt: sellerOrder.order.paidAt,
      shippingAddress: sellerOrder.order.shippingAddressSnapshot,
      customer: sellerOrder.order.customer,
      payment: sellerOrder.order.payment,
    },
  };
}
