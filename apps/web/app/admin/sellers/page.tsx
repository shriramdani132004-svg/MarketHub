'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useMemo, useState } from 'react';
import {
  CheckCircle2,
  RefreshCw,
  Search,
  ShieldOff,
  Store,
  XCircle,
} from 'lucide-react';
import { useApiData } from '../../../lib/useApi';
import { api, errorMessage } from '../../../lib/api';
import type { AdminSeller, Paginated } from '../../../lib/types';
import { formatDate, formatDateTime, statusLabel } from '../../../lib/format';
import {
  Badge,
  Button,
  ButtonLink,
  EmptyState,
  ErrorState,
  Field,
  Input,
  Modal,
  Pagination,
  Select,
  Skeleton,
  StatusBadge,
  Textarea,
} from '../../../components/ui';
import { useToast } from '../../../components/ui/toast';

const STATUSES = [
  { value: '', label: 'All statuses' },
  { value: 'PENDING', label: 'Pending review' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'REJECTED', label: 'Rejected' },
  { value: 'SUSPENDED', label: 'Suspended' },
];

type Action = 'approve' | 'reject' | 'suspend' | 'reactivate';

const ACTION_COPY: Record<
  Action,
  { title: string; confirm: string; tone: 'primary' | 'danger' | 'teal'; description: string }
> = {
  approve: {
    title: 'Approve this store?',
    confirm: 'Approve store',
    tone: 'teal',
    description:
      'The store becomes visible in the marketplace and the seller can publish products. The seller receives a notification.',
  },
  reject: {
    title: 'Reject this application?',
    confirm: 'Reject application',
    tone: 'danger',
    description:
      'The seller is notified with your reason. Their store stays hidden and they cannot publish products.',
  },
  suspend: {
    title: 'Suspend this store?',
    confirm: 'Suspend store',
    tone: 'danger',
    description:
      'Products are removed from the storefront. Existing orders remain visible and must still be fulfilled.',
  },
  reactivate: {
    title: 'Reactivate this store?',
    confirm: 'Reactivate store',
    tone: 'teal',
    description:
      'The store returns to APPROVED status and its published products become visible again.',
  },
};

