'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useMemo, useState } from 'react';
import { CreditCard, RefreshCw, Search } from 'lucide-react';
import { useApiData } from '../../../lib/useApi';
import type { AdminPayment, Paginated } from '../../../lib/types';
import { formatDateTime, formatMoney } from '../../../lib/format';
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
  { value: '', label: 'All payment states' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'SUCCEEDED', label: 'Succeeded' },
  { value: 'FAILED', label: 'Failed' },
  { value: 'CANCELLED', label: 'Cancelled' },
  { value: 'REFUNDED', label: 'Refunded' },
];

function PaymentsView() {
  const params = useSearchParams();
  const q = params.get('q') ?? '';
  const status = params.get('status') ?? '';
  const page = Math.max(1, Number(params.get('page') ?? '1') || 1);
  const [search, setSearch] = useState(q);

  const path = useMemo(() => {
    const searchParams = new URLSearchParams();
    searchParams.set('page', String(page));
    searchParams.set('pageSize', '15');
    if (q) searchParams.set('q', q);
    if (status) searchParams.set('status', status);
    return `/admin/payments?${searchParams.toString()}`;
  }, [page, q, status]);

  const payments = useApiData<Paginated<AdminPayment>>(path);

  function navigate(next: Record<string, string | null>, resetPage = true) {
    const searchParams = new URLSearchParams(params.toString());
    if (resetPage) searchParams.delete('page');
    for (const [key, value] of Object.entries(next)) {
      if (!value) searchParams.delete(key);
      else searchParams.set(key, value);
    }
    const query = searchParams.toString();
    window.location.href = query ? `/admin/payments/?${query}` : '/admin/payments/';
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-violet-700">Commerce</p>
          <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-navy">Simulated payments</h1>
          <p className="mt-1 text-sm text-slate-500">
            Every demo payment, its immutable event count and the order it belongs to. No real money
            is processed.
          </p>
        </div>
        <Button
          size="sm"
          variant="ghost"
          icon={<RefreshCw className="h-4 w-4" />}
          onClick={() => payments.reload()}
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
            placeholder="Search payment reference, order or customer email"
            className="pl-9"
            aria-label="Search payments"
          />
        </form>
        <Select
          value={status}
          onChange={(event) => navigate({ status: event.target.value || null })}
          className="sm:w-48"
          aria-label="Filter payments by status"
        >
          {STATUSES.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
      </div>

      {payments.error ? (
        <ErrorState message={payments.error} onRetry={payments.reload} />
      ) : payments.loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, index) => (
            <Skeleton key={index} className="h-16 w-full rounded-2xl" />
          ))}
        </div>
      ) : (payments.data?.items.length ?? 0) === 0 ? (
        <EmptyState
          icon={<CreditCard className="h-5 w-5" />}
          title={q || status ? 'No payments match these filters' : 'No payments yet'}
          description="When a customer starts checkout, a simulated payment intent is created and appears here."
          action={
            q || status ? (
              <Button variant="secondary" onClick={() => navigate({ q: null, status: null })}>
                Clear filters
              </Button>
            ) : (
              <ButtonLink href="/admin/orders/" variant="secondary">
                View orders
              </ButtonLink>
            )
          }
        />
      ) : (
        <>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Reference</th>
                  <th>Order</th>
                  <th>Customer</th>
                  <th>Amount</th>
                  <th>State</th>
                  <th>Events</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {payments.data?.items.map((payment) => (
                  <tr key={payment.id}>
                    <td>
                      <p className="font-mono text-xs font-semibold text-navy">
                        {payment.paymentReference}
                      </p>
                      <p className="text-[11px] text-slate-500">
                        {payment.provider} · {payment.method}
                      </p>
                    </td>
                    <td>
                      <Link
                        href={`/admin/orders/?q=${encodeURIComponent(payment.order.orderNumber)}`}
                        className="text-sm font-semibold text-indigo-600 hover:text-indigo-800"
                      >
                        {payment.order.orderNumber}
                      </Link>
                      <div className="mt-0.5">
                        <StatusBadge status={payment.order.orderStatus} />
                      </div>
                    </td>
                    <td>
                      <p className="text-sm text-slate-800">{payment.order.customer.name}</p>
                      <p className="text-[11px] text-slate-500">{payment.order.customer.email}</p>
                    </td>
                    <td>
                      <p className="text-sm font-extrabold text-navy">
                        {formatMoney(payment.amount)}
                      </p>
                      <p className="text-[10px] text-slate-400">{payment.currency}</p>
                    </td>
                    <td>
                      <StatusBadge status={payment.status} type="payment" />
                      {payment.simulated ? (
                        <Badge tone="amber" className="mt-1">
                          Simulated
                        </Badge>
                      ) : null}
                    </td>
                    <td>
                      <span className="text-xs font-semibold text-slate-700">
                        {payment.eventCount}
                      </span>
                      <p className="text-[10px] text-slate-400">immutable events</p>
                    </td>
                    <td>
                      <p className="text-xs text-slate-600">{formatDateTime(payment.createdAt)}</p>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination
            page={payments.data?.meta.page ?? page}
            totalPages={payments.data?.meta.totalPages ?? 1}
            total={payments.data?.meta.total}
            onChange={(next) => navigate({ page: String(next) }, false)}
          />
        </>
      )}

      <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[11px] leading-5 text-amber-900">
        All payments are simulated in this demo marketplace. Payment events are appended to an
        immutable ledger and can never be edited, only superseded by later events.
      </p>
    </div>
  );
}

export default function AdminPaymentsPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-3">
          <Skeleton className="h-16 w-full rounded-2xl" />
          <Skeleton className="h-64 w-full rounded-2xl" />
        </div>
      }
    >
      <PaymentsView />
    </Suspense>
  );
}
