'use client';

import Link from 'next/link';
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Boxes,
  CheckCircle2,
  ClipboardList,
  Clock,
  Package,
  PlusCircle,
  Settings,
  Store,
  TrendingUp,
} from 'lucide-react';
import { useApiData } from '../../lib/useApi';
import type { SellerAnalytics } from '../../lib/types';
import { formatDateTime, formatMoney, relativeTime, statusLabel } from '../../lib/format';
import {
  Badge,
  ButtonLink,
  ErrorState,
  Skeleton,
  StatCard,
  StatusBadge,
} from '../../components/ui';
import { RevenueTrendChart } from '../../components/charts/Charts';

interface SellerProfile {
  id: string;
  storeName: string;
  storeSlug: string;
  description: string | null;
  logoUrl: string | null;
  businessContact: string | null;
  approvalStatus: string;
  rejectionReason: string | null;
  approvedAt: string | null;
  createdAt: string;
}

export default function SellerOverviewPage() {
  const analytics = useApiData<SellerAnalytics>('/analytics/seller');
  const profile = useApiData<SellerProfile>('/seller/profile');

  if (analytics.error) {
    return <ErrorState message={analytics.error} onRetry={analytics.reload} />;
  }

  if (analytics.loading || !analytics.data) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 w-full rounded-2xl" />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-28 w-full rounded-2xl" />
          ))}
        </div>
        <Skeleton className="h-72 w-full rounded-2xl" />
      </div>
    );
  }

  const data = analytics.data;
  const approval = data.store.approvalStatus;
  const approved = approval === 'APPROVED';

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-teal-700">
            Seller workspace
          </p>
          <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-navy">{data.store.storeName}</h1>
          <p className="mt-1 text-sm text-slate-500">
            Store slug <span className="font-semibold text-slate-700">{data.store.storeSlug}</span>
            {profile.data?.approvedAt ? ` · approved ${formatDateTime(profile.data.approvedAt)}` : ''}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge tone={approved ? 'teal' : approval === 'PENDING' ? 'amber' : 'rose'}>
            {statusLabel(approval)}
          </Badge>
          {approved ? (
            <ButtonLink href={`/sellers/?slug=${data.store.storeSlug}`} size="sm" variant="secondary">
              View public store
            </ButtonLink>
          ) : null}
        </div>
      </div>

      {!approved ? (
        <div
          className={`flex items-start gap-3 rounded-2xl border px-4 py-3.5 ${
            approval === 'PENDING'
              ? 'border-amber-200 bg-amber-50 text-amber-900'
              : 'border-rose-200 bg-rose-50 text-rose-900'
          }`}
        >
          {approval === 'PENDING' ? (
            <Clock className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
          ) : (
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
          )}
          <div>
            <p className="text-sm font-bold">
              {approval === 'PENDING'
                ? 'Your store is awaiting administrator approval'
                : approval === 'SUSPENDED'
                  ? 'Your store is suspended'
                  : 'Your seller application was not approved'}
            </p>
            <p className="mt-1 text-xs leading-5">
              {approval === 'PENDING'
                ? 'You can prepare your store profile, but products cannot be published until an administrator approves the store.'
                : profile.data?.rejectionReason ??
                  'Contact marketplace support for details. Existing orders remain visible.'}
            </p>
          </div>
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Simulated sales"
          value={formatMoney(data.simulatedSales.gross)}
          hint="Paid demo orders only"
          icon={<TrendingUp className="h-5 w-5" />}
          tone="teal"
        />
        <StatCard
          label="Paid order groups"
          value={data.simulatedSales.orders}
          hint="Across all statuses after payment"
          icon={<ClipboardList className="h-5 w-5" />}
        />
        <StatCard
          label="Live products"
          value={data.products.published}
          hint={`${data.products.total} total · ${data.products.draft} draft`}
          icon={<Package className="h-5 w-5" />}
          tone="indigo"
        />
        <StatCard
          label="Low stock"
          value={data.products.lowStock}
          hint={`${data.products.outOfStock} out of stock`}
          icon={<Boxes className="h-5 w-5" />}
          tone="orange"
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.5fr_1fr]">
        <div className="card p-5">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h2 className="flex items-center gap-2 text-base font-bold text-navy">
                <BarChart3 className="h-4 w-4 text-indigo-600" aria-hidden />
                Simulated sales trend
              </h2>
              <p className="mt-0.5 text-xs text-slate-500">Last 30 days of confirmed demo orders</p>
            </div>
            <ButtonLink href="/seller/analytics/" size="sm" variant="ghost" icon={<ArrowRight className="h-3.5 w-3.5" />}>
              Analytics
            </ButtonLink>
          </div>
          <div className="mt-4">
            <RevenueTrendChart data={data.salesTrend} />
          </div>
        </div>

        <div className="card flex flex-col p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-navy">Fulfilment queue</h2>
            <ButtonLink href="/seller/orders/" size="sm" variant="ghost">
              All orders
            </ButtonLink>
          </div>
          <ul className="mt-3 space-y-2">
            {[
              { label: 'Awaiting payment', value: data.orders.pendingPayment, tone: 'amber' },
              { label: 'Paid — to process', value: data.orders.paid, tone: 'sky' },
              { label: 'Processing', value: data.orders.processing, tone: 'indigo' },
              { label: 'Shipped', value: data.orders.shipped, tone: 'violet' },
              { label: 'Delivered', value: data.orders.delivered, tone: 'teal' },
              { label: 'Cancelled', value: data.orders.cancelled, tone: 'slate' },
            ].map((row) => (
              <li
                key={row.label}
                className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-xs"
              >
                <span className="font-semibold text-slate-600">{row.label}</span>
                <Badge tone={row.tone as never}>{row.value}</Badge>
              </li>
            ))}
          </ul>
          <div className="mt-3 grid gap-2">
            <ButtonLink href="/seller/orders/?status=PAID" size="sm" variant="secondary">
              Process new orders
            </ButtonLink>
            <ButtonLink href="/seller/products/new/" size="sm" icon={<PlusCircle className="h-3.5 w-3.5" />}>
              Add a product
            </ButtonLink>
          </div>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <h2 className="text-base font-bold text-navy">Recent orders</h2>
            <Link href="/seller/orders/" className="text-xs font-bold text-indigo-600 hover:text-indigo-800">
              View all
            </Link>
          </div>
          {data.recentOrders.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-slate-500">
              No orders yet. Once customers pay for your products they appear here.
            </p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {data.recentOrders.map((order) => (
                <li key={order.id} className="flex items-center justify-between gap-3 px-5 py-3">
                  <div className="min-w-0">
                    <Link
                      href={`/seller/order/?id=${order.id}`}
                      className="truncate text-sm font-semibold text-navy hover:text-indigo-700"
                    >
                      {order.order.orderNumber}
                    </Link>
                    <p className="text-[11px] text-slate-500">
                      {order.order.customer.name} · {order.unitCount} unit
                      {order.unitCount === 1 ? '' : 's'} · {relativeTime(order.createdAt)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={order.status} />
                    <span className="text-sm font-bold text-navy">{formatMoney(order.subtotal)}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="card overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <h2 className="text-base font-bold text-navy">Top products</h2>
            <Link href="/seller/products/" className="text-xs font-bold text-indigo-600 hover:text-indigo-800">
              Manage
            </Link>
          </div>
          {data.productPerformance.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-slate-500">
              No confirmed sales yet. Product performance appears after a paid demo order.
            </p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {data.productPerformance.slice(0, 5).map((row) => (
                <li key={row.productId} className="flex items-center justify-between gap-3 px-5 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-800">
                      {row.product?.name ?? 'Product removed'}
                    </p>
                    <p className="text-[11px] text-slate-500">
                      {row.product?.sku ?? '—'} · {row.units} unit{row.units === 1 ? '' : 's'}
                    </p>
                  </div>
                  <span className="text-sm font-bold text-navy">{formatMoney(row.revenue)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Link href="/seller/inventory/" className="card card-hover flex items-center gap-3 p-4">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
            <Boxes className="h-5 w-5" />
          </span>
          <div>
            <p className="text-sm font-bold text-navy">Adjust inventory</p>
            <p className="text-xs text-slate-500">Stock and ledger</p>
          </div>
        </Link>
        <Link href="/seller/settings/" className="card card-hover flex items-center gap-3 p-4">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-50 text-teal-600">
            <Settings className="h-5 w-5" />
          </span>
          <div>
            <p className="text-sm font-bold text-navy">Store settings</p>
            <p className="text-xs text-slate-500">Brand and contact</p>
          </div>
        </Link>
        <Link href="/seller/analytics/" className="card card-hover flex items-center gap-3 p-4">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-50 text-violet-600">
            <BarChart3 className="h-5 w-5" />
          </span>
          <div>
            <p className="text-sm font-bold text-navy">Performance</p>
            <p className="text-xs text-slate-500">Units and revenue</p>
          </div>
        </Link>
      </div>

      <p className="flex items-center gap-1.5 text-[11px] text-slate-500">
        <CheckCircle2 className="h-3.5 w-3.5 text-teal-600" aria-hidden />
        {data.simulatedSales.note}
      </p>
    </div>
  );
}
