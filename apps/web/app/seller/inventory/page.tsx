'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Boxes, Package, Search, SlidersHorizontal, TriangleAlert, Warehouse } from 'lucide-react';
import { useApiData } from '../../../lib/useApi';
import { api, errorMessage } from '../../../lib/api';
import type { Paginated, SellerAnalytics, SellerProduct } from '../../../lib/types';
import { formatDateTime, formatMoney, statusLabel } from '../../../lib/format';
import {
  Badge,
  Button,
  ButtonLink,
  EmptyState,
  ErrorState,
  Field,
  Input,
  Modal,
  ProductImage,
  Skeleton,
  StatusBadge,
} from '../../../components/ui';
import { useToast } from '../../../components/ui/toast';

export default function SellerInventoryPage() {
  const toast = useToast();
  const products = useApiData<Paginated<SellerProduct>>('/seller/products?pageSize=100');
  const analytics = useApiData<SellerAnalytics>('/analytics/seller');
  const [search, setSearch] = useState('');
  const [lowOnly, setLowOnly] = useState(false);
  const [target, setTarget] = useState<SellerProduct | null>(null);
  const [stock, setStock] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function openAdjust(product: SellerProduct) {
    setTarget(product);
    setStock(String(product.stockOnHand));
    setReason('');
    setError(null);
  }

  async function adjust(event: React.FormEvent) {
    event.preventDefault();
    if (!target) return;
    setBusy(true);
    setError(null);
    try {
      await api(`/seller/products/${target.id}/inventory`, {
        method: 'PATCH',
        body: { stockOnHand: Number(stock), reason: reason.trim() || undefined },
      });
      toast.success(`${target.name} stock updated.`);
      setTarget(null);
      products.reload();
      analytics.reload();
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  }

  const items = (products.data?.items ?? []).filter((product) => {
    const term = search.trim().toLowerCase();
    const matchesTerm =
      !term ||
      product.name.toLowerCase().includes(term) ||
      product.sku.toLowerCase().includes(term);
    return matchesTerm && (!lowOnly || product.lowStock || product.available <= 0);
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-teal-700">Inventory</p>
          <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-navy">Stock control</h1>
          <p className="mt-1 text-sm text-slate-500">
            Adjust stock on hand. Every change is recorded in the inventory ledger.
          </p>
        </div>
        <ButtonLink href="/seller/products/new/" size="sm" variant="secondary">
          Add product
        </ButtonLink>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          {
            label: 'Low stock',
            value: analytics.data?.products.lowStock ?? '—',
            icon: <TriangleAlert className="h-5 w-5" />,
            tone: 'bg-amber-50 text-amber-600',
          },
          {
            label: 'Out of stock',
            value: analytics.data?.products.outOfStock ?? '—',
            icon: <Boxes className="h-5 w-5" />,
            tone: 'bg-orange-50 text-orange-600',
          },
          {
            label: 'Published',
            value: analytics.data?.products.published ?? '—',
            icon: <Package className="h-5 w-5" />,
            tone: 'bg-teal-50 text-teal-600',
          },
          {
            label: 'All products',
            value: analytics.data?.products.total ?? '—',
            icon: <Warehouse className="h-5 w-5" />,
            tone: 'bg-indigo-50 text-indigo-600',
          },
        ].map((stat) => (
          <div key={stat.label} className="card flex items-center gap-3 p-4">
            <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${stat.tone}`}>
              {stat.icon}
            </span>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-slate-500">
                {stat.label}
              </p>
              <p className="text-xl font-extrabold text-navy">{stat.value}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="card flex flex-col gap-2 p-3.5 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search product or SKU"
            className="pl-9"
            aria-label="Search inventory"
          />
        </div>
        <Button
          variant={lowOnly ? 'primary' : 'secondary'}
          onClick={() => setLowOnly((value) => !value)}
          icon={<SlidersHorizontal className="h-4 w-4" />}
        >
          {lowOnly ? 'Showing attention needed' : 'Show attention needed'}
        </Button>
      </div>

      {products.error ? (
        <ErrorState message={products.error} onRetry={products.reload} />
      ) : products.loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, index) => (
            <Skeleton key={index} className="h-20 w-full rounded-2xl" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={<Boxes className="h-5 w-5" />}
          title={search || lowOnly ? 'No matching inventory' : 'No products yet'}
          description={
            search || lowOnly
              ? 'Try a different search or turn off the attention filter.'
              : 'Create a product to start tracking stock.'
          }
          action={
            <ButtonLink href="/seller/products/new/">Add product</ButtonLink>
          }
        />
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Product</th>
                <th>Status</th>
                <th>On hand</th>
                <th>Reserved</th>
                <th>Available</th>
                <th className="text-right">Adjust</th>
              </tr>
            </thead>
            <tbody>
              {items.map((product) => (
                <tr key={product.id}>
                  <td>
                    <div className="flex items-center gap-3">
                      <span className="h-11 w-11 shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-white">
                        <ProductImage src={product.imageUrl} alt={product.name} />
                      </span>
                      <div className="min-w-0">
                        <Link
                          href={`/seller/product/?id=${product.id}`}
                          className="block max-w-[240px] truncate text-sm font-bold text-navy hover:text-indigo-700"
                        >
                          {product.name}
                        </Link>
                        <p className="text-[11px] text-slate-500">
                          {product.sku} · {formatMoney(product.price)}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td>
                    <StatusBadge status={product.status} type="product" />
                  </td>
                  <td className="font-semibold text-slate-800">{product.stockOnHand}</td>
                  <td className="text-amber-700">{product.reservedStock}</td>
                  <td>
                    <span className="font-bold text-navy">{product.available}</span>
                    {product.available <= 0 ? (
                      <Badge tone="rose" className="ml-2">
                        Sold out
                      </Badge>
                    ) : product.lowStock ? (
                      <Badge tone="amber" className="ml-2">
                        Low
                      </Badge>
                    ) : null}
                  </td>
                  <td className="text-right">
                    <Button size="sm" variant="secondary" onClick={() => openAdjust(product)}>
                      Adjust stock
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="card overflow-hidden">
        <div className="border-b border-slate-100 px-5 py-4">
          <h2 className="text-base font-bold text-navy">Recent inventory movements</h2>
          <p className="mt-0.5 text-xs text-slate-500">Latest entries from your immutable ledger</p>
        </div>
        {(analytics.data?.inventoryMovements.length ?? 0) === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-slate-500">
            No inventory movements recorded yet.
          </p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {analytics.data?.inventoryMovements.map((movement) => (
              <li key={movement.id} className="flex items-center justify-between gap-3 px-5 py-3 text-xs">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-slate-800">{movement.product.name}</p>
                  <p className="text-[11px] text-slate-500">
                    {statusLabel(movement.movementType)} · {movement.reference ?? 'No reference'}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-navy">{movement.quantity} units</p>
                  <p className="text-[10px] text-slate-400">{formatDateTime(movement.createdAt)}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Modal
        open={target !== null}
        onClose={() => setTarget(null)}
        title="Adjust stock on hand"
        description={target ? `${target.name} · ${target.sku}` : undefined}
        footer={
          <>
            <Button variant="secondary" onClick={() => setTarget(null)} disabled={busy}>
              Cancel
            </Button>
            <Button
              loading={busy}
              onClick={() => {
                const form = document.getElementById('stock-form') as HTMLFormElement | null;
                form?.requestSubmit();
              }}
            >
              Save stock
            </Button>
          </>
        }
      >
        {target ? (
          <form id="stock-form" onSubmit={adjust} className="space-y-3">
            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              <div className="rounded-lg bg-slate-50 p-2">
                <p className="text-[10px] font-bold uppercase text-slate-500">On hand</p>
                <p className="text-base font-extrabold text-navy">{target.stockOnHand}</p>
              </div>
              <div className="rounded-lg bg-amber-50 p-2">
                <p className="text-[10px] font-bold uppercase text-amber-700">Reserved</p>
                <p className="text-base font-extrabold text-amber-800">{target.reservedStock}</p>
              </div>
              <div className="rounded-lg bg-teal-50 p-2">
                <p className="text-[10px] font-bold uppercase text-teal-700">Available</p>
                <p className="text-base font-extrabold text-teal-800">{target.available}</p>
              </div>
            </div>
            <Field label="New stock on hand" required hint={`Minimum ${target.reservedStock} to honour current reservations.`}>
              <Input
                type="number"
                min={target.reservedStock}
                max={1000000}
                step={1}
                value={stock}
                onChange={(event) => setStock(event.target.value)}
                required
                autoFocus
              />
            </Field>
            <Field label="Reason" hint="Optional note stored with the ledger entry">
              <Input
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                maxLength={200}
                placeholder="Cycle count adjustment"
              />
            </Field>
            {error ? (
              <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">
                {error}
              </p>
            ) : null}
          </form>
        ) : null}
      </Modal>
    </div>
  );
}
