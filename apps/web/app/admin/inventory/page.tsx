'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense, useMemo, useState } from 'react';
import { RefreshCw, Search, Warehouse } from 'lucide-react';
import { useApiData } from '../../../lib/useApi';
import type { InventoryMovement, Paginated } from '../../../lib/types';
import { formatDateTime, statusLabel } from '../../../lib/format';
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
} from '../../../components/ui';

const MOVEMENT_TYPES = [
  { value: '', label: 'All movements' },
  { value: 'STOCK_ADDED', label: 'Stock added' },
  { value: 'STOCK_RESERVED', label: 'Stock reserved' },
  { value: 'STOCK_RELEASED', label: 'Stock released' },
  { value: 'SALE_CONFIRMED', label: 'Sale confirmed' },
  { value: 'RESTOCKED', label: 'Restocked' },
  { value: 'ADJUSTMENT', label: 'Adjustment' },
];

const TONES: Record<string, 'teal' | 'amber' | 'violet' | 'indigo' | 'slate' | 'sky'> = {
  STOCK_ADDED: 'teal',
  RESTOCKED: 'teal',
  STOCK_RESERVED: 'amber',
  STOCK_RELEASED: 'violet',
  SALE_CONFIRMED: 'indigo',
  ADJUSTMENT: 'sky',
};

function InventoryView() {
  const params = useSearchParams();
  const q = params.get('q') ?? '';
  const movementType = params.get('movementType') ?? '';
  const page = Math.max(1, Number(params.get('page') ?? '1') || 1);
  const [search, setSearch] = useState(q);

  const path = useMemo(() => {
    const searchParams = new URLSearchParams();
    searchParams.set('page', String(page));
    searchParams.set('pageSize', '20');
    if (q) searchParams.set('q', q);
    if (movementType) searchParams.set('movementType', movementType);
    return `/admin/inventory?${searchParams.toString()}`;
  }, [page, q, movementType]);

  const movements = useApiData<Paginated<InventoryMovement>>(path);

  function navigate(next: Record<string, string | null>, resetPage = true) {
    const searchParams = new URLSearchParams(params.toString());
    if (resetPage) searchParams.delete('page');
    for (const [key, value] of Object.entries(next)) {
      if (!value) searchParams.delete(key);
      else searchParams.set(key, value);
    }
    const query = searchParams.toString();
    window.location.href = query ? `/admin/inventory/?${query}` : '/admin/inventory/';
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-violet-700">
            Operations
          </p>
          <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-navy">Inventory ledger</h1>
          <p className="mt-1 text-sm text-slate-500">
            Immutable movement history across every seller. Each reservation, sale and manual
            adjustment is recorded once.
          </p>
        </div>
        <Button
          size="sm"
          variant="ghost"
          icon={<RefreshCw className="h-4 w-4" />}
          onClick={() => movements.reload()}
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
            placeholder="Search product, store or reference"
            className="pl-9"
            aria-label="Search inventory movements"
          />
        </form>
        <Select
          value={movementType}
          onChange={(event) => navigate({ movementType: event.target.value || null })}
          className="sm:w-52"
          aria-label="Filter by movement type"
        >
          {MOVEMENT_TYPES.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
      </div>

      {movements.error ? (
        <ErrorState message={movements.error} onRetry={movements.reload} />
      ) : movements.loading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-16 w-full rounded-2xl" />
          ))}
        </div>
      ) : (movements.data?.items.length ?? 0) === 0 ? (
        <EmptyState
          icon={<Warehouse className="h-5 w-5" />}
          title={q || movementType ? 'No movements match these filters' : 'No inventory movements yet'}
          description="Stock reservations, sales and seller adjustments will appear here in chronological order."
          action={
            q || movementType ? (
              <Button variant="secondary" onClick={() => navigate({ q: null, movementType: null })}>
                Clear filters
              </Button>
            ) : (
              <ButtonLink href="/admin/products/" variant="secondary">
                View products
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
                  <th>Movement</th>
                  <th>Quantity</th>
                  <th>Reference</th>
                  <th>Recorded</th>
                </tr>
              </thead>
              <tbody>
                {movements.data?.items.map((movement) => (
                  <tr key={movement.id}>
                    <td>
                      <p className="text-sm font-semibold text-slate-800">{movement.product.name}</p>
                      <p className="text-[11px] text-slate-500">{movement.product.sku}</p>
                    </td>
                    <td>
                      <p className="text-sm text-slate-700">{movement.seller.storeName}</p>
                    </td>
                    <td>
                      <Badge tone={TONES[movement.movementType] ?? 'slate'}>
                        {statusLabel(movement.movementType)}
                      </Badge>
                    </td>
                    <td>
                      <span
                        className={
                          movement.quantity >= 0
                            ? 'text-sm font-bold text-teal-700'
                            : 'text-sm font-bold text-rose-600'
                        }
                      >
                        {movement.quantity > 0 ? `+${movement.quantity}` : movement.quantity}
                      </span>
                    </td>
                    <td>
                      <p className="max-w-[220px] truncate font-mono text-[11px] text-slate-500">
                        {movement.reference ?? '—'}
                      </p>
                    </td>
                    <td>
                      <p className="text-xs text-slate-600">{formatDateTime(movement.createdAt)}</p>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination
            page={movements.data?.meta.page ?? page}
            totalPages={movements.data?.meta.totalPages ?? 1}
            total={movements.data?.meta.total}
            onChange={(next) => navigate({ page: String(next) }, false)}
          />
        </>
      )}

      <p className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-[11px] leading-5 text-slate-500">
        The ledger is append-only. Negative quantities represent reservations or confirmed sales;
        positive quantities represent stock additions, restocks and releases.
      </p>
    </div>
  );
}

export default function AdminInventoryPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-3">
          <Skeleton className="h-16 w-full rounded-2xl" />
          <Skeleton className="h-64 w-full rounded-2xl" />
        </div>
      }
    >
      <InventoryView />
    </Suspense>
  );
}
