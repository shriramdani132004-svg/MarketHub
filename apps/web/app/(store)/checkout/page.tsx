'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  MapPin,
  PackageCheck,
  Plus,
  Store,
  Truck,
} from 'lucide-react';
import { useAuth } from '../../../lib/auth';
import { useCart } from '../../../lib/cart';
import { useApiData } from '../../../lib/useApi';
import { api, errorMessage } from '../../../lib/api';
import type { Address, CheckoutSummary } from '../../../lib/types';
import { formatMoney } from '../../../lib/format';
import {
  Button,
  ButtonLink,
  DemoPaymentNotice,
  EmptyState,
  Field,
  Input,
  Spinner,
} from '../../../components/ui';
import { useToast } from '../../../components/ui/toast';

const BLANK_ADDRESS = {
  recipientName: '',
  phone: '',
  addressLine1: '',
  addressLine2: '',
  city: '',
  state: '',
  postalCode: '',
  country: 'India',
  isDefault: true,
};

export default function CheckoutPage() {
  const { user, loading: authLoading } = useAuth();
  const { cart, loading: cartLoading, refresh } = useCart();
  const toast = useToast();
  const router = useRouter();

  const addresses = useApiData<{ items: Address[] }>(user?.role === 'CUSTOMER' ? '/addresses' : null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ ...BLANK_ADDRESS });
  const [savingAddress, setSavingAddress] = useState(false);
  const [placing, setPlacing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const idempotencyKey = useRef<string>('');

  useEffect(() => {
    idempotencyKey.current = `checkout-${crypto.randomUUID()}`;
  }, []);

  useEffect(() => {
    if (!selectedId && addresses.data?.items.length) {
      const preferred = addresses.data.items.find((address) => address.isDefault) ?? addresses.data.items[0];
      setSelectedId(preferred.id);
    }
    if (addresses.data && addresses.data.items.length === 0) setShowForm(true);
  }, [addresses.data, selectedId]);

  const groups = useMemo(() => {
    const map = new Map<
      string,
      { seller: (typeof cart.items)[number]['product']['seller']; items: typeof cart.items; subtotal: number }
    >();
    for (const item of cart.items) {
      const key = item.product.seller.id;
      const group = map.get(key) ?? { seller: item.product.seller, items: [], subtotal: 0 };
      group.items.push(item);
      group.subtotal += Number(item.lineTotal);
      map.set(key, group);
    }
    return [...map.values()];
  }, [cart]);

  if (authLoading) {
    return (
      <div className="container-hub py-16">
        <Spinner />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="container-hub py-16">
        <EmptyState
          icon={<MapPin className="h-5 w-5" />}
          title="Sign in to check out"
          description="Your cart and delivery addresses are tied to your secure MarketHub session."
          action={<ButtonLink href="/login/?next=%2Fcheckout%2F">Sign in</ButtonLink>}
        />
      </div>
    );
  }

  if (cart.items.length === 0 && !cartLoading) {
    return (
      <div className="container-hub py-16">
        <EmptyState
          icon={<PackageCheck className="h-5 w-5" />}
          title="Nothing to check out"
          description="Add products to your cart first, then return to complete the marketplace checkout."
          action={<ButtonLink href="/products/">Browse products</ButtonLink>}
        />
      </div>
    );
  }

  function updateField(key: keyof typeof BLANK_ADDRESS, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function saveAddress(event: React.FormEvent) {
    event.preventDefault();
    setSavingAddress(true);
    setError(null);
    try {
      const created = await api<Address>('/addresses', {
        method: 'POST',
        body: {
          ...form,
          addressLine2: form.addressLine2.trim() || undefined,
        },
      });
      setShowForm(false);
      setForm({ ...BLANK_ADDRESS });
      setSelectedId(created.id);
      addresses.reload();
      toast.success('Delivery address saved.');
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setSavingAddress(false);
    }
  }

  async function placeOrder() {
    if (!selectedId) {
      setError('Choose a delivery address before placing the order.');
      return;
    }
    if (cart.hasIssues) {
      setError('Some cart items have availability issues. Return to the cart to resolve them.');
      return;
    }
    setPlacing(true);
    setError(null);
    try {
      const summary = await api<CheckoutSummary>('/checkout', {
        method: 'POST',
        body: { addressId: selectedId, idempotencyKey: idempotencyKey.current },
      });
      await refresh();
      toast.success(`Order ${summary.orderNumber} created. Complete the demo payment to confirm.`);
      router.push(`/payment/?id=${summary.paymentId}`);
    } catch (cause) {
      setError(errorMessage(cause));
      setPlacing(false);
    }
  }

  return (
    <div className="container-hub py-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-indigo-600">Checkout</p>
          <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-navy sm:text-3xl">
            Delivery &amp; order review
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            One order, split automatically across {groups.length} seller{groups.length === 1 ? '' : 's'}.
          </p>
        </div>
        <Link href="/cart/" className="text-sm font-bold text-indigo-600 hover:text-indigo-800">
          Edit cart
        </Link>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.5fr_1fr] lg:items-start">
        <div className="space-y-5">
          <section className="card p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="flex items-center gap-2 text-base font-bold text-navy">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-600 text-[11px] font-bold text-white">
                  1
                </span>
                Delivery address
              </h2>
              {addresses.data && addresses.data.items.length > 0 && !showForm ? (
                <Button variant="ghost" size="sm" onClick={() => setShowForm(true)} icon={<Plus className="h-3.5 w-3.5" />}>
                  Add address
                </Button>
              ) : null}
            </div>

            {addresses.loading ? (
              <div className="mt-4">
                <Spinner />
              </div>
            ) : addresses.data?.items.length === 0 && !showForm ? (
              <p className="mt-3 text-sm text-slate-500">Add a delivery address to continue.</p>
            ) : null}

            {!showForm && (addresses.data?.items.length ?? 0) > 0 ? (
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {addresses.data?.items.map((address) => (
                  <label
                    key={address.id}
                    className={`relative cursor-pointer rounded-xl border p-4 transition ${
                      selectedId === address.id
                        ? 'border-indigo-400 bg-indigo-50/50 ring-2 ring-indigo-100'
                        : 'border-slate-200 bg-white hover:border-indigo-200'
                    }`}
                  >
                    <input
                      type="radio"
                      name="address"
                      value={address.id}
                      checked={selectedId === address.id}
                      onChange={() => setSelectedId(address.id)}
                      className="sr-only"
                    />
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-bold text-navy">{address.recipientName}</p>
                        <p className="mt-0.5 text-xs text-slate-500">{address.phone}</p>
                      </div>
                      {address.isDefault ? <span className="text-[10px] font-bold uppercase text-teal-600">Default</span> : null}
                    </div>
                    <p className="mt-2 text-xs leading-5 text-slate-600">
                      {address.addressLine1}
                      {address.addressLine2 ? `, ${address.addressLine2}` : ''}
                      <br />
                      {address.city}, {address.state} {address.postalCode}
                      <br />
                      {address.country}
                    </p>
                    {selectedId === address.id ? (
                      <CheckCircle2 className="absolute bottom-3 right-3 h-5 w-5 text-indigo-600" aria-hidden />
                    ) : null}
                  </label>
                ))}
              </div>
            ) : null}

            {showForm ? (
              <form onSubmit={saveAddress} className="mt-4 space-y-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Recipient name" required>
                    <Input
                      value={form.recipientName}
                      onChange={(event) => updateField('recipientName', event.target.value)}
                      required
                      minLength={2}
                      maxLength={80}
                      placeholder="Aarav Mehta"
                    />
                  </Field>
                  <Field label="Phone" required>
                    <Input
                      value={form.phone}
                      onChange={(event) => updateField('phone', event.target.value)}
                      required
                      placeholder="9876543210"
                      pattern="^[0-9+\-\s()]{6,24}$"
                    />
                  </Field>
                </div>
                <Field label="Address line 1" required>
                  <Input
                    value={form.addressLine1}
                    onChange={(event) => updateField('addressLine1', event.target.value)}
                    required
                    minLength={4}
                    maxLength={160}
                    placeholder="Flat, house number, street"
                  />
                </Field>
                <Field label="Address line 2" hint="Optional: landmark or area">
                  <Input
                    value={form.addressLine2}
                    onChange={(event) => updateField('addressLine2', event.target.value)}
                    maxLength={160}
                    placeholder="Landmark, area"
                  />
                </Field>
                <div className="grid gap-3 sm:grid-cols-3">
                  <Field label="City" required>
                    <Input
                      value={form.city}
                      onChange={(event) => updateField('city', event.target.value)}
                      required
                      minLength={2}
                      maxLength={80}
                    />
                  </Field>
                  <Field label="State" required>
                    <Input
                      value={form.state}
                      onChange={(event) => updateField('state', event.target.value)}
                      required
                      minLength={2}
                      maxLength={80}
                    />
                  </Field>
                  <Field label="Postal code" required>
                    <Input
                      value={form.postalCode}
                      onChange={(event) => updateField('postalCode', event.target.value)}
                      required
                      pattern="^[0-9A-Za-z -]{4,12}$"
                      maxLength={12}
                    />
                  </Field>
                </div>
                <Field label="Country">
                  <Input
                    value={form.country}
                    onChange={(event) => updateField('country', event.target.value)}
                    maxLength={80}
                  />
                </Field>
                <div className="flex gap-2 pt-1">
                  <Button type="submit" loading={savingAddress}>
                    Save address
                  </Button>
                  {(addresses.data?.items.length ?? 0) > 0 ? (
                    <Button type="button" variant="secondary" onClick={() => setShowForm(false)}>
                      Cancel
                    </Button>
                  ) : null}
                </div>
              </form>
            ) : null}
          </section>

          <section className="card p-5">
            <h2 className="flex items-center gap-2 text-base font-bold text-navy">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-600 text-[11px] font-bold text-white">
                2
              </span>
              Review your items
            </h2>
            <div className="mt-4 space-y-4">
              {groups.map((group) => (
                <div key={group.seller.id} className="rounded-xl border border-slate-200">
                  <div className="flex items-center justify-between gap-2 border-b border-slate-100 bg-slate-50/60 px-3 py-2">
                    <p className="flex items-center gap-1.5 text-xs font-bold text-navy">
                      <Store className="h-3.5 w-3.5 text-teal-600" aria-hidden />
                      {group.seller.storeName}
                    </p>
                    <p className="text-xs font-semibold text-slate-500">{formatMoney(group.subtotal)}</p>
                  </div>
                  <ul className="divide-y divide-slate-100">
                    {group.items.map((item) => (
                      <li key={item.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-slate-800">{item.product.name}</p>
                          <p className="text-[11px] text-slate-500">
                            {item.quantity} × {formatMoney(item.unitPrice)}
                          </p>
                        </div>
                        <p className="text-sm font-bold text-navy">{formatMoney(item.lineTotal)}</p>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </section>

          <section className="card p-5">
            <h2 className="flex items-center gap-2 text-base font-bold text-navy">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-600 text-[11px] font-bold text-white">
                3
              </span>
              Payment
            </h2>
            <div className="mt-4 flex items-start gap-3 rounded-xl border border-indigo-100 bg-indigo-50/50 p-4">
              <Truck className="mt-0.5 h-5 w-5 shrink-0 text-indigo-600" aria-hidden />
              <div>
                <p className="text-sm font-bold text-navy">Simulated demo payment</p>
                <p className="mt-1 text-xs leading-5 text-slate-600">
                  After placing the order you will choose a demo success or failure outcome. Stock is
                  reserved for a short window until then.
                </p>
              </div>
            </div>
            <div className="mt-3">
              <DemoPaymentNotice />
            </div>
          </section>
        </div>

        <aside className="lg:sticky lg:top-32">
          <div className="card p-5">
            <h2 className="text-base font-bold text-navy">Order total</h2>
            <dl className="mt-4 space-y-2.5 text-sm">
              <div className="flex justify-between">
                <dt className="text-slate-500">Items subtotal</dt>
                <dd className="font-semibold text-slate-800">{formatMoney(cart.subtotal)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Shipping (per seller)</dt>
                <dd className="font-semibold text-slate-800">
                  {Number(cart.shippingEstimate) === 0 ? 'Free' : formatMoney(cart.shippingEstimate)}
                </dd>
              </div>
              <div className="flex justify-between border-t border-slate-100 pt-2.5 text-base">
                <dt className="font-bold text-navy">Grand total</dt>
                <dd className="font-extrabold text-navy">{formatMoney(cart.grandTotal)}</dd>
              </div>
            </dl>
            {error ? (
              <p className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">
                {error}
              </p>
            ) : null}
            <Button
              className="mt-4 w-full"
              size="lg"
              loading={placing}
              disabled={!selectedId || placing}
              onClick={placeOrder}
              icon={<ArrowRight className="h-4 w-4" />}
            >
              Place order
            </Button>
            <p className="mt-2 text-center text-[11px] text-slate-500">
              You will complete payment on the next step.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
