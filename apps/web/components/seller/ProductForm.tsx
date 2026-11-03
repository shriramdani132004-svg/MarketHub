'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ArrowLeft, ImageOff, Save, Store } from 'lucide-react';
import { useApiData } from '../../lib/useApi';
import { api, errorMessage } from '../../lib/api';
import type { Category, SellerProduct } from '../../lib/types';
import { formatMoney } from '../../lib/format';
import {
  Button,
  ButtonLink,
  Field,
  Input,
  Select,
  Textarea,
} from '../ui';
import { useToast } from '../ui/toast';

interface ProductFormValues {
  name: string;
  description: string;
  categoryId: string;
  brand: string;
  sku: string;
  price: string;
  compareAtPrice: string;
  stockOnHand: string;
  imageUrl: string;
  status: string;
}

const EMPTY: ProductFormValues = {
  name: '',
  description: '',
  categoryId: '',
  brand: '',
  sku: '',
  price: '',
  compareAtPrice: '',
  stockOnHand: '0',
  imageUrl: '',
  status: 'DRAFT',
};

function allowedStatuses(current: string): string[] {
  switch (current) {
    case 'DRAFT':
      return ['DRAFT', 'PUBLISHED', 'ARCHIVED'];
    case 'PUBLISHED':
      return ['PUBLISHED', 'DRAFT', 'ARCHIVED'];
    case 'OUT_OF_STOCK':
      return ['OUT_OF_STOCK', 'PUBLISHED', 'ARCHIVED'];
    case 'ARCHIVED':
      return ['ARCHIVED', 'DRAFT'];
    default:
      return ['DRAFT', 'PUBLISHED', 'ARCHIVED'];
  }
}

