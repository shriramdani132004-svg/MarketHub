'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense, useMemo, useState } from 'react';
import {
  ClipboardList,
  Eye,
  RefreshCw,
  Search,
  ShieldAlert,
  XCircle,
} from 'lucide-react';
import { useApiData } from '../../../lib/useApi';
import { api, errorMessage } from '../../../lib/api';
import type { Order, Paginated } from '../../../lib/types';
import { formatDateTime, formatMoney, statusLabel } from '../../../lib/format';
import {
  Button,
  ButtonLink,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  Input,
  Modal,
  Pagination,
  Select,
  Skeleton,
  StatusBadge,
} from '../../../components/ui';
import { useToast } from '../../../components/ui/toast';

const STATUSES = [
  { value: '', label: 'All order statuses' },
  { value: 'PENDING_PAYMENT', label: 'Awaiting payment' },
  { value: 'PAID', label: 'Paid' },
  { value: 'PROCESSING', label: 'Processing' },
  { value: 'PARTIALLY_SHIPPED', label: 'Partially shipped' },
  { value: 'SHIPPED', label: 'Shipped' },
  { value: 'PARTIALLY_DELIVERED', label: 'Partially delivered' },
  { value: 'DELIVERED', label: 'Delivered' },
  { value: 'CANCELLED', label: 'Cancelled' },
];

const PAYMENT_STATUSES = [
  { value: '', label: 'All payment states' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'SUCCEEDED', label: 'Succeeded' },
  { value: 'FAILED', label: 'Failed' },
  { value: 'CANCELLED', label: 'Cancelled' },
  { value: 'REFUNDED', label: 'Refunded' },
];

