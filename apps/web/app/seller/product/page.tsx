'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { Boxes, ClipboardList, Save } from 'lucide-react';
import { useApiData } from '../../../lib/useApi';
import { api, errorMessage } from '../../../lib/api';
import type { SellerProduct } from '../../../lib/types';
import { formatDateTime, formatMoney } from '../../../lib/format';
import {
  Badge,
  Button,
  ButtonLink,
  EmptyState,
  ErrorState,
  Field,
  Input,
  Skeleton,
  StatusBadge,
} from '../../../components/ui';
import { useToast } from '../../../components/ui/toast';
import { ProductForm } from '../../../components/seller/ProductForm';

function ProductEditView() {
  const params = useSearchParams();
  const id = params.get('id');
  const toast = useToast();
  const product = useApiData<SellerProduct>(id ? `/seller/products/${id}` : null);
  const [stock, setStock] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (product.data) setStock(String(product.data.stockOnHand));
  }, [product.data]);

  if (!id) {
    return (
      <EmptyState
        icon={<Boxes className="h-5 w-5" />}
        title="No product selected"
        description="Choose a product from your catalogue to edit it."
        action={<ButtonLink href="/seller/products/">Products</ButtonLink>}
      />
    );
  }

  if (product.loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-16 w-full rounded-2xl" />
        <Skeleton className="h-96 w-full rounded-2xl" />
      </div>
    );
  }

  if (product.error || !product.data) {
    return (
      <div className="space-y-4">
        <ErrorState message={product.error ?? 'Product not found.'} onRetry={product.reload} />
        <div className="text-center">
          <ButtonLink href="/seller/products/" variant="secondary">
            Back to products
          </ButtonLink>
        </div>
      </div>
    );
  }

  const data = product.data;

  async function adjustStock(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api(`/seller/products/${data.id}/inventory`, {
        method: 'PATCH',
        body: {
          stockOnHand: Number(stock),
          reason: reason.trim() || undefined,
        },
      });
      toast.success('Inventory updated and recorded in the ledger.');
      setReason('');
      product.reload();
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="card p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">
                Product
              </p>
              <p className="text-base font-extrabold text-navy">{data.name}</p>
              <p className="text-xs text-slate-500">
                {data.sku} · updated {formatDateTime(data.updatedAt)}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={data.status} type="product" />
            {data.lowStock ? <Badge tone="amber">Low stock</Badge> : null}
            <ButtonLink
              href={`/product/?id=${data.id}`}
              size="sm"
              variant="secondary"
              icon={<ClipboardList className="h-3.5 w-3.5" />}
            >
              Public page
            </ButtonLink>
          </div>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr] xl:items-start">
        <div className="space-y-4">
          <ProductForm product={data} />
        </div>

        <div className="space-y-4 xl:sticky xl:top-24">
          <section className="card space-y-3 p-5">
            <h2 className="flex items-center gap-2 text-base font-bold text-navy">
              <Boxes className="h-4 w-4 text-indigo-600" aria-hidden />
              Inventory
            </h2>
            <dl className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-lg bg-slate-50 px-2 py-2">
                <dt className="text-[10px] font-bold uppercase text-slate-500">On hand</dt>
                <dd className="mt-0.5 text-lg font-extrabold text-navy">{data.stockOnHand}</dd>
              </div>
              <div className="rounded-lg bg-amber-50 px-2 py-2">
                <dt className="text-[10px] font-bold uppercase text-amber-700">Reserved</dt>
                <dd className="mt-0.5 text-lg font-extrabold text-amber-800">{data.reservedStock}</dd>
              </div>
              <div className="rounded-lg bg-teal-50 px-2 py-2">
                <dt className="text-[10px] font-bold uppercase text-teal-700">Available</dt>
                <dd className="mt-0.5 text-lg font-extrabold text-teal-800">{data.available}</dd>
              </div>
            </dl>
            <p className="text-[11px] leading-5 text-slate-500">
              Reserved units belong to pending demo orders. Stock on hand can never be set below
              that reservation.
            </p>
            <form onSubmit={adjustStock} className="space-y-3 border-t border-slate-100 pt-3">
              <Field label="New stock on hand" required>
                <Input
                  type="number"
                  min={data.reservedStock}
                  max={1000000}
                  step={1}
                  value={stock}
                  onChange={(event) => setStock(event.target.value)}
                  required
                />
              </Field>
              <Field label="Reason" hint="Recorded on the inventory ledger">
                <Input
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  maxLength={200}
                  placeholder="New shipment received"
                />
              </Field>
              {error ? (
                <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">
                  {error}
                </p>
              ) : null}
              <Button type="submit" loading={busy} className="w-full" icon={<Save className="h-4 w-4" />}>
                Update inventory
              </Button>
            </form>
          </section>

          <section className="card space-y-2 p-5 text-xs text-slate-600">
            <h2 className="text-base font-bold text-navy">Listing facts</h2>
            <div className="flex justify-between border-b border-slate-100 py-1.5">
              <span className="text-slate-500">Price</span>
              <span className="font-bold text-navy">{formatMoney(data.price)}</span>
            </div>
            {data.compareAtPrice ? (
              <div className="flex justify-between border-b border-slate-100 py-1.5">
                <span className="text-slate-500">Compare at</span>
                <span className="font-semibold text-slate-700">{formatMoney(data.compareAtPrice)}</span>
              </div>
            ) : null}
            <div className="flex justify-between border-b border-slate-100 py-1.5">
              <span className="text-slate-500">Category</span>
              <span className="font-semibold text-slate-700">{data.category.name}</span>
            </div>
            <div className="flex justify-between border-b border-slate-100 py-1.5">
              <span className="text-slate-500">Order items</span>
              <span className="font-semibold text-slate-700">{data.orderItemCount}</span>
            </div>
            <div className="flex justify-between py-1.5">
              <span className="text-slate-500">Slug</span>
              <span className="max-w-[60%] truncate font-semibold text-slate-700">{data.slug}</span>
            </div>
            <Link href="/seller/inventory/" className="inline-flex pt-1 text-xs font-bold text-indigo-600 hover:text-indigo-800">
              Open full inventory ledger →
            </Link>
          </section>
        </div>
      </div>
    </div>
  );
}

export default function EditProductPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-4">
          <Skeleton className="h-16 w-full rounded-2xl" />
          <Skeleton className="h-96 w-full rounded-2xl" />
        </div>
      }
    >
      <ProductEditView />
    </Suspense>
  );
}