export function ProductForm({ product }: { product?: SellerProduct }) {
  const router = useRouter();
  const toast = useToast();
  const categories = useApiData<{ items: Category[] }>('/categories');
  const editing = Boolean(product);

  const [form, setForm] = useState<ProductFormValues>(() =>
    product
      ? {
          name: product.name,
          description: product.description,
          categoryId: product.category.id,
          brand: product.brand ?? '',
          sku: product.sku,
          price: product.price,
          compareAtPrice: product.compareAtPrice ?? '',
          stockOnHand: String(product.stockOnHand),
          imageUrl: product.imageUrl ?? '',
          status: product.status,
        }
      : { ...EMPTY },
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!editing && !form.categoryId && categories.data?.items.length) {
      setForm((current) => ({ ...current, categoryId: categories.data!.items[0].id }));
    }
  }, [categories.data, editing, form.categoryId]);

  function update<K extends keyof ProductFormValues>(key: K, value: ProductFormValues[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  const priceNumber = Number(form.price);
  const compareNumber = Number(form.compareAtPrice);
  const discount =
    form.compareAtPrice && compareNumber > priceNumber && priceNumber > 0
      ? Math.round((1 - priceNumber / compareNumber) * 100)
      : 0;

  const statuses = editing && product ? allowedStatuses(product.status) : ['DRAFT', 'PUBLISHED'];

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const body: Record<string, unknown> = {
        name: form.name.trim(),
        description: form.description.trim(),
        categoryId: form.categoryId,
        brand: form.brand.trim() || undefined,
        sku: form.sku.trim(),
        price: form.price.trim(),
        compareAtPrice: form.compareAtPrice.trim() || undefined,
        imageUrl: form.imageUrl.trim() || undefined,
        status: form.status,
      };
      if (!editing) {
        body.stockOnHand = Number(form.stockOnHand) || 0;
      }

      if (editing && product) {
        await api(`/seller/products/${product.id}`, { method: 'PATCH', body });
        toast.success('Product updated.');
        router.push(`/seller/product/?id=${product.id}`);
      } else {
        const created = await api<SellerProduct>('/seller/products', {
          method: 'POST',
          body,
        });
        toast.success('Product created.');
        router.push(`/seller/product/?id=${created.id}`);
      }
    } catch (cause) {
      setError(errorMessage(cause));
      setBusy(false);
    }
  }

  const categoriesReady = Boolean(categories.data);

  return (
    <form onSubmit={submit} className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <ButtonLink href="/seller/products/" size="sm" variant="ghost" icon={<ArrowLeft className="h-3.5 w-3.5" />}>
            Back to products
          </ButtonLink>
          <h1 className="mt-2 text-2xl font-extrabold tracking-tight text-navy">
            {editing ? 'Edit product' : 'New product'}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {editing
              ? 'Update listing details. Use the inventory panel to change stock.'
              : 'Draft a listing now. Publishing requires an approved store and available stock.'}
          </p>
        </div>
        <Button type="submit" loading={busy} icon={<Save className="h-4 w-4" />}>
          {editing ? 'Save changes' : 'Create product'}
        </Button>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.5fr_1fr] xl:items-start">
        <div className="space-y-4">
          <section className="card space-y-4 p-5">
            <h2 className="text-base font-bold text-navy">Listing details</h2>
            <Field label="Product name" required>
              <Input
                value={form.name}
                onChange={(event) => update('name', event.target.value)}
                required
                minLength={3}
                maxLength={140}
                placeholder="Studio monitor headphones"
              />
            </Field>
            <Field label="Description" required hint="At least 20 characters. Describe materials, fit and use.">
              <Textarea
                value={form.description}
                onChange={(event) => update('description', event.target.value)}
                required
                minLength={20}
                maxLength={5000}
                className="min-h-[150px]"
                placeholder="Closed-back studio headphones with…"
              />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Category" required>
                <Select
                  value={form.categoryId}
                  onChange={(event) => update('categoryId', event.target.value)}
                  required
                  disabled={!categoriesReady}
                >
                  <option value="">Select a category</option>
                  {(categories.data?.items ?? []).map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.parentId ? '— ' : ''}
                      {category.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Brand" hint="Optional">
                <Input
                  value={form.brand}
                  onChange={(event) => update('brand', event.target.value)}
                  maxLength={80}
                  placeholder="Nimbus"
                />
              </Field>
            </div>
            <Field label="SKU" required hint="Unique within your store. 3-40 letters, numbers, dots, dashes.">
              <Input
                value={form.sku}
                onChange={(event) => update('sku', event.target.value)}
                required
                pattern="^[A-Za-z0-9._-]{3,40}$"
                maxLength={40}
                placeholder="NMB-HP-001"
              />
            </Field>
          </section>

          <section className="card space-y-4 p-5">
            <h2 className="text-base font-bold text-navy">Pricing and stock</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Selling price (₹)" required>
                <Input
                  value={form.price}
                  onChange={(event) => update('price', event.target.value)}
                  required
                  inputMode="decimal"
                  pattern="^\d{1,10}(\.\d{1,2})?$"
                  placeholder="1299.00"
                />
              </Field>
              <Field label="Compare-at price (₹)" hint="Optional original price">
                <Input
                  value={form.compareAtPrice}
                  onChange={(event) => update('compareAtPrice', event.target.value)}
                  inputMode="decimal"
                  pattern="^\d{1,10}(\.\d{1,2})?$"
                  placeholder="1799.00"
                />
              </Field>
            </div>
            {discount > 0 ? (
              <p className="text-xs font-semibold text-teal-700">
                Customers will see a {discount}% discount badge.
              </p>
            ) : null}

            {!editing ? (
              <Field label="Opening stock on hand" hint="Non-negative whole units. You can adjust later.">
                <Input
                  type="number"
                  min={0}
                  max={1000000}
                  step={1}
                  value={form.stockOnHand}
                  onChange={(event) => update('stockOnHand', event.target.value)}
                />
              </Field>
            ) : (
              <div className="rounded-xl bg-slate-50 p-3 text-xs text-slate-600">
                Current stock: <strong className="text-navy">{product?.stockOnHand}</strong> on hand ·{' '}
                <strong className="text-navy">{product?.reservedStock}</strong> reserved ·{' '}
                <strong className="text-navy">{product?.available}</strong> available. Adjust it from{' '}
                <Link href="/seller/inventory/" className="font-bold text-indigo-600 hover:text-indigo-800">
                  Inventory
                </Link>
                .
              </div>
            )}
          </section>

          <section className="card space-y-4 p-5">
            <h2 className="text-base font-bold text-navy">Media</h2>
            <Field label="Image URL" hint="Optional. Must be a valid http(s) image URL.">
              <Input
                value={form.imageUrl}
                onChange={(event) => update('imageUrl', event.target.value)}
                maxLength={500}
                placeholder="https://images.example.com/product.jpg"
              />
            </Field>
            <div className="flex items-center gap-3 rounded-xl border border-dashed border-slate-300 bg-slate-50/60 p-3">
              <span className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-white">
                {form.imageUrl ? (
                  <img src={form.imageUrl} alt="Product preview" className="h-full w-full object-cover" />
                ) : (
                  <ImageOff className="h-6 w-6 text-slate-300" aria-hidden />
                )}
              </span>
              <p className="text-xs text-slate-500">
                A square image works best. If the URL is invalid the marketplace shows a neutral
                placeholder instead.
              </p>
            </div>
          </section>
        </div>

        <div className="space-y-4 xl:sticky xl:top-24">
          <section className="card space-y-3 p-5">
            <h2 className="text-base font-bold text-navy">Visibility</h2>
            <Field label="Status">
              <Select
                value={form.status}
                onChange={(event) => update('status', event.target.value)}
              >
                {statuses.map((status) => (
                  <option key={status} value={status}>
                    {status === 'DRAFT'
                      ? 'Draft — hidden'
                      : status === 'PUBLISHED'
                        ? 'Published — live'
                        : status === 'OUT_OF_STOCK'
                          ? 'Out of stock — hidden'
                          : 'Archived'}
                  </option>
                ))}
              </Select>
            </Field>
            <p className="text-[11px] leading-5 text-slate-500">
              Publishing requires available stock and an approved store. Out-of-stock is applied
              automatically by the inventory system.
            </p>
            {editing ? (
              <div className="rounded-lg bg-slate-50 px-3 py-2 text-[11px] text-slate-600">
                Current status: <strong>{product?.status}</strong>
              </div>
            ) : null}
          </section>

          <section className="card p-5">
            <h2 className="flex items-center gap-2 text-base font-bold text-navy">
              <Store className="h-4 w-4 text-teal-600" aria-hidden />
              Preview
            </h2>
            <div className="mt-3 rounded-xl border border-slate-200 p-3">
              <div className="aspect-[4/3] overflow-hidden rounded-lg bg-slate-100">
                {form.imageUrl ? (
                  <img src={form.imageUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-teal-50">
                    <ImageOff className="h-7 w-7 text-slate-300" aria-hidden />
                  </div>
                )}
              </div>
              <p className="mt-2 line-clamp-2 text-sm font-bold text-navy">
                {form.name || 'Product name'}
              </p>
              <p className="mt-1 text-base font-extrabold text-navy">
                {form.price ? formatMoney(form.price) : '₹—'}
              </p>
            </div>
          </section>

          {error ? (
            <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">
              {error}
            </p>
          ) : null}

          <Button type="submit" size="lg" className="w-full" loading={busy} icon={<Save className="h-4 w-4" />}>
            {editing ? 'Save changes' : 'Create product'}
          </Button>
        </div>
      </div>
    </form>
  );
}