function OrdersView() {
  const params = useSearchParams();
  const toast = useToast();
  const q = params.get('q') ?? '';
  const status = params.get('status') ?? '';
  const paymentStatus = params.get('paymentStatus') ?? '';
  const page = Math.max(1, Number(params.get('page') ?? '1') || 1);
  const [search, setSearch] = useState(q);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const path = useMemo(() => {
    const searchParams = new URLSearchParams();
    searchParams.set('page', String(page));
    searchParams.set('pageSize', '12');
    if (q) searchParams.set('q', q);
    if (status) searchParams.set('status', status);
    if (paymentStatus) searchParams.set('paymentStatus', paymentStatus);
    return `/admin/orders?${searchParams.toString()}`;
  }, [page, q, status, paymentStatus]);

  const orders = useApiData<Paginated<Order>>(path);

  function navigate(next: Record<string, string | null>, resetPage = true) {
    const searchParams = new URLSearchParams(params.toString());
    if (resetPage) searchParams.delete('page');
    for (const [key, value] of Object.entries(next)) {
      if (!value) searchParams.delete(key);
      else searchParams.set(key, value);
    }
    const query = searchParams.toString();
    window.location.href = query ? `/admin/orders/?${query}` : '/admin/orders/';
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-violet-700">Commerce</p>
          <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-navy">Orders</h1>
          <p className="mt-1 text-sm text-slate-500">
            Every multi-vendor order with its seller groups, payment state and fulfilment timeline.
          </p>
        </div>
        <Button
          size="sm"
          variant="ghost"
          icon={<RefreshCw className="h-4 w-4" />}
          onClick={() => orders.reload()}
        >
          Refresh
        </Button>
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
            placeholder="Search order number, customer name or email"
            className="pl-9"
            aria-label="Search orders"
          />
        </form>
        <Select
          value={status}
          onChange={(event) => navigate({ status: event.target.value || null })}
          className="sm:w-48"
          aria-label="Filter by order status"
        >
          {STATUSES.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
        <Select
          value={paymentStatus}
          onChange={(event) => navigate({ paymentStatus: event.target.value || null })}
          className="sm:w-44"
          aria-label="Filter by payment state"
        >
          {PAYMENT_STATUSES.map((option) => (
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
          title={q || status || paymentStatus ? 'No orders match these filters' : 'No orders yet'}
          description={
            q || status || paymentStatus
              ? 'Try clearing the search or filters to see every order.'
              : 'Customer checkouts appear here, split into one fulfilment group per seller.'
          }
          action={
            q || status || paymentStatus ? (
              <Button
                variant="secondary"
                onClick={() => navigate({ q: null, status: null, paymentStatus: null })}
              >
                Clear filters
              </Button>
            ) : (
              <ButtonLink href="/admin/" variant="secondary">
                Back to overview
              </ButtonLink>
            )
          }
        />
      ) : (
        <>
          <div className="space-y-2.5">
            {orders.data?.items.map((order) => (
              <article key={order.id} className="card overflow-hidden">
                <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-bold text-navy">{order.orderNumber}</p>
                      <StatusBadge status={order.orderStatus} />
                      <StatusBadge status={order.paymentStatus} type="payment" />
                    </div>
                    <p className="mt-0.5 text-[11px] text-slate-500">
                      {order.customer?.name ?? 'Customer'} · {order.customer?.email ?? '—'} ·{' '}
                      {formatDateTime(order.createdAt)} · {order.sellerOrders.length} seller group
                      {order.sellerOrders.length === 1 ? '' : 's'}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className="text-sm font-extrabold text-navy">{formatMoney(order.grandTotal)}</p>
                      <p className="text-[10px] text-slate-400">Simulated</p>
                    </div>
                    <Button
                      size="sm"
                      variant="secondary"
                      icon={<Eye className="h-3.5 w-3.5" />}
                      onClick={() => setSelectedId(order.id)}
                    >
                      Details
                    </Button>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-slate-100 bg-slate-50/50 px-4 py-2 text-[11px] text-slate-500">
                  {order.sellerOrders.map((group) => (
                    <span key={group.id} className="inline-flex items-center gap-1.5">
                      <span className="font-semibold text-slate-700">{group.seller.storeName}</span>
                      <StatusBadge status={group.status} />
                    </span>
                  ))}
                  {order.payment ? (
                    <span className="ml-auto font-mono text-[10px] text-slate-400">
                      {order.payment.paymentReference}
                    </span>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
          <Pagination
            page={orders.data?.meta.page ?? page}
            totalPages={orders.data?.meta.totalPages ?? 1}
            total={orders.data?.meta.total}
            onChange={(next) => navigate({ page: String(next) }, false)}
          />
        </>
      )}

      <OrderDetailModal
        id={selectedId}
        onClose={() => setSelectedId(null)}
        onChanged={() => {
          orders.reload();
        }}
        onToast={(message, tone) =>
          tone === 'error' ? toast.error(message) : toast.success(message)
        }
      />
    </div>
  );
}

function OrderDetailModal({
  id,
  onClose,
  onChanged,
  onToast,
}: {
  id: string | null;
  onClose: () => void;
  onChanged: () => void;
  onToast: (message: string, tone: 'success' | 'error') => void;
}) {
  const order = useApiData<Order>(id ? `/admin/orders/${id}` : null);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  async function cancel() {
    if (!id) return;
    setBusy(true);
    try {
      await api(`/admin/orders/${id}/cancel`, { method: 'POST' });
      onToast('Order cancelled. Reserved stock released and simulated refund recorded.', 'success');
      setCancelOpen(false);
      order.reload();
      onChanged();
    } catch (cause) {
      onToast(errorMessage(cause), 'error');
    } finally {
      setBusy(false);
    }
  }

  const cancellable =
    order.data &&
    (order.data.orderStatus === 'PENDING_PAYMENT' ||
      order.data.orderStatus === 'PAID' ||
      order.data.orderStatus === 'PROCESSING');

  return (
    <>
      <Modal
        open={id !== null}
        onClose={onClose}
        title="Order details"
        description={order.data?.orderNumber ?? 'Loading order…'}
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={onClose}>
              Close
            </Button>
            {cancellable ? (
              <Button
                variant="danger"
                onClick={() => setCancelOpen(true)}
                icon={<XCircle className="h-4 w-4" />}
              >
                Cancel order
              </Button>
            ) : null}
          </>
        }
      >
        {order.loading ? (
          <div className="space-y-3">
            <Skeleton className="h-24 w-full rounded-xl" />
            <Skeleton className="h-24 w-full rounded-xl" />
          </div>
        ) : order.error || !order.data ? (
          <ErrorState message={order.error ?? 'Order not found.'} onRetry={order.reload} />
        ) : (
          <div className="space-y-4">
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="rounded-xl bg-slate-50 p-3 text-xs">
                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Customer</p>
                <p className="mt-1 text-sm font-bold text-navy">{order.data.customer?.name}</p>
                <p className="text-slate-600">{order.data.customer?.email}</p>
                <p className="text-slate-600">{order.data.customer?.phone ?? 'No phone'}</p>
              </div>
              <div className="rounded-xl bg-slate-50 p-3 text-xs">
                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">
                  Delivery address
                </p>
                <p className="mt-1 font-semibold text-slate-800">
                  {order.data.shippingAddress.recipientName}
                </p>
                <p className="text-slate-600">
                  {order.data.shippingAddress.addressLine1}
                  {order.data.shippingAddress.addressLine2
                    ? `, ${order.data.shippingAddress.addressLine2}`
                    : ''}
                  <br />
                  {order.data.shippingAddress.city}, {order.data.shippingAddress.state}{' '}
                  {order.data.shippingAddress.postalCode}
                  <br />
                  {order.data.shippingAddress.country} · {order.data.shippingAddress.phone}
                </p>
              </div>
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              <Detail label="Order status" value={statusLabel(order.data.orderStatus)} />
              <Detail label="Payment status" value={statusLabel(order.data.paymentStatus)} />
              <Detail label="Placed" value={formatDateTime(order.data.createdAt)} />
              <Detail label="Paid" value={formatDateTime(order.data.paidAt)} />
              <Detail label="Subtotal" value={formatMoney(order.data.subtotal)} />
              <Detail label="Shipping" value={formatMoney(order.data.shippingTotal)} />
              <Detail label="Discount" value={formatMoney(order.data.discountTotal)} />
              <Detail label="Grand total" value={formatMoney(order.data.grandTotal)} emphasize />
            </div>

            <div>
              <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
                Seller groups
              </p>
              <div className="mt-2 space-y-2">
                {order.data.sellerOrders.map((group) => (
                  <div key={group.id} className="rounded-xl border border-slate-200 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-bold text-navy">{group.seller.storeName}</p>
                      <div className="flex items-center gap-2">
                        <StatusBadge status={group.status} />
                        <span className="text-xs font-bold text-navy">
                          {formatMoney(group.subtotal)}
                        </span>
                      </div>
                    </div>
                    <ul className="mt-2 space-y-1 text-xs text-slate-600">
                      {group.items.map((item) => (
                        <li key={item.id} className="flex items-center justify-between gap-2">
                          <span className="truncate">
                            {item.quantity} × {item.name}{' '}
                            <span className="text-slate-400">({item.sku})</span>
                          </span>
                          <span className="font-semibold text-slate-800">
                            {formatMoney(item.lineTotal)}
                          </span>
                        </li>
                      ))}
                    </ul>
                    {group.trackingReference ? (
                      <p className="mt-1.5 text-[11px] text-indigo-700">
                        Tracking: {group.trackingReference}
                      </p>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>

            {order.data.payment ? (
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
                  Payment events
                </p>
                <p className="mt-1 font-mono text-[11px] text-slate-500">
                  {order.data.payment.paymentReference} · {order.data.payment.method} ·{' '}
                  {formatMoney(order.data.payment.amount)}
                </p>
                <ul className="mt-2 space-y-1">
                  {order.data.payment.events.map((event) => (
                    <li
                      key={event.id}
                      className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-1.5 text-[11px]"
                    >
                      <span className="font-semibold text-slate-700">
                        {statusLabel(event.eventType)}
                      </span>
                      <span className="text-slate-400">{formatDateTime(event.createdAt)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            <p className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] leading-5 text-amber-900">
              <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
              Cancelling an order cancels every seller group that has not shipped, releases reserved
              stock and records a simulated refund when a demo payment had succeeded.
            </p>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={cancelOpen}
        title="Cancel this order?"
        description="This cancels all unshipped seller groups, releases reserved inventory and refunds any captured simulated payment. It cannot be undone."
        confirmLabel="Cancel order"
        loading={busy}
        onConfirm={cancel}
        onClose={() => setCancelOpen(false)}
      />
    </>
  );
}

function Detail({
  label,
  value,
  emphasize,
}: {
  label: string;
  value: string;
  emphasize?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-lg border border-slate-100 px-3 py-1.5 text-xs">
      <span className="text-slate-500">{label}</span>
      <span className={emphasize ? 'font-extrabold text-navy' : 'font-semibold text-slate-800'}>
        {value}
      </span>
    </div>
  );
}

export default function AdminOrdersPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-3">
          <Skeleton className="h-16 w-full rounded-2xl" />
          <Skeleton className="h-64 w-full rounded-2xl" />
        </div>
      }
    >
      <OrdersView />
    </Suspense>
  );
}
