import type { Prisma } from '../generated/prisma/client';
import { money, orderTimeline } from '../common/utils/money.util';

export const orderInclude = {
  customer: {
    select: { id: true, name: true, email: true, phone: true, createdAt: true },
  },
  payment: {
    include: {
      events: { orderBy: { createdAt: 'desc' }, take: 25 },
    },
  },
  sellerOrders: {
    orderBy: { createdAt: 'asc' },
    include: {
      seller: {
        select: {
          id: true,
          storeName: true,
          storeSlug: true,
          logoUrl: true,
          businessContact: true,
        },
      },
      items: {
        include: {
          product: {
            select: { id: true, name: true, slug: true, imageUrl: true, status: true },
          },
          reviews: { select: { id: true, customerId: true, rating: true } },
        },
      },
    },
  },
} satisfies Prisma.OrderInclude;

export type FullOrder = Prisma.OrderGetPayload<{ include: typeof orderInclude }>;
export type Viewer = 'customer' | 'seller' | 'admin';

export function presentOrder(order: FullOrder, viewer: Viewer) {
  const sellerOrders = order.sellerOrders.map((sellerOrder) => ({
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
      canReview:
        viewer === 'customer' &&
        sellerOrder.status === 'DELIVERED' &&
        item.reviews.length === 0,
      myReview:
        viewer === 'customer'
          ? item.reviews.find((review) => review.customerId === order.customerId) ?? null
          : null,
    })),
  }));

  const shipped = order.sellerOrders.some((sellerOrder) =>
    ['SHIPPED', 'DELIVERED'].includes(sellerOrder.status),
  );
  const canCancel =
    viewer === 'customer' &&
    (order.orderStatus === 'PENDING_PAYMENT' ||
      ((order.orderStatus === 'PAID' || order.orderStatus === 'PROCESSING') && !shipped));

  return {
    id: order.id,
    orderNumber: order.orderNumber,
    orderStatus: order.orderStatus,
    paymentStatus: order.paymentStatus,
    currency: order.currency,
    subtotal: money(order.subtotal),
    shippingTotal: money(order.shippingTotal),
    discountTotal: money(order.discountTotal),
    grandTotal: money(order.grandTotal),
    shippingAddress: order.shippingAddressSnapshot,
    billingAddress: order.billingAddressSnapshot,
    reservationExpiresAt: order.reservationExpiresAt,
    paidAt: order.paidAt,
    cancelledAt: order.cancelledAt,
    cancellationReason: order.cancellationReason,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
    canCancel,
    customer: viewer === 'customer' ? undefined : order.customer,
    payment: order.payment
      ? {
          id: order.payment.id,
          paymentReference: order.payment.paymentReference,
          provider: order.payment.provider,
          method: order.payment.method,
          amount: money(order.payment.amount),
          currency: order.payment.currency,
          status: order.payment.status,
          createdAt: order.payment.createdAt,
          events:
            viewer === 'customer'
              ? order.payment.events.map((event) => ({
                  id: event.id,
                  eventType: event.eventType,
                  details: event.details,
                  createdAt: event.createdAt,
                }))
              : order.payment.events,
        }
      : null,
    sellerOrders,
    timeline: orderTimeline(order),
  };
}
