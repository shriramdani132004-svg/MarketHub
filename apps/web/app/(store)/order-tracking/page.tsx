'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import {
  CheckCircle2,
  Circle,
  ExternalLink,
  MapPin,
  PackageCheck,
  Truck,
  XCircle,
} from 'lucide-react';
import { useAuth } from '../../../lib/auth';
import { useApiData } from '../../../lib/useApi';
import type { Order, SellerOrder } from '../../../lib/types';
import { formatDateTime, formatMoney } from '../../../lib/format';
import {
  ButtonLink,
  EmptyState,
  ErrorState,
  Skeleton,
  StatusBadge,
} from '../../../components/ui';
import { OrderMeta } from '../../../components/store/OrderParts';

const STEPS = [
  { key: 'PAID', label: 'Payment confirmed' },
  { key: 'PROCESSING', label: 'Preparing parcel' },
  { key: 'SHIPPED', label: 'In transit' },
  { key: 'DELIVERED', label: 'Delivered' },
];

function stepIndex(status: string): number {
  switch (status) {
    case 'PENDING_PAYMENT':
      return -1;
    case 'PAID':
      return 0;
    case 'PROCESSING':
      return 1;
    case 'SHIPPED':
      return 2;
    case 'DELIVERED':
      return 3;
    default:
      return -1;
  }
}

function TrackView() {
  const params = useSearchParams();
  const id = params.get('id');
  const { user, loading: authLoading } = useAuth();
  const order = useApiData<Order>(user && id ? `/orders/${id}` : null);

  if (authLoading || order.loading) {
    return (
      <div className="container-hub space-y-4 py-10">
        <Skeleton className="h-10 w-1/2" />
        <Skeleton className="h-32 w-full rounded-2xl" />
        <Skeleton className="h-48 w-full rounded-2xl" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="container-hub py-16">
        <EmptyState
          icon={<Truck className="h-5 w-5" />}
          title="Sign in to track this order"
          action={
            <ButtonLink
              href={`/login/?next=${encodeURIComponent(`/order-tracking/?id=${id ?? ''}`)}`}
            >
              Sign in
            </ButtonLink>
          }
        />
      </div>
    );
  }

  if (!id || order.error || !order.data) {
    return (
      <div className="container-hub py-16">
        <ErrorState
          message={order.error ?? 'Select an order to track it.'}
          onRetry={order.reload}
        />
        <div className="mt-6 text-center">
          <ButtonLink href="/my-orders/" variant="secondary">
            My orders
          </ButtonLink>
        </div>
      </div>
    );
  }

  const data = order.data;
  const deliveredCount = data.sellerOrders.filter((so) => so.status === 'DELIVERED').length;
  const shippedCount = data.sellerOrders.filter((so) =>
    ['SHIPPED', 'DELIVERED'].includes(so.status),
  ).length;
  const progress =
    data.orderStatus === 'CANCELLED'
      ? 0
      : Math.round((shippedCount / Math.max(1, data.sellerOrders.length)) * 100);

  return (
    <div className="container-hub py-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-indigo-600">
            Tracking
          </p>
          <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-navy sm:text-3xl">
            Order {data.orderNumber}
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            {deliveredCount} of {data.sellerOrders.length} parcels delivered ·{' '}
            {shippedCount} dispatched
          </p>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status={data.orderStatus} />
          <StatusBadge status={data.paymentStatus} type="payment" />
        </div>
      </div>

      <div className="mt-5 card p-4">
        <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
          <span>Shipment progress</span>
          <span>{progress}%</span>
        </div>
        <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-slate-100">
          <div
            className={`h-full rounded-full transition-all ${
              data.orderStatus === 'CANCELLED' ? 'bg-slate-400' : 'bg-gradient-to-r from-indigo-500 to-teal-500'
            }`}
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="mt-4">
          <OrderMeta order={data} />
        </div>
      </div>

      {data.orderStatus === 'CANCELLED' ? (
        <div className="mt-4 flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
          <XCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <p>
            This order was cancelled{data.cancelledAt ? ` on ${formatDateTime(data.cancelledAt)}` : ''}.
            Reserved stock has been released.
          </p>
        </div>
      ) : null}

      <div className="mt-6 space-y-4">
        {data.sellerOrders.map((sellerOrder) => (
          <SellerTrackingCard key={sellerOrder.id} sellerOrder={sellerOrder} />
        ))}
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <div className="card p-5">
          <h2 className="flex items-center gap-2 text-sm font-bold text-navy">
            <MapPin className="h-4 w-4 text-indigo-600" aria-hidden />
            Delivery address
          </h2>
          <p className="mt-2 text-sm font-bold text-slate-800">
            {data.shippingAddress.recipientName}
          </p>
          <p className="mt-1 text-xs leading-5 text-slate-600">
            {data.shippingAddress.addressLine1}
            {data.shippingAddress.addressLine2 ? `, ${data.shippingAddress.addressLine2}` : ''}
            <br />
            {data.shippingAddress.city}, {data.shippingAddress.state}{' '}
            {data.shippingAddress.postalCode}
            <br />
            {data.shippingAddress.country} · {data.shippingAddress.phone}
          </p>
        </div>
        <div className="card p-5">
          <h2 className="flex items-center gap-2 text-sm font-bold text-navy">
            <PackageCheck className="h-4 w-4 text-teal-600" aria-hidden />
            Need help?
          </h2>
          <p className="mt-2 text-xs leading-5 text-slate-600">
            Each seller owns their own parcel. Contact the store using the details on your order,
            or open the order to review items and request a cancellation before dispatch.
          </p>
          <div className="mt-3 flex gap-2">
            <ButtonLink href={`/order/?id=${data.id}`} size="sm" variant="secondary">
              Order details
            </ButtonLink>
            <ButtonLink href="/my-orders/" size="sm" variant="ghost">
              All orders
            </ButtonLink>
          </div>
        </div>
      </div>
    </div>
  );
}

