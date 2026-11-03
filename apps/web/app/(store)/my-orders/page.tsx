'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useMemo, useState } from 'react';
import {
  ChevronRight,
  Clock,
  Package,
  RefreshCw,
  ShoppingBag,
  Truck,
} from 'lucide-react';
import { useAuth } from '../../../lib/auth';
import { useApiData } from '../../../lib/useApi';
import type { CustomerAnalytics, Order, Paginated } from '../../../lib/types';
import { formatDate, formatMoney, statusLabel } from '../../../lib/format';
import {
  Button,
  ButtonLink,
  Badge,
  EmptyState,
  ErrorState,
  Pagination,
  Select,
  Skeleton,
  StatusBadge,
  StatCard,
} from '../../../components/ui';
import { cn } from '../../../lib/utils';

const FILTERS = [
  { value: '', label: 'All orders' },
  { value: 'PENDING_PAYMENT', label: 'Awaiting payment' },
  { value: 'PAID', label: 'Paid' },
  { value: 'PROCESSING', label: 'Processing' },
  { value: 'SHIPPED', label: 'Shipped' },
  { value: 'DELIVERED', label: 'Delivered' },
  { value: 'CANCELLED', label: 'Cancelled' },
];

function MyOrdersView() {
  const params = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const status = params.get('status') ?? '';
  const page = Math.max(1, Number(params.get('page') ?? '1') || 1);
  const [selectedStatus, setSelectedStatus] = useState(status);

  const query = useMemo(() => {
    const search = new URLSearchParams();
    search.set('page', String(page));
    search.set('pageSize', '10');
    if (status) search.set('status', status);
    return `/orders/me?${search.toString()}`;
  }, [page, status]);

  const orders = useApiData<Paginated<Order>>(user?.role === 'CUSTOMER' ? query : null);
  const analytics = useApiData<CustomerAnalytics>(
    user?.role === 'CUSTOMER' ? '/analytics/customer' : null,
  );

  if (authLoading) {
    return (
      <div className="container-hub space-y-4 py-10">
        <Skeleton className="h-10 w-60" />
        <Skeleton className="h-32 w-full rounded-2xl" />
        <Skeleton className="h-32 w-full rounded-2xl" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="container-hub py-16">
        <EmptyState
          icon={<Package className="h-5 w-5" />}
          title="Sign in to see your orders"
          description="Order history, tracking and reviews are tied to your customer account."
          action={
            <ButtonLink href="/login/?next=%2Fmy-orders%2F">Sign in</ButtonLink>
          }
        />
      </div>
    );
  }

  if (user.role !== 'CUSTOMER') {
    return (
      <div className="container-hub py-16">
        <EmptyState
          icon={<ShoppingBag className="h-5 w-5" />}
          title="Customer orders live here"
          description="You are signed in with a seller or administrator account. Open your dashboard to manage the marketplace."
          action={
            <ButtonLink href={user.role === 'SELLER' ? '/seller/' : '/admin/'}>
              Go to dashboard
            </ButtonLink>
          }
        />
      </div>
    );
  }

  return (
    <div className="container-hub py-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-indigo-600">
            Your account
          </p>
          <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-navy sm:text-3xl">
            My orders
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Every purchase, split by seller, with live fulfilment status.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select
            value={selectedStatus}
            onChange={(event) => {
              setSelectedStatus(event.target.value);
              const search = new URLSearchParams();
              if (event.target.value) search.set('status', event.target.value);
              window.location.href = search.toString()
                ? `/my-orders/?${search.toString()}`
                : '/my-orders/';
            }}
            className="h-10 w-auto text-xs"
            aria-label="Filter orders by status"
          >
            {FILTERS.map((filter) => (
              <option key={filter.value} value={filter.value}>
                {filter.label}
              </option>
            ))}
          </Select>
          <Button
            variant="secondary"
            size="sm"
            icon={<RefreshCw className="h-4 w-4" />}
            onClick={() => orders.reload()}
          >
            Refresh
          </Button>
        </div>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total orders"
          value={analytics.data?.orderCount ?? '—'}
          icon={<Package className="h-5 w-5" />}
        />
        <StatCard
          label="Delivered"
          value={analytics.data?.delivered ?? '—'}
          tone="teal"
          icon={<Truck className="h-5 w-5" />}
        />
        <StatCard
          label="Awaiting payment"
          value={analytics.data?.pendingPayment ?? '—'}
          tone="amber"
          icon={<Clock className="h-5 w-5" />}
        />
        <StatCard
          label="Simulated spend"
          value={analytics.data ? formatMoney(analytics.data.simulatedSpend) : '—'}
          tone="violet"
          icon={<ShoppingBag className="h-5 w-5" />}
        />
      </div>

      <div className="mt-6">
        {orders.error ? (
          <ErrorState message={orders.error} onRetry={orders.reload} />
        ) : orders.loading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <Skeleton key={index} className="h-32 w-full rounded-2xl" />
            ))}
          </div>
        ) : (orders.data?.items.length ?? 0) === 0 ? (
          <EmptyState
            icon={<Package className="h-5 w-5" />}
            title={status ? 'No orders with this status' : 'No orders yet'}
            description="When you place an order it will appear here with per-seller tracking."
            action={<ButtonLink href="/products/">Start shopping</ButtonLink>}
          />
        ) : (
          <>
            <div className="space-y-3">
              {orders.data?.items.map((order) => (
                <article key={order.id} className="card overflow-hidden">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-slate-50/60 px-4 py-3">
                    <div className="flex flex-wrap items-center gap-3">
                      <div>
                        <p className="text-sm font-bold text-navy">{order.orderNumber}</p>
                        <p className="text-[11px] text-slate-500">
                          Placed {formatDate(order.createdAt)} ·{' '}
                          {order.sellerOrders.length} seller
                          {order.sellerOrders.length === 1 ? '' : 's'}
                        </p>
                      </div>
                      <StatusBadge status={order.orderStatus} />
                      <StatusBadge status={order.paymentStatus} type="payment" />
                    </div>
                    <div className="text-right">
                      <p className="text-base font-extrabold text-navy">
                        {formatMoney(order.grandTotal)}
                      </p>
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                        Simulated
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      {order.sellerOrders.map((sellerOrder) => (
                        <span
                          key={sellerOrder.id}
                          className={cn(
                            'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ring-inset',
                            sellerOrder.status === 'DELIVERED'
                              ? 'bg-teal-50 text-teal-700 ring-teal-200'
                              : sellerOrder.status === 'SHIPPED'
                                ? 'bg-violet-50 text-violet-700 ring-violet-200'
                                : sellerOrder.status === 'CANCELLED'
                                  ? 'bg-slate-100 text-slate-600 ring-slate-200'
                                  : 'bg-indigo-50 text-indigo-700 ring-indigo-200',
                          )}
                        >
                          {sellerOrder.seller.storeName}
                          <span className="font-normal opacity-70">
                            · {statusLabel(sellerOrder.status)}
                          </span>
                        </span>
                      ))}
                    </div>
                    <div className="flex items-center gap-2">
                      {order.orderStatus === 'PENDING_PAYMENT' && order.payment ? (
                        <ButtonLink
                          href={`/payment/?id=${order.payment.id}`}
                          size="sm"
                        >
                          Pay now
                        </ButtonLink>
                      ) : null}
                      <ButtonLink
                        href={`/order/?id=${order.id}`}
                        size="sm"
                        variant="secondary"
                        icon={<ChevronRight className="h-3.5 w-3.5" />}
                      >
                        Details
                      </ButtonLink>
                    </div>
                  </div>
                </article>
              ))}
            </div>
            <Pagination
              page={orders.data?.meta.page ?? page}
              totalPages={orders.data?.meta.totalPages ?? 1}
              total={orders.data?.meta.total}
              onChange={(next) => {
                const search = new URLSearchParams();
                if (status) search.set('status', status);
                if (next > 1) search.set('page', String(next));
                window.location.href = search.toString()
                  ? `/my-orders/?${search.toString()}`
                  : '/my-orders/';
              }}
            />
          </>
        )}
      </div>
    </div>
  );
}

export default function MyOrdersPage() {
  return (
    <Suspense
      fallback={
        <div className="container-hub py-10">
          <Skeleton className="h-40 w-full rounded-2xl" />
        </div>
      }
    >
      <MyOrdersView />
    </Suspense>
  );
}