function SellersView() {
  const params = useSearchParams();
  const toast = useToast();
  const q = params.get('q') ?? '';
  const status = params.get('status') ?? '';
  const page = Math.max(1, Number(params.get('page') ?? '1') || 1);
  const [search, setSearch] = useState(q);
  const [action, setAction] = useState<{ seller: AdminSeller; action: Action } | null>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const path = useMemo(() => {
    const searchParams = new URLSearchParams();
    searchParams.set('page', String(page));
    searchParams.set('pageSize', '12');
    if (q) searchParams.set('q', q);
    if (status) searchParams.set('status', status);
    return `/admin/sellers?${searchParams.toString()}`;
  }, [page, q, status]);

  const sellers = useApiData<Paginated<AdminSeller>>(path);

  function navigate(next: Record<string, string | null>, resetPage = true) {
    const searchParams = new URLSearchParams(params.toString());
    if (resetPage) searchParams.delete('page');
    for (const [key, value] of Object.entries(next)) {
      if (!value) searchParams.delete(key);
      else searchParams.set(key, value);
    }
    const query = searchParams.toString();
    window.location.href = query ? `/admin/sellers/?${query}` : '/admin/sellers/';
  }

  async function runAction() {
    if (!action) return;
    setBusy(true);
    setError(null);
    try {
      await api(`/admin/sellers/${action.seller.id}/${action.action}`, {
        method: 'PATCH',
        body: action.action === 'reactivate' ? {} : { reason: reason.trim() || undefined },
      });
      toast.success(`${action.seller.storeName}: ${statusLabel(action.action)} completed.`);
      setAction(null);
      setReason('');
      sellers.reload();
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  }

  const copy = action ? ACTION_COPY[action.action] : null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-violet-700">Marketplace</p>
          <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-navy">Sellers</h1>
          <p className="mt-1 text-sm text-slate-500">
            Review applications, approve stores and control marketplace access.
          </p>
        </div>
        <div className="flex gap-2">
          <ButtonLink href="/admin/sellers/?status=PENDING" size="sm" variant="secondary">
            Pending queue
          </ButtonLink>
          <Button
            size="sm"
            variant="ghost"
            icon={<RefreshCw className="h-4 w-4" />}
            onClick={() => sellers.reload()}
          >
            Refresh
          </Button>
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
            placeholder="Search store, slug or owner email"
            className="pl-9"
            aria-label="Search sellers"
          />
        </form>
        <Select
          value={status}
          onChange={(event) => navigate({ status: event.target.value || null })}
          className="sm:w-44"
          aria-label="Filter sellers by status"
        >
          {STATUSES.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
      </div>

      {sellers.error ? (
        <ErrorState message={sellers.error} onRetry={sellers.reload} />
      ) : sellers.loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, index) => (
            <Skeleton key={index} className="h-20 w-full rounded-2xl" />
          ))}
        </div>
      ) : (sellers.data?.items.length ?? 0) === 0 ? (
        <EmptyState
          icon={<Store className="h-5 w-5" />}
          title={q || status ? 'No stores match these filters' : 'No seller applications yet'}
          description={
            q || status
              ? 'Clear the search or status filter to see every store.'
              : 'When a visitor applies to sell, their store appears here for review.'
          }
          action={
            q || status ? (
              <Button variant="secondary" onClick={() => navigate({ q: null, status: null })}>
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
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Store</th>
                  <th>Owner</th>
                  <th>Status</th>
                  <th>Catalogue</th>
                  <th>Applied</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {sellers.data?.items.map((seller) => (
                  <tr key={seller.id}>
                    <td>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-navy">{seller.storeName}</p>
                        <p className="text-[11px] text-slate-500">{seller.storeSlug}</p>
                        {seller.rejectionReason ? (
                          <p className="mt-0.5 max-w-[240px] truncate text-[10px] text-rose-600">
                            {seller.rejectionReason}
                          </p>
                        ) : null}
                      </div>
                    </td>
                    <td>
                      <p className="text-sm text-slate-800">{seller.user.name}</p>
                      <p className="text-[11px] text-slate-500">{seller.user.email}</p>
                      {seller.user.status !== 'ACTIVE' ? (
                        <Badge tone="rose" className="mt-1">
                          Account {statusLabel(seller.user.status)}
                        </Badge>
                      ) : null}
                    </td>
                    <td>
                      <StatusBadge status={seller.approvalStatus} type="seller" />
                      {seller.approvedAt ? (
                        <p className="mt-1 text-[10px] text-slate-400">
                          {formatDate(seller.approvedAt)}
                        </p>
                      ) : null}
                    </td>
                    <td>
                      <p className="text-xs font-semibold text-slate-700">{seller.productCount} products</p>
                      <p className="text-[11px] text-slate-500">{seller.orderCount} seller orders</p>
                    </td>
                    <td>
                      <p className="text-xs text-slate-600">{formatDateTime(seller.createdAt)}</p>
                    </td>
                    <td>
                      <div className="flex flex-wrap items-center justify-end gap-1">
                        {seller.approvalStatus === 'PENDING' ? (
                          <>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-teal-700 hover:bg-teal-50"
                              icon={<CheckCircle2 className="h-3.5 w-3.5" />}
                              onClick={() => {
                                setAction({ seller, action: 'approve' });
                                setReason('');
                                setError(null);
                              }}
                            >
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-rose-600 hover:bg-rose-50"
                              icon={<XCircle className="h-3.5 w-3.5" />}
                              onClick={() => {
                                setAction({ seller, action: 'reject' });
                                setReason('');
                                setError(null);
                              }}
                            >
                              Reject
                            </Button>
                          </>
                        ) : null}
                        {seller.approvalStatus === 'APPROVED' ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-rose-600 hover:bg-rose-50"
                            icon={<ShieldOff className="h-3.5 w-3.5" />}
                            onClick={() => {
                              setAction({ seller, action: 'suspend' });
                              setReason('');
                              setError(null);
                            }}
                          >
                            Suspend
                          </Button>
                        ) : null}
                        {seller.approvalStatus === 'SUSPENDED' ||
                        seller.approvalStatus === 'REJECTED' ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-teal-700 hover:bg-teal-50"
                            icon={<RefreshCw className="h-3.5 w-3.5" />}
                            onClick={() => {
                              setAction({ seller, action: 'reactivate' });
                              setReason('');
                              setError(null);
                            }}
                          >
                            Reactivate
                          </Button>
                        ) : null}
                        {seller.approvalStatus === 'APPROVED' ? (
                          <ButtonLink
                            href={`/sellers/?slug=${seller.storeSlug}`}
                            size="sm"
                            variant="ghost"
                          >
                            View store
                          </ButtonLink>
                        ) : (
                          <Link
                            href={`/admin/products/?sellerId=${seller.id}`}
                            className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                          >
                            Products
                          </Link>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination
            page={sellers.data?.meta.page ?? page}
            totalPages={sellers.data?.meta.totalPages ?? 1}
            total={sellers.data?.meta.total}
            onChange={(next) => navigate({ page: String(next) }, false)}
          />
        </>
      )}

      <Modal
        open={action !== null}
        onClose={() => {
          if (busy) return;
          setAction(null);
          setReason('');
          setError(null);
        }}
        title={copy?.title ?? 'Seller action'}
        description={action?.seller.storeName}
        footer={
          <>
            <Button
              variant="secondary"
              disabled={busy}
              onClick={() => {
                setAction(null);
                setReason('');
                setError(null);
              }}
            >
              Cancel
            </Button>
            <Button variant={copy?.tone ?? 'primary'} loading={busy} onClick={runAction}>
              {copy?.confirm ?? 'Confirm'}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <p className="text-sm leading-6 text-slate-600">{copy?.description}</p>
          {action?.action === 'reject' || action?.action === 'suspend' ? (
            <Field label="Reason" hint="Stored on the store and included in the seller notification.">
              <Textarea
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                maxLength={500}
                placeholder={
                  action.action === 'suspend'
                    ? 'Temporary suspension pending investigation'
                    : 'Application did not meet marketplace requirements'
                }
              />
            </Field>
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

export default function AdminSellersPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-3">
          <Skeleton className="h-16 w-full rounded-2xl" />
          <Skeleton className="h-64 w-full rounded-2xl" />
        </div>
      }
    >
      <SellersView />
    </Suspense>
  );
}
