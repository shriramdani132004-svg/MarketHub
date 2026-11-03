'use client';

import {
  BarChart3,
  Boxes,
  Package,
  ShoppingBag,
  TrendingUp,
  Truck,
} from 'lucide-react';
import { useApiData } from '../../../lib/useApi';
import type { SellerAnalytics } from '../../../lib/types';
import {
  formatCompact,
  formatDateTime,
  formatMoney,
  statusLabel,
} from '../../../lib/format';
import {
  Badge,
  ButtonLink,
  ErrorState,
  Skeleton,
  StatCard,
  StatusBadge,
} from '../../../components/ui';
import { StatusBarChart } from '../../../components/charts/Charts';

export default function SellerAnalyticsPage() {
  const analytics = useApiData<SellerAnalytics>('/analytics/seller');
  const productStats = useApiData<{
    days: number;
    items: Array<{
      productId: string;
      product: { id: string; name: string; sku: string; imageUrl?: string | null } | null;
      units: number;
      revenue: string;
    }>;
    note: string;
  }>('/analytics/products?days=30');
  const sales = useApiData<{
    days: number;
    trend: Array<{ date: string; amount: number; orders: number }>;
    note: string;
  }>('/analytics/sales?days=30');

  if (analytics.error) {
    return <ErrorState message={analytics.error} onRetry={analytics.reload} />;
  }

  if (analytics.loading || !analytics.data) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-20 w-full rounded-2xl" />
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
  const statusBars = Object.entries(data.orders).map(([status, count]) => ({
    status: status === 'pendingPayment' ? 'PENDING_PAYMENT' : status.toUpperCase(),
    count,
  }));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-teal-700">
            Performance
          </p>
          <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-navy">Store analytics</h1>
          <p className="mt-1 text-sm text-slate-500">
            Honest metrics from confirmed demo orders only — no fabricated revenue.
          </p>
        </div>
        <ButtonLink href="/seller/orders/" size="sm" variant="secondary">
          Fulfilment queue
        </ButtonLink>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Gross demo sales"
          value={formatMoney(data.simulatedSales.gross)}
          hint={`${data.simulatedSales.orders} paid order group${data.simulatedSales.orders === 1 ? '' : 's'}`}
          icon={<TrendingUp className="h-5 w-5" />}
          tone="teal"
        />
        <StatCard
          label="Merchandise"
          value={formatMoney(data.simulatedSales.merchandise)}
          hint={`Shipping ${formatMoney(data.simulatedSales.shipping)}`}
          icon={<ShoppingBag className="h-5 w-5" />}
          tone="indigo"
        />
        <StatCard
          label="Units sold"
          value={formatCompact(data.productPerformance.reduce((sum, row) => sum + row.units, 0))}
          hint="Paid orders"
          icon={<Boxes className="h-5 w-5" />}
          tone="violet"
        />
        <StatCard
          label="Low stock"
          value={data.products.lowStock}
          hint={`${data.products.published} published · ${data.products.outOfStock} sold out`}
          icon={<Package className="h-5 w-5" />}
          tone="orange"
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <div className="card p-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="flex items-center gap-2 text-base font-bold text-navy">
                <BarChart3 className="h-4 w-4 text-indigo-600" aria-hidden />
                Sales trend
              </h2>
              <p className="mt-0.5 text-xs text-slate-500">Last {sales.data?.days ?? 30} days</p>
            </div>
            <Badge tone="teal">Simulated</Badge>
          </div>
          <div className="mt-4">
            {sales.loading ? (
              <Skeleton className="h-64 w-full" />
            ) : (
              <StatusBarChart
                data={(sales.data?.trend ?? []).slice(-14).map((row) => ({
                  status: row.date.slice(5),
                  count: Math.round(row.amount),
                }))}
              />
            )}
          </div>
          <p className="mt-2 text-[10px] text-slate-400">
            Bars show daily confirmed demo sales value (₹), not order counts.
          </p>
        </div>

        <div className="card p-5">
          <h2 className="text-base font-bold text-navy">Order group status</h2>
          <p className="mt-0.5 text-xs text-slate-500">Only your parcel of each order</p>
          <div className="mt-4">
            <StatusBarChart data={statusBars} />
          </div>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <div>
              <h2 className="text-base font-bold text-navy">Top products</h2>
              <p className="mt-0.5 text-xs text-slate-500">
                {productStats.data?.note ?? 'Only paid demo orders are counted.'}
              </p>
            </div>
            <ButtonLink href="/seller/products/" size="sm" variant="ghost">
              Manage
            </ButtonLink>
          </div>
          {(productStats.data?.items.length ?? 0) === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-slate-500">
              No confirmed product sales in this period.
            </p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {productStats.data?.items.map((row, index) => (
                <li key={row.productId} className="flex items-center gap-3 px-5 py-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-[11px] font-extrabold text-slate-600">
                    {index + 1}
                  </span>
                  <div className="min-w-0 flex-1">
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

        <div className="space-y-4">
          <div className="card overflow-hidden">
            <div className="border-b border-slate-100 px-5 py-4">
              <h2 className="flex items-center gap-2 text-base font-bold text-navy">
                <Truck className="h-4 w-4 text-indigo-600" aria-hidden />
                Recent order groups
              </h2>
            </div>
            {data.recentOrders.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-slate-500">No orders yet.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {data.recentOrders.map((order) => (
                  <li key={order.id} className="flex items-center justify-between gap-3 px-5 py-2.5">
                    <div className="min-w-0">
                      <p className="truncate text-xs font-bold text-navy">
                        {order.order.orderNumber}
                      </p>
                      <p className="text-[10px] text-slate-500">
                        {order.order.customer.name} · {order.unitCount} unit
                        {order.unitCount === 1 ? '' : 's'}
                      </p>
                    </div>
                    <StatusBadge status={order.status} />
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="card overflow-hidden">
            <div className="border-b border-slate-100 px-5 py-4">
              <h2 className="text-base font-bold text-navy">Inventory ledger</h2>
            </div>
            {data.inventoryMovements.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-slate-500">
                No movements recorded yet.
              </p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {data.inventoryMovements.slice(0, 6).map((movement) => (
                  <li key={movement.id} className="flex items-center justify-between gap-3 px-5 py-2.5 text-xs">
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-slate-800">{movement.product.name}</p>
                      <p className="text-[10px] text-slate-500">
                        {statusLabel(movement.movementType)} · {formatDateTime(movement.createdAt)}
                      </p>
                    </div>
                    <span className="font-bold text-navy">{movement.quantity}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      <p className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-[11px] leading-5 text-slate-500">
        {data.simulatedSales.note}
      </p>
    </div>
  );
}
