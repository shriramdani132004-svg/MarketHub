import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { InventoryService } from '../inventory/inventory.service';
import { withSerializableRetry } from '../common/utils/transaction.util';
import { money } from '../common/utils/money.util';
import type { SimulatePaymentDto } from './dto/payment.dto';

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventoryService: InventoryService,
  ) {}

  async get(userId: string, id: string) {
    const payment = await this.prisma.payment.findFirst({
      where: { id, order: { customerId: userId } },
      include: {
        order: {
          include: {
            sellerOrders: { include: { items: true, seller: true } },
          },
        },
        events: { orderBy: { createdAt: 'desc' } },
      },
    });
    if (!payment) throw new NotFoundException('Payment not found');
    await this.inventoryService.expireOrder(payment.orderId);
    const refreshed = await this.prisma.payment.findUniqueOrThrow({
      where: { id },
      include: {
        order: {
          include: {
            sellerOrders: { include: { items: true, seller: true } },
          },
        },
        events: { orderBy: { createdAt: 'desc' } },
      },
    });
    return this.present(refreshed);
  }

  async events(userId: string, id: string) {
    const payment = await this.prisma.payment.findFirst({
      where: { id, order: { customerId: userId } },
      select: { id: true },
    });
    if (!payment) throw new NotFoundException('Payment not found');
    const items = await this.prisma.paymentEvent.findMany({
      where: { paymentId: id },
      orderBy: { createdAt: 'desc' },
    });
    return { items };
  }

  async simulate(
    userId: string,
    id: string,
    dto: SimulatePaymentDto,
    headerKey?: string,
  ) {
    await this.inventoryService.expireOverdueReservations(10);
    const key = (headerKey ?? dto.idempotencyKey)?.trim() || undefined;
    const scope = `PAYMENT:${dto.outcome}`;

    if (key) {
      const existing = await this.prisma.idempotencyRecord.findUnique({
        where: { userId_scope_key: { userId, scope, key } },
      });
      if (existing?.responseJson) {
        return {
          ...(existing.responseJson as Record<string, unknown>),
          idempotent: true,
        };
      }
    }

    let result;
    try {
      result = await withSerializableRetry(() =>
        this.prisma.$transaction(
          async (tx) => {
            const payment = await tx.payment.findFirst({
              where: { id, order: { customerId: userId } },
              include: {
                order: {
                  include: {
                    sellerOrders: { include: { items: true } },
                  },
                },
              },
            });
            if (!payment) throw new NotFoundException('Payment not found');

            await this.inventoryService.lockOrder(tx, payment.orderId);
            await tx.$queryRaw`SELECT "id" FROM "Payment" WHERE "id" = ${id} FOR UPDATE`;

            const fresh = await tx.payment.findUniqueOrThrow({
              where: { id },
              include: {
                order: { include: { sellerOrders: { include: { items: true } } } },
              },
            });

            if (fresh.status === 'SUCCEEDED') {
              if (dto.outcome === 'SUCCESS') {
                return this.resultFor(fresh, true);
              }
              throw new ConflictException('This payment already succeeded');
            }
            if (fresh.status !== 'PENDING') {
              throw new ConflictException(
                `This payment is ${fresh.status.toLowerCase()} and can no longer be simulated`,
              );
            }
            if (fresh.order.orderStatus !== 'PENDING_PAYMENT') {
              throw new ConflictException('This order is no longer awaiting payment');
            }
            if (
              !fresh.order.reservationExpiresAt ||
              fresh.order.reservationExpiresAt.getTime() <= Date.now()
            ) {
              throw new ConflictException(
                'The checkout reservation has expired. Place a new order.',
              );
            }
            if (!fresh.amount.equals(fresh.order.grandTotal)) {
              throw new ConflictException('Payment amount does not match the order total');
            }

            const lines = fresh.order.sellerOrders.flatMap((sellerOrder) =>
              sellerOrder.items.map((item) => ({
                productId: item.productId,
                sellerId: sellerOrder.sellerId,
                quantity: item.quantity,
              })),
            );

            if (dto.outcome === 'SUCCESS') {
              await this.inventoryService.lockProducts(
                tx,
                lines.map((line) => line.productId),
              );
              for (const line of lines) {
                const updated = await tx.product.updateMany({
                  where: {
                    id: line.productId,
                    stockOnHand: { gte: line.quantity },
                    reservedStock: { gte: line.quantity },
                  },
                  data: {
                    stockOnHand: { decrement: line.quantity },
                    reservedStock: { decrement: line.quantity },
                  },
                });
                if (updated.count === 0) {
                  throw new ConflictException(
                    'Reserved stock is no longer available for this order',
                  );
                }
                const product = await tx.product.findUniqueOrThrow({
                  where: { id: line.productId },
                  select: { status: true, stockOnHand: true, reservedStock: true },
                });
                if (
                  product.status === 'PUBLISHED' &&
                  product.stockOnHand - product.reservedStock <= 0
                ) {
                  await tx.product.update({
                    where: { id: line.productId },
                    data: { status: 'OUT_OF_STOCK' },
                  });
                }
                await tx.inventoryMovement.create({
                  data: {
                    productId: line.productId,
                    sellerId: line.sellerId,
                    orderId: fresh.orderId,
                    movementType: 'SALE_CONFIRMED',
                    quantity: line.quantity,
                    reference: `Simulated payment ${fresh.paymentReference}`,
                  },
                });
              }

              await tx.payment.update({
                where: { id },
                data: { status: 'SUCCEEDED' },
              });
              await tx.paymentEvent.create({
                data: {
                  paymentId: id,
                  eventType: 'PAYMENT_SUCCEEDED',
                  details: {
                    simulated: true,
                    amount: fresh.amount.toFixed(2),
                    currency: fresh.currency,
                    note: 'Demo payment only. No real money was charged.',
                  },
                },
              });
              await tx.order.update({
                where: { id: fresh.orderId },
                data: {
                  orderStatus: 'PAID',
                  paymentStatus: 'SUCCEEDED',
                  paidAt: new Date(),
                  reservationExpiresAt: null,
                },
              });
              await tx.sellerOrder.updateMany({
                where: { orderId: fresh.orderId, status: 'PENDING_PAYMENT' },
                data: { status: 'PAID' },
              });

              await tx.notification.create({
                data: {
                  userId,
                  type: 'PAYMENT_SUCCEEDED',
                  title: 'Demo payment confirmed',
                  message: `Order ${fresh.order.orderNumber} is paid (simulated). The seller will now prepare your items.`,
                  link: `/order/?id=${fresh.orderId}`,
                },
              });
              const sellerProfiles = await tx.sellerProfile.findMany({
                where: { id: { in: fresh.order.sellerOrders.map((o) => o.sellerId) } },
                select: { userId: true },
              });
              if (sellerProfiles.length > 0) {
                await tx.notification.createMany({
                  data: sellerProfiles.map((seller) => ({
                    userId: seller.userId,
                    type: 'PAYMENT_SUCCEEDED',
                    title: 'Order paid — ready to process',
                    message: `Order ${fresh.order.orderNumber} is paid (simulated) and ready for fulfilment.`,
                    link: '/seller/orders/',
                  })),
                });
              }
            } else {
              await this.inventoryService.releaseReservation(tx, lines, {
                orderId: fresh.orderId,
                reference: 'Simulated payment failure',
                metadata: { reason: 'PAYMENT_FAILED' },
              });
              await tx.payment.update({
                where: { id },
                data: { status: 'FAILED' },
              });
              await tx.paymentEvent.create({
                data: {
                  paymentId: id,
                  eventType: 'PAYMENT_FAILED',
                  details: {
                    simulated: true,
                    amount: fresh.amount.toFixed(2),
                    reason: 'Customer selected the demo failure outcome',
                  },
                },
              });
              await tx.sellerOrder.updateMany({
                where: { orderId: fresh.orderId, status: 'PENDING_PAYMENT' },
                data: { status: 'CANCELLED' },
              });
              await tx.order.update({
                where: { id: fresh.orderId },
                data: {
                  orderStatus: 'CANCELLED',
                  paymentStatus: 'FAILED',
                  cancelledAt: new Date(),
                  cancellationReason: 'Simulated payment failed',
                  reservationExpiresAt: null,
                },
              });
              await tx.notification.create({
                data: {
                  userId,
                  type: 'PAYMENT_FAILED',
                  title: 'Demo payment failed',
                  message: `Order ${fresh.order.orderNumber} was cancelled because the simulated payment failed. Reserved stock was released and nothing was charged.`,
                  link: `/order/?id=${fresh.orderId}`,
                },
              });
            }

            const response = {
              paymentId: id,
              paymentReference: fresh.paymentReference,
              orderId: fresh.orderId,
              orderNumber: fresh.order.orderNumber,
              status: dto.outcome === 'SUCCESS' ? 'SUCCEEDED' : 'FAILED',
              amount: money(fresh.amount),
              currency: fresh.currency,
              simulated: true,
              idempotent: false,
            };
            if (key) {
              await tx.idempotencyRecord.create({
                data: {
                  userId,
                  scope,
                  key,
                  orderId: fresh.orderId,
                  paymentId: id,
                  responseJson: response,
                },
              });
            }
            return response;
          },
          { isolationLevel: 'Serializable', maxWait: 10_000, timeout: 20_000 },
        ),
      );
    } catch (error) {
      if (key && (error as { code?: string }).code === 'P2002') {
        const existing = await this.prisma.idempotencyRecord.findUnique({
          where: { userId_scope_key: { userId, scope, key } },
        });
        if (existing?.responseJson) {
          return {
            ...(existing.responseJson as Record<string, unknown>),
            idempotent: true,
          };
        }
      }
      throw error;
    }
    return result;
  }

  private resultFor(
    payment: {
      id: string;
      paymentReference: string;
      orderId: string;
      amount: { toFixed: (digits: number) => string };
      currency: string;
      order: { orderNumber: string };
    },
    idempotent: boolean,
  ) {
    return {
      paymentId: payment.id,
      paymentReference: payment.paymentReference,
      orderId: payment.orderId,
      orderNumber: payment.order.orderNumber,
      status: 'SUCCEEDED',
      amount: money(payment.amount as never),
      currency: payment.currency,
      simulated: true,
      idempotent,
    };
  }

  private present(payment: {
    id: string;
    paymentReference: string;
    provider: string;
    method: string;
    amount: { toFixed: (digits: number) => string };
    currency: string;
    status: string;
    createdAt: Date;
    events: Array<{
      id: string;
      eventType: string;
      details: unknown;
      createdAt: Date;
    }>;
    order: {
      id: string;
      orderNumber: string;
      orderStatus: string;
      paymentStatus: string;
      grandTotal: { toFixed: (digits: number) => string };
      reservationExpiresAt: Date | null;
      currency: string;
      sellerOrders: Array<{
        id: string;
        status: string;
        subtotal: { toFixed: (digits: number) => string };
        seller: { storeName: string };
        items: Array<{
          id: string;
          productNameSnapshot: string;
          quantity: number;
          lineTotal: { toFixed: (digits: number) => string };
        }>;
      }>;
    };
  }) {
    return {
      id: payment.id,
      paymentReference: payment.paymentReference,
      provider: payment.provider,
      method: payment.method,
      amount: money(payment.amount as never),
      currency: payment.currency,
      status: payment.status,
      simulated: true,
      createdAt: payment.createdAt,
      events: payment.events,
      order: {
        id: payment.order.id,
        orderNumber: payment.order.orderNumber,
        orderStatus: payment.order.orderStatus,
        paymentStatus: payment.order.paymentStatus,
        grandTotal: money(payment.order.grandTotal as never),
        currency: payment.order.currency,
        reservationExpiresAt: payment.order.reservationExpiresAt,
        sellerOrders: payment.order.sellerOrders.map((sellerOrder) => ({
          id: sellerOrder.id,
          status: sellerOrder.status,
          subtotal: money(sellerOrder.subtotal as never),
          sellerName: sellerOrder.seller.storeName,
          items: sellerOrder.items.map((item) => ({
            id: item.id,
            name: item.productNameSnapshot,
            quantity: item.quantity,
            lineTotal: money(item.lineTotal as never),
          })),
        })),
      },
    };
  }
}
