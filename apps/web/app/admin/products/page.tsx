'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useMemo, useState } from 'react';
import {
  Archive,
  Eye,
  EyeOff,
  Package,
  RefreshCw,
  Search,
  ShieldAlert,
} from 'lucide-react';
import { useApiData } from '../../../lib/useApi';
import { api, errorMessage } from '../../../lib/api';
import type { AdminProduct, Paginated } from '../../../lib/types';
import { formatDateTime, formatMoney } from '../../../lib/format';
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
  ProductImage,
  Select,
  Skeleton,
  StatusBadge,
  Textarea,
} from '../../../components/ui';
import { useToast } from '../../../components/ui/toast';

const STATUSES = [
  { value: '', label: 'All statuses' },
  { value: 'DRAFT', label: 'Draft' },
  { value: 'PUBLISHED', label: 'Published' },
  { value: 'OUT_OF_STOCK', label: 'Out of stock' },
  { value: 'ARCHIVED', label: 'Archived' },
];

function ProductsView() {
  const params = useSearchParams();
  const toast = useToast();
  const q = params.get('q') ?? '';
  const status = params.get('status') ?? '';
  const sellerId = params.get('sellerId') ?? '';
  const lowStock = params.get('lowStock') === 'true';
  const page = Math.max(1, Number(params.get('page') ?? '1') || 1);
  const [search, setSearch] = useState(q);
  const [target, setTarget] = useState<AdminProduct | null>(null);
  const [nextStatus, setNextStatus] = useState<'PUBLISHED' | 'DRAFT' | 'ARCHIVED'>('PUBLISHED');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const path = useMemo(() => {
    const searchParams = new URLSearchParams();
    searchParams.set('page', String(page));
    searchParams.set('pageSize', '12');
    if (q) searchParams.set('q', q);
    if (status) searchParams.set('status', status);
    if (sellerId) searchParams.set('sellerId', sellerId);
    if (lowStock) searchParams.set('lowStock', 'true');
    return `/admin/products?${searchParams.toString()}`;
  }, [page, q, status, sellerId, lowStock]);

  const products = useApiData<Paginated<AdminProduct>>(path);

  function navigate(next: Record<string, string | null>, resetPage = true) {
    const searchParams = new URLSearchParams(params.toString());
    if (resetPage) searchParams.delete('page');
    for (const [key, value] of Object.entries(next)) {
      if (!value) searchParams.delete(key);
      else searchParams.set(key, value);
    }
    const query = searchParams.toString();
    window.location.href = query ? `/admin/products/?${query}` : '/admin/products/';
  }

  function openModeration(product: AdminProduct, targetStatus: 'PUBLISHED' | 'DRAFT' | 'ARCHIVED') {
    setTarget(product);
    setNextStatus(targetStatus);
    setReason('');
    setError(null);
  }

  async function moderate() {
    if (!target) return;
    setBusy(true);
    setError(null);
    try {
      await api(`/admin/products/${target.id}/status`, {
        method: 'PATCH',
        body: { status: nextStatus, reason: reason.trim() || undefined },
      });
      toast.success(`${target.name} moved to ${nextStatus}. The seller was notified.`);
      setTarget(null);
      products.reload();
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-violet-700">Catalogue</p>
          <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-navy">Product moderation</h1>
          <p className="mt-1 text-sm text-slate-500">
            Publish, hide or archive marketplace listings. Sellers are notified of every change.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant={lowStock ? 'primary' : 'secondary'}
            onClick={() => navigate({ lowStock: lowStock ? null : 'true' })}
          >
            Low stock
          </Button>
          <Button
            size="sm"
            variant="ghost"
            icon={<RefreshCw className="h-4 w-4" />}
            onClick={() => products.reload()}
          >
            Refresh
          </Button>
        </div>
      </div>

      {sellerId ? (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-2.5 text-xs text-indigo-900">
          <p>
            Showing products for one seller <span className="font-mono">{sellerId}</span>
          </p>
          <Button size="sm" variant="ghost" onClick={() => navigate({ sellerId: null })}>
            Clear seller filter
          </Button>
        </div>
      ) : null}

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
            placeholder="Search product, SKU or store"
            className="pl-9"
            aria-label="Search products"
          />
        </form>
        <Select
          value={status}
          onChange={(event) => navigate({ status: event.target.value || null })}
          className="sm:w-44"
          aria-label="Filter products by status"
        >
          {STATUSES.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
      </div>

      {products.error ? (
        <ErrorState message={products.error} onRetry={products.reload} />
      ) : products.loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, index) => (
            <Skeleton key={index} className="h-20 w-full rounded-2xl" />
          ))}
        </div>
      ) : (products.data?.items.length ?? 0) === 0 ? (
        <EmptyState
          icon={<Package className="h-5 w-5" />}
          title={q || status || lowStock || sellerId ? 'No products match these filters' : 'No products yet'}
          description="Sellers create products from their own workspace. Published listings appear here for marketplace moderation."
          action={
            q || status || lowStock || sellerId ? (
              <Button
                variant="secondary"
                onClick={() => navigate({ q: null, status: null, lowStock: null, sellerId: null })}
              >
                Clear filters
              </Button>
            ) : (
              <ButtonLink href="/admin/sellers/" variant="secondary">
                Review sellers
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
                  <th>Product</th>
                  <th>Seller</th>
                  <th>Status</th>
                  <th>Price</th>
                  <th>Stock</th>
                  <th className="text-right">Moderation</th>
                </tr>
              </thead>
              <tbody>
                {products.data?.items.map((product) => (
                  <tr key={product.id}>
                    <td>
                      <div className="flex items-center gap-3">
                        <span className="h-11 w-11 shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-white">
                          <ProductImage src={product.imageUrl} alt={product.name} />
                        </span>
                        <div className="min-w-0">
                          <Link
                            href={`/product/?id=${product.id}`}
                            className="block max-w-[240px] truncate text-sm font-bold text-navy hover:text-indigo-700"
                          >
                            {product.name}
                          </Link>
                          <p className="text-[11px] text-slate-500">
                            {product.sku} · {product.category.name}
                          </p>
                          <p className="text-[10px] text-slate-400">
                            Created {formatDateTime(product.createdAt)}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td>
                      <Link
                        href={`/admin/products/?sellerId=${product.seller.id}`}
                        className="text-sm text-slate-800 hover:text-indigo-700"
                      >
                        {product.seller.storeName}
                      </Link>
                      <div className="mt-0.5">
                        <StatusBadge status={product.seller.approvalStatus} type="seller" />
                      </div>
                    </td>
                    <td>
                      <StatusBadge status={product.status} type="product" />
                    </td>
                    <td>
                      <p className="text-sm font-bold text-navy">{formatMoney(product.price)}</p>
                    </td>
                    <td>
                      <p className="text-xs font-semibold text-slate-700">{product.available} available</p>
                      <p className="text-[11px] text-slate-500">
                        {product.stockOnHand} on hand · {product.reservedStock} reserved
                      </p>
                      {product.lowStock ? (
                        <Badge tone="amber" className="mt-1">
                          Low stock
                        </Badge>
                      ) : null}
                    </td>
                    <td>
                      <div className="flex flex-wrap items-center justify-end gap-1">
                        {product.status !== 'PUBLISHED' ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-teal-700 hover:bg-teal-50"
                            icon={<Eye className="h-3.5 w-3.5" />}
                            onClick={() => openModeration(product, 'PUBLISHED')}
                          >
                            Publish
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="ghost"
                            icon={<EyeOff className="h-3.5 w-3.5" />}
                            onClick={() => openModeration(product, 'DRAFT')}
                          >
                            Unpublish
                          </Button>
                        )}
                        {product.status !== 'ARCHIVED' ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-rose-600 hover:bg-rose-50"
                            icon={<Archive className="h-3.5 w-3.5" />}
                            onClick={() => openModeration(product, 'ARCHIVED')}
                          >
                            Archive
                          </Button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination
            page={products.data?.meta.page ?? page}
            totalPages={products.data?.meta.totalPages ?? 1}
            total={products.data?.meta.total}
            onChange={(next) => navigate({ page: String(next) }, false)}
          />
        </>
      )}

      <Modal
        open={target !== null}
        onClose={() => {
          if (busy) return;
          setTarget(null);
          setError(null);
        }}
        title={
          nextStatus === 'PUBLISHED'
            ? 'Publish this listing?'
            : nextStatus === 'DRAFT'
              ? 'Hide this listing?'
              : 'Archive this listing?'
        }
        description={target?.name}
        footer={
          <>
            <Button
              variant="secondary"
              disabled={busy}
              onClick={() => {
                setTarget(null);
                setError(null);
              }}
            >
              Cancel
            </Button>
            <Button
              variant={nextStatus === 'ARCHIVED' ? 'danger' : 'primary'}
              loading={busy}
              onClick={moderate}
            >
              {nextStatus === 'PUBLISHED'
                ? 'Publish'
                : nextStatus === 'DRAFT'
                  ? 'Move to draft'
                  : 'Archive'}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <div className="flex items-start gap-2.5 rounded-xl bg-slate-50 px-3 py-2.5 text-xs leading-5 text-slate-600">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-violet-600" aria-hidden />
            <p>
              {nextStatus === 'PUBLISHED'
                ? 'Publishing requires an approved seller and at least one available unit of stock; otherwise the API rejects the change.'
                : nextStatus === 'DRAFT'
                  ? 'The listing is hidden from the storefront but keeps its stock and order history intact.'
                  : 'Archiving hides the listing permanently from the storefront. Order history is preserved.'}
            </p>
          </div>
          {target ? (
            <p className="text-xs text-slate-500">
              Current status: <strong>{target.status}</strong> · Seller:{' '}
              <strong>{target.seller.storeName}</strong> ({target.seller.approvalStatus})
            </p>
          ) : null}
          <Field label="Reason (optional)" hint="Included in the seller notification.">
            <Textarea
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              maxLength={500}
              placeholder="Listing does not meet marketplace guidelines"
            />
          </Field>
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

export default function AdminProductsPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-3">
          <Skeleton className="h-16 w-full rounded-2xl" />
          <Skeleton className="h-64 w-full rounded-2xl" />
        </div>
      }
    >
      <ProductsView />
    </Suspense>
  );
}
