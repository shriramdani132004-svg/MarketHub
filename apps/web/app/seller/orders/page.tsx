'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useMemo, useState } from 'react';
import { ClipboardList, Search, Truck } from 'lucide-react';
import { useApiData } from '../../../lib/useApi';
import type { Paginated, SellerOrderGroup } from '../../../lib/types';
import { formatDateTime, formatMoney, statusLabel } from '../../../lib/format';
import {
  Badge,
  Button,
  ButtonLink,
  EmptyState,
  ErrorState,
  Input,
  Pagination,
  Select,
  Skeleton,
  StatusBadge,
} from '../../../components/ui';

const STATUSES = [
  { value: '', label: 'All groups' },
  { value: 'PENDING_PAYMENT', label: 'Awaiting payment' },
  { value: 'PAID', label: 'Paid' },
  { value: 'PROCESSING', label: 'Processing' },
  { value: 'SHIPPED', label: 'Shipped' },
  { value: 'DELIVERED', label: 'Delivered' },
  { value: 'CANCELLED', label: 'Cancelled' },
];

function SellerOrdersView() {
  const params = useSearchParams();
  const status = params.get('status') ?? '';
  const q = params.get('q') ?? '';
  const page = Math.max(1, Number(params.get('page') ?? '1') || 1);
  const [search, setSearch] = useState(q);

  const path = useMemo(() => {
    const searchParams = new URLSearchParams();
    searchParams.set('page', String(page));
    searchParams.set('pageSize', '12');
    if (status) searchParams.set('status', status);
    if (q) searchParams.set('q', q);
    return `/seller/orders?${searchParams.toString()}`;
  }, [page, status, q]);

  const orders = useApiData<Paginated<SellerOrderGroup>>(path);

  function navigate(next: Record<string, string | null>, resetPage = true) {
    const searchParams = new URLSearchParams(params.toString());
    if (resetPage) searchParams.delete('page');
    for (const [key, value] of Object.entries(next)) {
      if (!value) searchParams.delete(key);
      else searchParams.set(key, value);
    }
    const query = searchParams.toString();
    window.location.href = query ? `/seller/orders/?${query}` : '/seller/orders/';
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-teal-700">Fulfilment</p>
          <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-navy">Seller orders</h1>
          <p className="mt-1 text-sm text-slate-500">
            Only your parcel of each multi-vendor order appears here.
          </p>
        </div>
        <div className="flex gap-2">
          <ButtonLink href="/seller/orders/?status=PAID" size="sm" variant="secondary">
            New paid
          </ButtonLink>
          <ButtonLink href="/seller/orders/?status=PROCESSING" size="sm" variant="secondary" icon={<Truck className="h-3.5 w-3.5" />}>
            Processing
          </ButtonLink>
        </div>
      </div>

      <div className="card flex flex-col gap-2 p-3.5 sm:flex-row sm:items-center">
        <form
          className="relative flex-1"
          onSubmit={(event) => {
            event.preventDefault();
            navigate({ q: search.trim() || null });
          }}
          role="search"
        >
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search order number or customer"
            className="pl-9"
            aria-label="Search orders"
          />
        </form>
        <Select
          value={status}
          onChange={(event) => navigate({ status: event.target.value || null })}
          className="sm:w-48"
          aria-label="Filter orders by status"
        >
          {STATUSES.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
      </div>

      {orders.error ? (
        <ErrorState message={orders.error} onRetry={orders.reload} />
      ) : orders.loading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-24 w-full rounded-2xl" />
          ))}
        </div>
      ) : (orders.data?.items.length ?? 0) === 0 ? (
        <EmptyState
          icon={<ClipboardList className="h-5 w-5" />}
          title={status || q ? 'No matching order groups' : 'No seller orders yet'}
          description={
            status || q
              ? 'Try another status or clear the search.'
              : 'When a customer pays for one of your products, their parcel appears here.'
          }
          action={
            status || q ? (
              <Button variant="secondary" onClick={() => navigate({ status: null, q: null })}>
                Clear filters
              </Button>
            ) : (
              <ButtonLink href="/seller/products/">Manage products</ButtonLink>
            )
          }
        />
      ) : (
        <>
          <div className="space-y-2.5">
            {orders.data?.items.map((order) => {
              const units = order.items.reduce((sum, item) => sum + item.quantity, 0);
              return (
                <article key={order.id} className="card overflow-hidden">
                  <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          href={`/seller/order/?id=${order.id}`}
                          className="text-sm font-bold text-navy hover:text-indigo-700"
                        >
                          {order.order.orderNumber}
                        </Link>
                        <StatusBadge status={order.status} />
                        {order.order.orderStatus === 'CANCELLED' ? (
                          <Badge tone="slate">Buyer cancelled</Badge>
                        ) : null}
                      </div>
                      <p className="mt-0.5 text-[11px] text-slate-500">
                        {order.order.customer.name} · {formatDateTime(order.createdAt)} · {units} unit
                        {units === 1 ? '' : 's'}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className="text-sm font-extrabold text-navy">{formatMoney(order.subtotal)}</p>
                        <p className="text-[10px] text-slate-400">
                          {order.shippingAmount && Number(order.shippingAmount) > 0
                            ? `+${formatMoney(order.shippingAmount)} shipping`
                            : 'Free shipping'}
                        </p>
                      </div>
                      <ButtonLink href={`/seller/order/?id=${order.id}`} size="sm" variant="secondary">
                        Open
                      </ButtonLink>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-slate-100 bg-slate-50/50 px-4 py-2 text-[11px] text-slate-500">
                    {order.items.slice(0, 3).map((item) => (
                      <span key={item.id} className="truncate">
                        {item.quantity}× {item.name}
                      </span>
                    ))}
                    {order.items.length > 3 ? <span>+{order.items.length - 3} more</span> : null}
                    {order.trackingReference ? (
                      <span className="ml-auto font-semibold text-indigo-700">
                        Tracking {order.trackingReference}
                      </span>
                    ) : null}
                  </div>
                </article>
              );
            })}
          </div>
          <Pagination
            page={orders.data?.meta.page ?? page}
            totalPages={orders.data?.meta.totalPages ?? 1}
            total={orders.data?.meta.total}
            onChange={(next) => navigate({ page: String(next) }, false)}
          />
        </>
      )}

      <p className="text-[11px] text-slate-500">
        Order statuses are shown exactly as recorded: {STATUSES.slice(1, 6).map((s) => statusLabel(s.value)).join(' · ')}.
      </p>
    </div>
  );
}

export default function SellerOrdersPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-3">
          <Skeleton className="h-16 w-full rounded-2xl" />
          <Skeleton className="h-64 w-full rounded-2xl" />
        </div>
      }
    >
      <SellerOrdersView />
    </Suspense>
  );
}
