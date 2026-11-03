'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useMemo, useState } from 'react';
import {
  Archive,
  Boxes,
  Package,
  Pencil,
  Plus,
  Search,
} from 'lucide-react';
import { useApiData } from '../../../lib/useApi';
import { api, errorMessage } from '../../../lib/api';
import type { Paginated, SellerProduct } from '../../../lib/types';
import { formatMoney, relativeTime } from '../../../lib/format';
import {
  Badge,
  Button,
  ButtonLink,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  Input,
  Pagination,
  ProductImage,
  Select,
  Skeleton,
  StatusBadge,
} from '../../../components/ui';
import { useToast } from '../../../components/ui/toast';

const STATUSES = [
  { value: '', label: 'All statuses' },
  { value: 'PUBLISHED', label: 'Published' },
  { value: 'DRAFT', label: 'Draft' },
  { value: 'OUT_OF_STOCK', label: 'Out of stock' },
  { value: 'ARCHIVED', label: 'Archived' },
];

function ProductsView() {
  const params = useSearchParams();
  const toast = useToast();
  const q = params.get('q') ?? '';
  const status = params.get('status') ?? '';
  const lowStock = params.get('lowStock') === 'true';
  const page = Math.max(1, Number(params.get('page') ?? '1') || 1);
  const [search, setSearch] = useState(q);
  const [archiveTarget, setArchiveTarget] = useState<SellerProduct | null>(null);
  const [archiving, setArchiving] = useState(false);

  const path = useMemo(() => {
    const search = new URLSearchParams();
    search.set('page', String(page));
    search.set('pageSize', '12');
    if (q) search.set('q', q);
    if (status) search.set('status', status);
    if (lowStock) search.set('lowStock', 'true');
    return `/seller/products?${search.toString()}`;
  }, [page, q, status, lowStock]);

  const products = useApiData<Paginated<SellerProduct>>(path);

  function navigate(next: Record<string, string | null>, resetPage = true) {
    const search = new URLSearchParams(params.toString());
    if (resetPage) search.delete('page');
    for (const [key, value] of Object.entries(next)) {
      if (!value) search.delete(key);
      else search.set(key, value);
    }
    const query = search.toString();
    window.location.href = query ? `/seller/products/?${query}` : '/seller/products/';
  }

  async function archive() {
    if (!archiveTarget) return;
    setArchiving(true);
    try {
      await api(`/seller/products/${archiveTarget.id}`, { method: 'DELETE' });
      toast.success(`${archiveTarget.name} archived.`);
      setArchiveTarget(null);
      products.reload();
    } catch (cause) {
      toast.error(errorMessage(cause));
    } finally {
      setArchiving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-teal-700">Catalogue</p>
          <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-navy">Products</h1>
          <p className="mt-1 text-sm text-slate-500">
            {products.data
              ? `${products.data.meta.total} product${products.data.meta.total === 1 ? '' : 's'} in your store`
              : 'Manage listings, pricing and availability.'}
          </p>
        </div>
        <ButtonLink href="/seller/products/new/" icon={<Plus className="h-4 w-4" />}>
          New product
        </ButtonLink>
      </div>

      <div className="card p-3.5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              navigate({ q: search.trim() || null });
            }}
            className="relative flex-1"
            role="search"
          >
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by name, SKU or brand"
              className="pl-9"
              aria-label="Search products"
            />
          </form>
          <Select
            value={status}
            onChange={(event) => navigate({ status: event.target.value || null })}
            className="sm:w-44"
            aria-label="Filter by status"
          >
            {STATUSES.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
          <Button
            variant={lowStock ? 'primary' : 'secondary'}
            onClick={() => navigate({ lowStock: lowStock ? null : 'true' })}
            icon={<Boxes className="h-4 w-4" />}
          >
            Low stock
          </Button>
        </div>
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
          title={q || status || lowStock ? 'No products match these filters' : 'No products yet'}
          description={
            q || status || lowStock
              ? 'Try clearing the search, status or low-stock filter.'
              : 'Create your first product. Drafts can be prepared before your store is approved.'
          }
          action={
            q || status || lowStock ? (
              <Button variant="secondary" onClick={() => navigate({ q: null, status: null, lowStock: null })}>
                Clear filters
              </Button>
            ) : (
              <ButtonLink href="/seller/products/new/">Add your first product</ButtonLink>
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
                  <th>Status</th>
                  <th>Price</th>
                  <th>Stock</th>
                  <th>Updated</th>
                  <th className="text-right">Actions</th>
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
                            href={`/seller/product/?id=${product.id}`}
                            className="block max-w-[260px] truncate text-sm font-bold text-navy hover:text-indigo-700"
                          >
                            {product.name}
                          </Link>
                          <p className="text-[11px] text-slate-500">
                            {product.sku} · {product.category.name}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td>
                      <StatusBadge status={product.status} type="product" />
                    </td>
                    <td>
                      <p className="text-sm font-bold text-navy">{formatMoney(product.price)}</p>
                      {product.compareAtPrice ? (
                        <p className="text-[11px] text-slate-400 line-through">
                          {formatMoney(product.compareAtPrice)}
                        </p>
                      ) : null}
                    </td>
                    <td>
                      <p className="text-sm font-semibold text-slate-800">{product.available} available</p>
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
                      <span className="text-xs text-slate-500">{relativeTime(product.updatedAt)}</span>
                    </td>
                    <td>
                      <div className="flex items-center justify-end gap-1">
                        <ButtonLink
                          href={`/seller/product/?id=${product.id}`}
                          size="sm"
                          variant="ghost"
                          icon={<Pencil className="h-3.5 w-3.5" />}
                        >
                          Edit
                        </ButtonLink>
                        {product.status !== 'ARCHIVED' ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-rose-600 hover:bg-rose-50"
                            onClick={() => setArchiveTarget(product)}
                            icon={<Archive className="h-3.5 w-3.5" />}
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

      <ConfirmDialog
        open={archiveTarget !== null}
        title="Archive this product?"
        description={
          archiveTarget
            ? `${archiveTarget.name} will be hidden from the marketplace. Existing order history is preserved and you can restore it as a draft later.`
            : ''
        }
        confirmLabel="Archive product"
        loading={archiving}
        onConfirm={archive}
        onClose={() => setArchiveTarget(null)}
      />
    </div>
  );
}

export default function SellerProductsPage() {
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
