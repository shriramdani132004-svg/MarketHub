import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { InventoryService } from '../inventory/inventory.service';
import { withSerializableRetry } from '../common/utils/transaction.util';
import { paginate } from '../common/dto/pagination.dto';
import { orderInclude, presentOrder } from './order-presenter';

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventoryService: InventoryService,
  ) {}

  async listMine(
    userId: string,
    page: number,
    pageSize: number,
    status?: string,
  ) {
    // Lazy expiry: Render Free can sleep, so this must not rely on the scheduler.
    await this.inventoryService.expireOverdueReservations(10);

    const where = {
      customerId: userId,
      ...(status ? { orderStatus: status as never } : {}),
    };
    const [orders, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        include: orderInclude,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.order.count({ where }),
    ]);
    return paginate(
      orders.map((order) => presentOrder(order, 'customer')),
      total,
      page,
      pageSize,
    );
  }

  async getMine(userId: string, id: string) {
    await this.inventoryService.expireOrder(id);
    const order = await this.prisma.order.findFirst({
      where: { id, customerId: userId },
      include: orderInclude,
    });
    if (!order) throw new NotFoundException('Order not found');
    return presentOrder(order, 'customer');
  }

  async cancel(userId: string, id: string) {
    await this.inventoryService.expireOrder(id);

    const outcome = await withSerializableRetry(() =>
      this.prisma.$transaction(
        async (tx) => {
          await this.inventoryService.lockOrder(tx, id);
          const order = await tx.order.findUnique({
            where: { id },
            include: {
              sellerOrders: { include: { items: true } },
              payment: true,
            },
          });
          if (!order || order.customerId !== userId) {
            throw new NotFoundException('Order not found');
          }
          if (order.orderStatus === 'CANCELLED') {
            return { alreadyCancelled: true, refunded: order.paymentStatus === 'REFUNDED' };
          }

          const statuses = order.sellerOrders.map((sellerOrder) => sellerOrder.status);
          const shippedStatuses = new Set(['SHIPPED', 'DELIVERED']);
          if (statuses.some((status) => shippedStatuses.has(status))) {
            throw new ConflictException(
              'This order has already shipped and can no longer be cancelled',
            );
          }

          const lines = order.sellerOrders.flatMap((sellerOrder) =>
            sellerOrder.items.map((item) => ({
              productId: item.productId,
              sellerId: sellerOrder.sellerId,
              quantity: item.quantity,
            })),
          );

          let refunded = false;
          if (order.orderStatus === 'PENDING_PAYMENT') {
            for (const line of lines) {
              const updated = await tx.product.updateMany({
                where: {
                  id: line.productId,
                  reservedStock: { gte: line.quantity },
                },
                data: { reservedStock: { decrement: line.quantity } },
              });
              if (updated.count === 0) {
                throw new ConflictException(
                  'The reservation was already released. Refresh the order.',
                );
              }
              await tx.inventoryMovement.create({
                data: {
                  productId: line.productId,
                  sellerId: line.sellerId,
                  orderId: order.id,
                  movementType: 'STOCK_RELEASED',
                  quantity: line.quantity,
                  reference: 'Customer cancelled pending order',
                },
              });
            }
            if (order.payment && order.payment.status === 'PENDING') {
              await tx.payment.update({
                where: { id: order.payment.id },
                data: { status: 'CANCELLED' },
              });
              await tx.paymentEvent.create({
                data: {
                  paymentId: order.payment.id,
                  eventType: 'PAYMENT_CANCELLED',
                  details: {
                    simulated: true,
                    orderId: order.id,
                    reason: 'Cancelled before payment',
                  },
                },
              });
            }
            await tx.order.update({
              where: { id: order.id },
              data: {
                orderStatus: 'CANCELLED',
                paymentStatus: 'CANCELLED',
                cancelledAt: new Date(),
                cancellationReason: 'Cancelled by customer before payment',
              },
            });
          } else {
            // Paid or processing: simulated refund and restock.
            for (const line of lines) {
              await tx.product.update({
                where: { id: line.productId },
                data: { stockOnHand: { increment: line.quantity } },
              });
              await tx.inventoryMovement.create({
                data: {
                  productId: line.productId,
                  sellerId: line.sellerId,
                  orderId: order.id,
                  movementType: 'RESTOCKED',
                  quantity: line.quantity,
                  reference: 'Customer cancellation refund',
                },
              });
            }
            if (order.payment) {
              if (order.payment.status !== 'SUCCEEDED') {
                throw new ConflictException(
                  'Payment is not in a refundable state',
                );
              }
              const updated = await tx.payment.updateMany({
                where: { id: order.payment.id, status: 'SUCCEEDED' },
                data: { status: 'REFUNDED' },
              });
              if (updated.count === 0) {
                throw new ConflictException('Refund was already processed');
              }
              await tx.paymentEvent.create({
                data: {
                  paymentId: order.payment.id,
                  eventType: 'PAYMENT_REFUNDED',
                  details: {
                    simulated: true,
                    orderId: order.id,
                    amount: order.payment.amount.toFixed(2),
                    reason: 'Customer cancellation before fulfilment',
                  },
                },
              });
              refunded = true;
            }
            await tx.order.update({
              where: { id: order.id },
              data: {
                orderStatus: 'CANCELLED',
                paymentStatus: 'REFUNDED',
                cancelledAt: new Date(),
                cancellationReason: 'Cancelled by customer before shipment',
              },
            });
          }

          await tx.sellerOrder.updateMany({
            where: { orderId: order.id, status: { notIn: ['SHIPPED', 'DELIVERED'] } },
            data: { status: 'CANCELLED' },
          });
          await tx.notification.create({
            data: {
              userId: order.customerId,
              type: 'ORDER_CANCELLED',
              title: refunded ? 'Order cancelled and refunded' : 'Order cancelled',
              message: refunded
                ? `Order ${order.orderNumber} was cancelled. A simulated refund of ₹${order.payment?.amount.toFixed(2)} was recorded; stock was restored.`
                : `Order ${order.orderNumber} was cancelled and reserved stock was released.`,
              link: `/order/?id=${order.id}`,
            },
          });
          return { success: true, refunded };
        },
        { isolationLevel: 'Serializable', maxWait: 10_000, timeout: 15_000 },
      ),
    );

    const order = await this.prisma.order.findFirstOrThrow({
      where: { id, customerId: userId },
      include: orderInclude,
    });
    return { outcome, order: presentOrder(order, 'customer') };
  }
}
