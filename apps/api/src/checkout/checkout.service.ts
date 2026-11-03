import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../database/prisma.service';
import { InventoryService } from '../inventory/inventory.service';
import { withSerializableRetry } from '../common/utils/transaction.util';
import {
  addMoney,
  money,
  shippingForSubtotal,
  ZERO,
} from '../common/utils/money.util';
import { orderInclude, presentOrder } from '../orders/order-presenter';
import type { CheckoutDto } from './dto/checkout.dto';

interface CheckoutSummary {
  orderId: string;
  orderNumber: string;
  paymentId: string;
  paymentReference: string;
  grandTotal: string;
  currency: string;
  reservationExpiresAt: string;
  sellerOrderCount: number;
  idempotent?: boolean;
}

@Injectable()
export class CheckoutService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventoryService: InventoryService,
  ) {}

  async checkout(
    userId: string,
    dto: CheckoutDto,
    headerKey?: string,
  ): Promise<CheckoutSummary> {
    await this.inventoryService.expireOverdueReservations(10);
    const key = (headerKey ?? dto.idempotencyKey)?.trim() || undefined;

    if (key) {
      const existing = await this.findIdempotent(userId, key);
      if (existing) return { ...existing, idempotent: true };
    }

    const address = await this.prisma.address.findFirst({
      where: { id: dto.addressId, userId },
    });
    if (!address) throw new NotFoundException('Delivery address not found');

    let summary: CheckoutSummary;
    try {
      summary = await withSerializableRetry(() =>
        this.prisma.$transaction(
          async (tx) => {
            if (key) {
              const replay = await tx.idempotencyRecord.findUnique({
                where: {
                  userId_scope_key: { userId, scope: 'CHECKOUT', key },
                },
              });
              if (replay?.responseJson) {
                return {
                  ...(replay.responseJson as unknown as CheckoutSummary),
                  idempotent: true,
                };
              }
            }

            const cart = await tx.cart.findFirst({
              where: { customerId: userId, status: 'ACTIVE' },
              include: {
                items: {
                  orderBy: { addedAt: 'asc' },
                  include: {
                    product: {
                      include: {
                        seller: {
                          select: {
                            id: true,
                            storeName: true,
                            approvalStatus: true,
                          },
                        },
                      },
                    },
                  },
                },
              },
            });
            if (!cart || cart.items.length === 0) {
              throw new BadRequestException('Your cart is empty');
            }

            // Serialize cart edits against this checkout.
            await tx.$queryRaw`SELECT "id" FROM "Cart" WHERE "id" = ${cart.id} FOR UPDATE`;

            const productIds = cart.items.map((item) => item.productId);
            await this.inventoryService.lockProducts(tx, productIds);

            const lockedProducts = await tx.product.findMany({
              where: { id: { in: productIds } },
              include: {
                seller: { select: { id: true, storeName: true, approvalStatus: true } },
              },
            });
            const byId = new Map(lockedProducts.map((product) => [product.id, product]));

            for (const item of cart.items) {
              const product = byId.get(item.productId);
              if (!product) {
                throw new ConflictException('A product in your cart no longer exists');
              }
              if (!['PUBLISHED', 'OUT_OF_STOCK'].includes(product.status)) {
                throw new ConflictException(
                  `${product.name} is no longer available for purchase`,
                );
              }
              if (product.seller.approvalStatus !== 'APPROVED') {
                throw new ConflictException(
                  `${product.seller.storeName} is not currently accepting orders`,
                );
              }
              if (item.quantity < 1 || item.quantity > 99) {
                throw new BadRequestException(
                  `Invalid quantity for ${product.name}`,
                );
              }
              const available = product.stockOnHand - product.reservedStock;
              if (available < item.quantity) {
                throw new ConflictException(
                  available === 0
                    ? `${product.name} is out of stock`
                    : `Only ${available} unit${available === 1 ? '' : 's'} of ${product.name} remain`,
                );
              }
            }

            const snapshot = {
              recipientName: address.recipientName,
              phone: address.phone,
              addressLine1: address.addressLine1,
              addressLine2: address.addressLine2,
              city: address.city,
              state: address.state,
              postalCode: address.postalCode,
              country: address.country,
            };

            const groups = new Map<
              string,
              {
                sellerId: string;
                sellerName: string;
                subtotal: typeof ZERO;
                shipping: typeof ZERO;
                items: typeof cart.items;
              }
            >();
            for (const item of cart.items) {
              const product = byId.get(item.productId)!;
              const group =
                groups.get(product.sellerId) ??
                {
                  sellerId: product.sellerId,
                  sellerName: product.seller.storeName,
                  subtotal: ZERO,
                  shipping: ZERO,
                  items: [],
                };
              group.subtotal = group.subtotal.plus(
                product.price.mul(item.quantity),
              );
              group.items.push(item);
              groups.set(product.sellerId, group);
            }
            for (const group of groups.values()) {
              group.shipping = shippingForSubtotal(group.subtotal);
            }

            const subtotal = addMoney(
              ...[...groups.values()].map((group) => group.subtotal),
            );
            const shippingTotal = addMoney(
              ...[...groups.values()].map((group) => group.shipping),
            );
            const grandTotal = subtotal.plus(shippingTotal);
            const orderNumber = generateOrderNumber();
            const reservationExpiresAt = new Date(
              Date.now() +
                (Number(process.env.RESERVATION_TTL_MINUTES ?? 15) || 15) *
                  60 *
                  1000,
            );

            const order = await tx.order.create({
              data: {
                orderNumber,
                customerId: userId,
                subtotal,
                shippingTotal,
                discountTotal: ZERO,
                grandTotal,
                currency: 'INR',
                orderStatus: 'PENDING_PAYMENT',
                paymentStatus: 'PENDING',
                shippingAddressSnapshot: snapshot,
                billingAddressSnapshot: snapshot,
                reservationExpiresAt,
              },
            });

            for (const group of groups.values()) {
              const sellerOrder = await tx.sellerOrder.create({
                data: {
                  orderId: order.id,
                  sellerId: group.sellerId,
                  subtotal: group.subtotal,
                  shippingAmount: group.shipping,
                  status: 'PENDING_PAYMENT',
                },
              });
              for (const item of group.items) {
                const product = byId.get(item.productId)!;
                await tx.orderItem.create({
                  data: {
                    sellerOrderId: sellerOrder.id,
                    productId: product.id,
                    productNameSnapshot: product.name,
                    skuSnapshot: product.sku,
                    unitPriceSnapshot: product.price,
                    quantity: item.quantity,
                    lineTotal: product.price.mul(item.quantity),
                  },
                });
                await tx.product.update({
                  where: { id: product.id },
                  data: { reservedStock: { increment: item.quantity } },
                });
                await tx.inventoryMovement.create({
                  data: {
                    productId: product.id,
                    sellerId: group.sellerId,
                    orderId: order.id,
                    movementType: 'STOCK_RESERVED',
                    quantity: item.quantity,
                    reference: `Reserved for ${orderNumber}`,
                  },
                });
              }
              await tx.notification.create({
                data: {
                  userId: (
                    await tx.sellerProfile.findUniqueOrThrow({
                      where: { id: group.sellerId },
                      select: { userId: true },
                    })
                  ).userId,
                  type: 'ORDER_PLACED',
                  title: 'New order received',
                  message: `A customer placed an order worth â‚¹${group.subtotal
                    .plus(group.shipping)
                    .toFixed(2)} in ${group.sellerName}. It is awaiting payment confirmation.`,
                  link: `/seller/orders/`,
                },
              });
            }

            const paymentReference = generatePaymentReference();
            const payment = await tx.payment.create({
              data: {
                orderId: order.id,
                paymentReference,
                provider: 'SIMULATED',
                method: 'DEMO',
                amount: grandTotal,
                currency: 'INR',
                status: 'PENDING',
                idempotencyKey: `checkout:${order.id}`,
              },
            });
            await tx.paymentEvent.create({
              data: {
                paymentId: payment.id,
                eventType: 'PAYMENT_INITIATED',
                details: {
                  simulated: true,
                  orderId: order.id,
                  amount: grandTotal.toFixed(2),
                  currency: 'INR',
                  note: 'Demo payment only. No real money will be charged.',
                },
              },
            });

            await tx.cart.update({
              where: { id: cart.id },
              data: { status: 'CHECKED_OUT' },
            });

            await tx.notification.create({
              data: {
                userId,
                type: 'ORDER_PLACED',
                title: 'Checkout created',
                message: `Order ${orderNumber} is awaiting demo payment. Stock is reserved for a limited time.`,
                link: `/payment/?id=${payment.id}`,
              },
            });

            const response: CheckoutSummary = {
              orderId: order.id,
              orderNumber,
              paymentId: payment.id,
              paymentReference,
              grandTotal: money(grandTotal),
              currency: 'INR',
              reservationExpiresAt: reservationExpiresAt.toISOString(),
              sellerOrderCount: groups.size,
            };

            if (key) {
              await tx.idempotencyRecord.create({
                data: {
                  userId,
                  scope: 'CHECKOUT',
                  key,
                  orderId: order.id,
                  paymentId: payment.id,
                  responseJson: response as unknown as Prisma.InputJsonValue,
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
        const replay = await this.findIdempotent(userId, key);
        if (replay) return { ...replay, idempotent: true };
      }
      throw error;
    }

    return summary;
  }

  async getCheckout(userId: string, orderId: string) {
    await this.inventoryService.expireOrder(orderId);
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, customerId: userId },
      include: orderInclude,
    });
    if (!order) throw new NotFoundException('Checkout not found');
    return presentOrder(order, 'customer');
  }

  private async findIdempotent(
    userId: string,
    key: string,
  ): Promise<CheckoutSummary | null> {
    const record = await this.prisma.idempotencyRecord.findUnique({
      where: { userId_scope_key: { userId, scope: 'CHECKOUT', key } },
    });
    if (!record?.responseJson) return null;
    return record.responseJson as unknown as CheckoutSummary;
  }
}

function generateOrderNumber(): string {
  const now = new Date();
  const date = `${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, '0')}${String(now.getUTCDate()).padStart(2, '0')}`;
  return `MH-${date}-${randomBytes(4).toString('hex').toUpperCase()}`;
}

function generatePaymentReference(): string {
  return `PAY-${Date.now().toString(36).toUpperCase()}-${randomBytes(3).toString('hex').toUpperCase()}`;
}

