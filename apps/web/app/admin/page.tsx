'use client';

import Link from 'next/link';
import { useState } from 'react';
import {
  ArrowRight,
  BadgeCheck,
  BarChart3,
  Boxes,
  CheckCircle2,
  ClipboardList,
  CreditCard,
  Package,
  ShieldCheck,
  ShoppingBag,
  Store,
  TrendingUp,
  Truck,
  Users,
  XCircle,
} from 'lucide-react';
import { useApiData } from '../../lib/useApi';
import { api, errorMessage } from '../../lib/api';
import type { AdminDashboard } from '../../lib/types';
import { formatDate, formatMoney, relativeTime, statusLabel } from '../../lib/format';
import {
  Badge,
  Button,
  ButtonLink,
  ErrorState,
  Modal,
  Skeleton,
  StatCard,
  StatusBadge,
  Textarea,
} from '../../components/ui';
import { useToast } from '../../components/ui/toast';
import { RevenueTrendChart, StatusBarChart } from '../../components/charts/Charts';

export default function AdminOverviewPage() {
  const toast = useToast();
  const dashboard = useApiData<AdminDashboard>('/admin/dashboard');
  const [decision, setDecision] = useState<{
    id: string;
    storeName: string;
    action: 'approve' | 'reject';
  } | null>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (dashboard.error) {
    return <ErrorState message={dashboard.error} onRetry={dashboard.reload} />;
  }

  if (dashboard.loading || !dashboard.data) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 w-full rounded-2xl" />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, index) => (
            <Skeleton key={index} className="h-28 w-full rounded-2xl" />
          ))}
        </div>
        <Skeleton className="h-72 w-full rounded-2xl" />
      </div>
    );
  }

  const data = dashboard.data;

  async function submitDecision() {
    if (!decision) return;
    setBusy(true);
    setError(null);
    try {
      await api(`/admin/sellers/${decision.id}/${decision.action}`, {
        method: 'PATCH',
        body: decision.action === 'reject' ? { reason: reason.trim() || undefined } : {},
      });
      toast.success(
        decision.action === 'approve'
          ? `${decision.storeName} approved.`
          : `${decision.storeName} application rejected.`,
      );
      setDecision(null);
      setReason('');
      dashboard.reload();
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-violet-700">
            Marketplace operations
          </p>
          <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-navy">
            Admin overview
          </h1>
          <p className="mt-1 text-sm text-slate-500">{data.note}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ButtonLink href="/admin/sellers/" size="sm" variant="secondary" icon={<Store className="h-3.5 w-3.5" />}>
            Seller queue
            {data.pendingSellers > 0 ? (
              <span className="rounded-full bg-amber-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
                {data.pendingSellers}
              </span>
            ) : null}
          </ButtonLink>
          <ButtonLink href="/admin/orders/" size="sm" icon={<ClipboardList className="h-3.5 w-3.5" />}>
            Orders
          </ButtonLink>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Simulated revenue"
          value={formatMoney(data.simulatedRevenue)}
          hint="Confirmed demo payments"
          icon={<TrendingUp className="h-5 w-5" />}
          tone="teal"
        />
        <StatCard
          label="Orders"
          value={data.totalOrders}
          hint={`${data.failedPayments} failed payment${data.failedPayments === 1 ? '' : 's'}`}
          icon={<ClipboardList className="h-5 w-5" />}
          tone="indigo"
        />
        <StatCard
          label="Customers"
          value={data.customers}
          hint={`${data.sellers} seller store${data.sellers === 1 ? '' : 's'}`}
          icon={<Users className="h-5 w-5" />}
          tone="violet"
        />
        <StatCard
          label="Pending approvals"
          value={data.pendingSellers}
          hint={`${data.approvedSellers} approved stores`}
          icon={<ShieldCheck className="h-5 w-5" />}
          tone="amber"
        />
        <StatCard
          label="Live products"
          value={data.activeProducts}
          hint={`${data.outOfStock} out of stock`}
          icon={<Package className="h-5 w-5" />}
          tone="sky"
        />
        <StatCard
          label="Low stock"
          value={data.lowStock}
          hint="1-5 units available"
          icon={<Boxes className="h-5 w-5" />}
          tone="orange"
        />
        <StatCard
          label="Seller applications"
          value={data.recentApplications.filter((item) => item.approvalStatus === 'PENDING').length}
          hint="In the latest six applications"
          icon={<BadgeCheck className="h-5 w-5" />}
          tone="rose"
        />
        <StatCard
          label="Order statuses"
          value={data.orderStatusDistribution.length}
          hint="Distinct statuses in use"
          icon={<BarChart3 className="h-5 w-5" />}
          tone="teal"
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.5fr_1fr]">
        <div className="card p-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="flex items-center gap-2 text-base font-bold text-navy">
                <TrendingUp className="h-4 w-4 text-teal-600" aria-hidden />
                Simulated sales trend
              </h2>
              <p className="mt-0.5 text-xs text-slate-500">Last 14 days of confirmed demo payments</p>
            </div>
            <Badge tone="teal">Simulated</Badge>
          </div>
          <div className="mt-4">
            <RevenueTrendChart data={data.salesTrend} />
          </div>
        </div>

        <div className="card p-5">
          <h2 className="text-base font-bold text-navy">Order status mix</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Every order in the marketplace, by aggregate status.
          </p>
          <div className="mt-4">
            {data.orderStatusDistribution.length === 0 ? (
              <p className="py-10 text-center text-sm text-slate-500">No orders yet.</p>
            ) : (
              <StatusBarChart data={data.orderStatusDistribution} />
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <div>
              <h2 className="text-base font-bold text-navy">Recent orders</h2>
              <p className="mt-0.5 text-xs text-slate-500">Latest marketplace activity</p>
            </div>
            <Link href="/admin/orders/" className="text-xs font-bold text-indigo-600 hover:text-indigo-800">
              View all
            </Link>
          </div>
          {data.recentOrders.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-slate-500">
              No orders yet. Customer purchases will appear here.
            </p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {data.recentOrders.map((order) => (
                <li key={order.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-navy">{order.orderNumber}</p>
                    <p className="text-[11px] text-slate-500">
                      {order.customer.name} · {order.customer.email} · {order.sellerCount} seller
                      {order.sellerCount === 1 ? '' : 's'} · {relativeTime(order.createdAt)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={order.orderStatus} />
                    <StatusBadge status={order.paymentStatus} type="payment" />
                    <span className="text-sm font-extrabold text-navy">
                      {formatMoney(order.grandTotal)}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="card overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <div>
              <h2 className="text-base font-bold text-navy">Seller applications</h2>
              <p className="mt-0.5 text-xs text-slate-500">Review before stores go live</p>
            </div>
            <Link href="/admin/sellers/" className="text-xs font-bold text-indigo-600 hover:text-indigo-800">
              Manage
            </Link>
          </div>
          {data.recentApplications.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-slate-500">No applications yet.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {data.recentApplications.map((application) => (
                <li key={application.id} className="px-5 py-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-navy">{application.storeName}</p>
                      <p className="truncate text-[11px] text-slate-500">
                        {application.user.name} · {application.user.email}
                      </p>
                      <p className="text-[10px] text-slate-400">
                        Applied {formatDate(application.createdAt)}
                      </p>
                    </div>
                    <StatusBadge status={application.approvalStatus} type="seller" />
                  </div>
                  {application.approvalStatus === 'PENDING' ? (
                    <div className="mt-2 flex gap-1.5">
                      <Button
                        size="sm"
                        variant="teal"
                        className="h-8 px-2.5"
                        icon={<CheckCircle2 className="h-3.5 w-3.5" />}
                        onClick={() =>
                          setDecision({
                            id: application.id,
                            storeName: application.storeName,
                            action: 'approve',
                          })
                        }
                      >
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        className="h-8 px-2.5 text-rose-600"
                        icon={<XCircle className="h-3.5 w-3.5" />}
                        onClick={() =>
                          setDecision({
                            id: application.id,
                            storeName: application.storeName,
                            action: 'reject',
                          })
                        }
                      >
                        Reject
                      </Button>
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <QuickLink href="/admin/sellers/" icon={<Store className="h-4 w-4" />} label="Sellers" hint="Approve, suspend, reactivate" />
        <QuickLink href="/admin/products/" icon={<Package className="h-4 w-4" />} label="Products" hint="Moderate listings" />
        <QuickLink href="/admin/payments/" icon={<CreditCard className="h-4 w-4" />} label="Payments" hint="Simulated ledger" />
        <QuickLink href="/admin/inventory/" icon={<Truck className="h-4 w-4" />} label="Inventory" hint="Movement ledger" />
      </div>

      <p className="flex items-center gap-1.5 text-[11px] text-slate-500">
        <ShoppingBag className="h-3.5 w-3.5 text-indigo-500" aria-hidden />
        {data.note}
      </p>

      <Modal
        open={decision !== null}
        onClose={() => {
          if (busy) return;
          setDecision(null);
          setReason('');
          setError(null);
        }}
        title={decision?.action === 'approve' ? 'Approve this store?' : 'Reject this application?'}
        description={decision?.storeName}
        footer={
          <>
            <Button
              variant="secondary"
              disabled={busy}
              onClick={() => {
                setDecision(null);
                setReason('');
                setError(null);
              }}
            >
              Cancel
            </Button>
            <Button
              variant={decision?.action === 'approve' ? 'teal' : 'danger'}
              loading={busy}
              onClick={submitDecision}
            >
              {decision?.action === 'approve' ? 'Approve store' : 'Reject application'}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <p className="text-sm leading-6 text-slate-600">
            {decision?.action === 'approve'
              ? 'The seller will be able to publish products immediately and their store becomes visible in the marketplace directory. They will receive a notification.'
              : 'The seller will be notified with your reason and cannot publish products. You can reactivate the store later if needed.'}
          </p>
          {decision?.action === 'reject' ? (
            <div>
              <label className="label" htmlFor="reject-reason">
                Reason
              </label>
              <Textarea
                id="reject-reason"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                maxLength={500}
                placeholder="Application did not meet marketplace requirements"
              />
            </div>
          ) : null}
          {error ? (
            <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">
              {error}
            </p>
          ) : null}
        </div>
      </Modal>
    </div>
  );
}

function QuickLink({
  href,
  icon,
  label,
  hint,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  hint: string;
}) {
  return (
    <Link href={href} className="card card-hover flex items-center gap-3 p-4">
      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-sm font-bold text-navy">{label}</p>
        <p className="text-xs text-slate-500">{hint}</p>
      </div>
      <ArrowRight className="ml-auto h-4 w-4 text-slate-300" aria-hidden />
    </Link>
  );
}