function SellerTrackingCard({ sellerOrder }: { sellerOrder: SellerOrder }) {
  const current = stepIndex(sellerOrder.status);
  const cancelled = sellerOrder.status === 'CANCELLED';
  const itemCount = sellerOrder.items.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <section className="card overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-slate-50/60 px-4 py-3">
        <div className="flex items-center gap-2">
          <Link
            href={`/search/?seller=${sellerOrder.seller.storeSlug}`}
            className="text-sm font-bold text-navy hover:text-indigo-700"
          >
            {sellerOrder.seller.storeName}
          </Link>
          <StatusBadge status={sellerOrder.status} />
        </div>
        <p className="text-xs text-slate-500">
          {itemCount} item{itemCount === 1 ? '' : 's'} · {formatMoney(sellerOrder.subtotal)}
        </p>
      </div>

      <div className="p-4">
        {cancelled ? (
          <div className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600">
            <XCircle className="h-4 w-4" aria-hidden />
            This seller group was cancelled and never shipped.
          </div>
        ) : (
          <ol className="grid gap-3 sm:grid-cols-4">
            {STEPS.map((step, index) => {
              const reached = index <= current;
              const active = index === current;
              return (
                <li key={step.key} className="relative">
                  <div className="flex items-center gap-2">
                    <span
                      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
                        reached
                          ? active
                            ? 'bg-indigo-600 text-white'
                            : 'bg-teal-600 text-white'
                          : 'bg-slate-100 text-slate-400'
                      }`}
                    >
                      {reached ? (
                        <CheckCircle2 className="h-4 w-4" aria-hidden />
                      ) : (
                        <Circle className="h-3 w-3" aria-hidden />
                      )}
                    </span>
                    <p
                      className={`text-xs font-bold ${
                        reached ? 'text-navy' : 'text-slate-400'
                      }`}
                    >
                      {step.label}
                    </p>
                  </div>
                  <p className="ml-9 mt-0.5 text-[10px] text-slate-400">
                    {step.key === 'SHIPPED' && sellerOrder.shippedAt
                      ? formatDateTime(sellerOrder.shippedAt)
                      : step.key === 'DELIVERED' && sellerOrder.deliveredAt
                        ? formatDateTime(sellerOrder.deliveredAt)
                        : step.key === 'PAID'
                          ? 'Simulated payment'
                          : reached
                            ? 'Completed'
                            : 'Pending'}
                  </p>
                </li>
              );
            })}
          </ol>
        )}

        {sellerOrder.trackingReference || sellerOrder.trackingUrl ? (
          <div className="mt-4 flex flex-wrap items-center gap-2 rounded-lg border border-indigo-100 bg-indigo-50/60 px-3 py-2 text-xs">
            <Truck className="h-4 w-4 text-indigo-600" aria-hidden />
            <span className="font-semibold text-indigo-900">
              {sellerOrder.trackingReference ?? 'Tracking link'}
            </span>
            {sellerOrder.trackingUrl ? (
              <a
                href={sellerOrder.trackingUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 font-bold text-indigo-700 hover:underline"
              >
                Open carrier page <ExternalLink className="h-3 w-3" aria-hidden />
              </a>
            ) : null}
          </div>
        ) : sellerOrder.status !== 'CANCELLED' ? (
          <p className="mt-4 text-[11px] text-slate-500">
            Tracking details appear here once the seller dispatches this parcel.
          </p>
        ) : null}
      </div>
    </section>
  );
}

export default function OrderTrackingPage() {
  return (
    <Suspense
      fallback={
        <div className="container-hub py-10">
          <Skeleton className="h-40 w-full rounded-2xl" />
        </div>
      }
    >
      <TrackView />
    </Suspense>
  );
}
