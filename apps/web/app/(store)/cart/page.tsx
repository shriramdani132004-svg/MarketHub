'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Boxes,
  Minus,
  Plus,
  ShoppingBag,
  Store,
  Trash2,
} from 'lucide-react';
import { useAuth } from '../../../lib/auth';
import { useCart } from '../../../lib/cart';
import { formatMoney } from '../../../lib/format';
import {
  Button,
  ButtonLink,
  ConfirmDialog,
  DemoPaymentNotice,
  EmptyState,
  ProductImage,
  Spinner,
} from '../../../components/ui';
import { useToast } from '../../../components/ui/toast';

export default function CartPage() {
  const { user, loading: authLoading } = useAuth();
  const { cart, loading, updateItem, removeItem, clear } = useCart();
  const toast = useToast();
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const [clearing, setClearing] = useState(false);

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
          icon={<ShoppingBag className="h-5 w-5" />}
          title="Sign in to see your cart"
          description="Your cart is stored securely against your MarketHub customer account."
          action={
            <div className="flex gap-2">
              <ButtonLink href="/login/?next=%2Fcart%2F">Sign in</ButtonLink>
              <ButtonLink href="/register/" variant="secondary">
                Create account
              </ButtonLink>
            </div>
          }
        />
      </div>
    );
  }

  if (user.role !== 'CUSTOMER') {
    return (
      <div className="container-hub py-16">
        <EmptyState
          icon={<ShoppingBag className="h-5 w-5" />}
          title="Carts are for customer accounts"
          description="Seller and administrator accounts cannot place marketplace orders."
          action={<ButtonLink href={user.role === 'SELLER' ? '/seller/' : '/admin/'}>Go to dashboard</ButtonLink>}
        />
      </div>
    );
  }

  async function changeQuantity(itemId: string, quantity: number) {
    if (quantity < 1) return;
    setBusyId(itemId);
    try {
      await updateItem(itemId, quantity);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not update the quantity.');
    } finally {
      setBusyId(null);
    }
  }

  async function remove(itemId: string) {
    setBusyId(itemId);
    try {
      await removeItem(itemId);
      toast.success('Item removed from your cart.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not remove the item.');
    } finally {
      setBusyId(null);
    }
  }

  async function handleClear() {
    setClearing(true);
    try {
      await clear();
      toast.success('Your cart is now empty.');
      setConfirmClear(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not clear the cart.');
    } finally {
      setClearing(false);
    }
  }

  const groups = new Map<
    string,
    {
      seller: (typeof cart.items)[number]['product']['seller'];
      items: typeof cart.items;
      subtotal: number;
      hasIssue: boolean;
    }
  >();
  for (const item of cart.items) {
    const key = item.product.seller.id;
    const group =
      groups.get(key) ?? {
        seller: item.product.seller,
        items: [],
        subtotal: 0,
        hasIssue: false,
      };
    group.items.push(item);
    group.subtotal += Number(item.lineTotal);
    group.hasIssue = group.hasIssue || Boolean(item.issue);
    groups.set(key, group);
  }

  if (loading && cart.items.length === 0) {
    return (
      <div className="container-hub py-16">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="container-hub py-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-indigo-600">Your bag</p>
          <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-navy sm:text-3xl">
            Shopping cart
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            {cart.itemCount} item{cart.itemCount === 1 ? '' : 's'} from {groups.size} store
            {groups.size === 1 ? '' : 's'}
          </p>
        </div>
        {cart.items.length > 0 ? (
          <Button variant="ghost" size="sm" onClick={() => setConfirmClear(true)} icon={<Trash2 className="h-4 w-4" />}>
            Clear cart
          </Button>
        ) : null}
      </div>

      {cart.items.length === 0 ? (
        <div className="mt-8">
          <EmptyState
            icon={<ShoppingBag className="h-5 w-5" />}
            title="Your cart is empty"
            description="Browse the marketplace and add something you love. Stock is only reserved at checkout."
            action={<ButtonLink href="/products/">Start shopping</ButtonLink>}
          />
        </div>
      ) : (
        <div className="mt-6 grid gap-6 lg:grid-cols-[1.6fr_1fr] lg:items-start">
          <div className="space-y-4">
            {cart.hasIssues ? (
              <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden />
                <p>
                  Some items need attention before checkout. Reduce quantities or remove unavailable
                  products to continue.
                </p>
              </div>
            ) : null}

            {[...groups.values()].map((group) => (
              <section key={group.seller.id} className="card overflow-hidden">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 bg-slate-50/60 px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Store className="h-4 w-4 text-teal-600" aria-hidden />
                    <Link
                      href={`/search/?seller=${group.seller.storeSlug}`}
                      className="text-sm font-bold text-navy hover:text-indigo-700"
                    >
                      {group.seller.storeName}
                    </Link>
                  </div>
                  <p className="text-xs font-semibold text-slate-500">
                    Store subtotal {formatMoney(group.subtotal)}
                  </p>
                </div>

                <div className="divide-y divide-slate-100">
                  {group.items.map((item) => (
                    <div key={item.id} className="flex gap-3 p-4 sm:gap-4">
                      <Link
                        href={`/product/?id=${item.product.id}`}
                        className="h-20 w-20 shrink-0 overflow-hidden rounded-xl border border-slate-200 bg-white sm:h-24 sm:w-24"
                      >
                        <ProductImage src={item.product.imageUrl} alt={item.product.name} />
                      </Link>
                      <div className="flex min-w-0 flex-1 flex-col">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <Link
                              href={`/product/?id=${item.product.id}`}
                              className="line-clamp-2 text-sm font-bold text-navy hover:text-indigo-700"
                            >
                              {item.product.name}
                            </Link>
                            <p className="mt-0.5 text-xs text-slate-500">
                              {item.product.category.name} · {formatMoney(item.unitPrice)} each
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => remove(item.id)}
                            disabled={busyId === item.id}
                            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 disabled:opacity-40"
                            aria-label={`Remove ${item.product.name} from cart`}
                          >
                            <Trash2 className="h-4 w-4" aria-hidden />
                          </button>
                        </div>

                        {item.issue ? (
                          <p className="mt-1.5 inline-flex items-center gap-1 text-xs font-semibold text-rose-600">
                            <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
                            {item.issue}
                          </p>
                        ) : null}

                        <div className="mt-auto flex flex-wrap items-end justify-between gap-3 pt-2">
                          <div className="flex items-center rounded-lg border border-slate-200">
                            <button
                              type="button"
                              className="flex h-8 w-8 items-center justify-center text-slate-600 transition hover:bg-slate-50 disabled:opacity-40"
                              onClick={() => changeQuantity(item.id, item.quantity - 1)}
                              disabled={busyId === item.id || item.quantity <= 1}
                              aria-label="Decrease quantity"
                            >
                              <Minus className="h-3.5 w-3.5" aria-hidden />
                            </button>
                            <span className="w-9 text-center text-sm font-bold text-navy">
                              {busyId === item.id ? '…' : item.quantity}
                            </span>
                            <button
                              type="button"
                              className="flex h-8 w-8 items-center justify-center text-slate-600 transition hover:bg-slate-50 disabled:opacity-40"
                              onClick={() => changeQuantity(item.id, item.quantity + 1)}
                              disabled={busyId === item.id || item.quantity >= item.quantityLimit}
                              aria-label="Increase quantity"
                            >
                              <Plus className="h-3.5 w-3.5" aria-hidden />
                            </button>
                          </div>
                          <p className="text-sm font-extrabold text-navy">{formatMoney(item.lineTotal)}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>

          <aside className="lg:sticky lg:top-32">
            <div className="card p-5">
              <h2 className="text-base font-bold text-navy">Order summary</h2>
              <dl className="mt-4 space-y-2.5 text-sm">
                <div className="flex justify-between">
                  <dt className="text-slate-500">Subtotal</dt>
                  <dd className="font-semibold text-slate-800">{formatMoney(cart.subtotal)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-slate-500">Shipping estimate</dt>
                  <dd className="font-semibold text-slate-800">
                    {Number(cart.shippingEstimate) === 0 ? 'Free' : formatMoney(cart.shippingEstimate)}
                  </dd>
                </div>
                <div className="flex justify-between border-t border-slate-100 pt-2.5 text-base">
                  <dt className="font-bold text-navy">Total</dt>
                  <dd className="font-extrabold text-navy">{formatMoney(cart.grandTotal)}</dd>
                </div>
              </dl>
              <p className="mt-2 text-[11px] leading-4 text-slate-500">
                Shipping is calculated per seller. Free over ₹999 for each store.
              </p>
              <Button
                className="mt-4 w-full"
                size="lg"
                disabled={cart.hasIssues || cart.items.length === 0}
                onClick={() => router.push('/checkout/')}
                icon={<ArrowRight className="h-4 w-4" />}
              >
                Proceed to checkout
              </Button>
              {cart.hasIssues ? (
                <p className="mt-2 text-center text-[11px] font-semibold text-rose-600">
                  Resolve the highlighted items to continue.
                </p>
              ) : null}
              <div className="mt-4">
                <DemoPaymentNotice compact />
              </div>
              <div className="mt-4 flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-[11px] text-slate-500">
                <Boxes className="h-4 w-4 text-indigo-600" aria-hidden />
                Stock is only reserved after you place the order.
              </div>
            </div>
            <ButtonLink href="/products/" variant="ghost" size="sm" className="mt-3 w-full">
              Continue shopping
            </ButtonLink>
          </aside>
        </div>
      )}

      <ConfirmDialog
        open={confirmClear}
        title="Clear your cart?"
        description="This removes every item from your cart. Saved addresses and orders are not affected."
        confirmLabel="Clear cart"
        loading={clearing}
        onConfirm={handleClear}
        onClose={() => setConfirmClear(false)}
      />
    </div>
  );
}
