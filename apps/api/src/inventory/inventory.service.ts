import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { Prisma } from '../generated/prisma/client';

export type Tx = Prisma.TransactionClient;

interface ReservationLine {
  productId: string;
  sellerId: string;
  quantity: number;
}

@Injectable()
export class InventoryService {
  private readonly logger = new Logger(InventoryService.name);
  private running = false;

  constructor(private readonly prisma: PrismaService) {}

  /** Deterministic row locks avoid deadlocks between concurrent checkouts. */
  async lockProducts(tx: Tx, productIds: string[]): Promise<void> {
    const ordered = [...new Set(productIds)].sort();
    for (const id of ordered) {
      await tx.$queryRaw`SELECT "id" FROM "Product" WHERE "id" = ${id} FOR UPDATE`;
    }
  }

  async lockOrder(tx: Tx, orderId: string): Promise<void> {
    await tx.$queryRaw`SELECT "id" FROM "Order" WHERE "id" = ${orderId} FOR UPDATE`;
  }

  async releaseReservation(
    tx: Tx,
    lines: ReservationLine[],
    options: {
      orderId: string;
      reference: string;
      metadata?: Record<string, unknown>;
    },
  ): Promise<void> {
    for (const line of lines) {
      const updated = await tx.product.updateMany({
        where: { id: line.productId, reservedStock: { gte: line.quantity } },
        data: { reservedStock: { decrement: line.quantity } },
      });
      if (updated.count === 0) {
        throw new Error(
          `Reservation release invariant failed for product ${line.productId}`,
        );
      }
      await tx.inventoryMovement.create({
        data: {
          productId: line.productId,
          sellerId: line.sellerId,
          orderId: options.orderId,
          movementType: 'STOCK_RELEASED',
          quantity: line.quantity,
          reference: options.reference,
          metadata: (options.metadata ?? {}) as Prisma.InputJsonValue,
        },
      });
    }
  }

  /**
   * Releases every still-pending reservation for an expired order exactly once.
   * Returns true when this call performed the cancellation.
   */
  async expireOrder(orderId: string): Promise<boolean> {
    try {
      return await this.prisma.$transaction(
        async (tx) => {
          await this.lockOrder(tx, orderId);
          const order = await tx.order.findUnique({
            where: { id: orderId },
            include: {
              sellerOrders: { include: { items: true } },
              payment: true,
            },
          });
          if (
            !order ||
            order.orderStatus !== 'PENDING_PAYMENT' ||
            !order.reservationExpiresAt ||
            order.reservationExpiresAt.getTime() > Date.now()
          ) {
            return false;
          }

          const lines: ReservationLine[] = order.sellerOrders.flatMap((sellerOrder) =>
            sellerOrder.items.map((item) => ({
              productId: item.productId,
              sellerId: sellerOrder.sellerId,
              quantity: item.quantity,
            })),
          );

          await this.releaseReservation(tx, lines, {
            orderId: order.id,
            reference: 'Reservation expired',
            metadata: { reason: 'RESERVATION_EXPIRED' },
          });

          await tx.sellerOrder.updateMany({
            where: { orderId: order.id, status: 'PENDING_PAYMENT' },
            data: { status: 'CANCELLED' },
          });
          await tx.order.update({
            where: { id: order.id },
            data: {
              orderStatus: 'CANCELLED',
              paymentStatus: 'CANCELLED',
              cancelledAt: new Date(),
              cancellationReason: 'Payment reservation expired',
            },
          });
          if (order.payment && order.payment.status === 'PENDING') {
            await tx.payment.update({
              where: { id: order.payment.id },
              data: { status: 'CANCELLED' },
            });
            await tx.paymentEvent.create({
              data: {
                paymentId: order.payment.id,
                eventType: 'RESERVATION_EXPIRED',
                details: {
                  simulated: true,
                  orderId: order.id,
                  reason: 'Payment was not completed before the reservation expired',
                },
              },
            });
          }
          await tx.notification.create({
            data: {
              userId: order.customerId,
              type: 'ORDER_CANCELLED',
              title: 'Checkout reservation expired',
              message: `Order ${order.orderNumber} was cancelled because payment was not completed in time. No stock was deducted.`,
              link: `/order/?id=${order.id}`,
            },
          });
          return true;
        },
        { isolationLevel: 'Serializable', maxWait: 10_000, timeout: 15_000 },
      );
    } catch (error) {
      this.logger.warn(
        `Reservation expiry skipped for order ${orderId}: ${
          error instanceof Error ? error.message : 'unknown error'
        }`,
      );
      return false;
    }
  }

  async expireOverdueReservations(limit = 25): Promise<number> {
    if (this.running) return 0;
    this.running = true;
    try {
      const overdue = await this.prisma.order.findMany({
        where: {
          orderStatus: 'PENDING_PAYMENT',
          reservationExpiresAt: { lt: new Date() },
        },
        select: { id: true },
        orderBy: { reservationExpiresAt: 'asc' },
        take: limit,
      });
      let expired = 0;
      for (const order of overdue) {
        if (await this.expireOrder(order.id)) expired += 1;
      }
      if (expired > 0) {
        this.logger.log(`Released ${expired} expired checkout reservation(s)`);
      }
      return expired;
    } finally {
      this.running = false;
    }
  }

  async releaseStaleCarts(): Promise<void> {
    // Carts never reserve stock; this only closes carts abandoned for 60+ days.
    const cutoff = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
    await this.prisma.cart.updateMany({
      where: { status: 'ACTIVE', updatedAt: { lt: cutoff } },
      data: { status: 'ABANDONED' },
    });
  }
}

