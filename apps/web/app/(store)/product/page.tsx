'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  BadgeCheck,
  Boxes,
  CheckCircle2,
  ChevronRight,
  Minus,
  Plus,
  ShieldCheck,
  ShoppingBag,
  Store,
  Truck,
} from 'lucide-react';
import { useApiData } from '../../../lib/useApi';
import { useAuth } from '../../../lib/auth';
import { useCart } from '../../../lib/cart';
import type { Paginated, ProductCard as ProductCardType, ProductDetail, Review } from '../../../lib/types';
import { formatDate, formatMoney } from '../../../lib/format';
import {
  Badge,
  Button,
  ButtonLink,
  DemoPaymentNotice,
  EmptyState,
  ErrorState,
  ProductImage,
  RatingStars,
  Skeleton,
} from '../../../components/ui';
import { ProductCard } from '../../../components/store/ProductCard';
import { useToast } from '../../../components/ui/toast';

function ProductView() {
  const params = useSearchParams();
  const id = params.get('id');
  const router = useRouter();
  const { user } = useAuth();
  const { addItem } = useCart();
  const toast = useToast();

  const product = useApiData<ProductDetail>(id ? `/products/${id}` : null);
  const related = useApiData<Paginated<ProductCardType>>(
    product.data ? `/products?category=${product.data.category.slug}&pageSize=5` : null,
  );

  const [quantity, setQuantity] = useState(1);
  const [adding, setAdding] = useState(false);
  const maxQuantity = Math.max(1, Math.min(99, product.data?.available ?? 1));

  useEffect(() => {
    setQuantity(1);
  }, [id]);

  const relatedItems = useMemo(
    () => (related.data?.items ?? []).filter((item) => item.id !== id).slice(0, 4),
    [related.data, id],
  );

  if (!id) {
    return (
      <div className="container-hub py-16">
        <EmptyState
          icon={<ShoppingBag className="h-5 w-5" />}
          title="No product selected"
          description="Open a product from the catalogue to view its details."
          action={<ButtonLink href="/products/">Browse products</ButtonLink>}
        />
      </div>
    );
  }

  if (product.loading) {
    return (
      <div className="container-hub grid gap-8 py-10 lg:grid-cols-2">
        <Skeleton className="aspect-square w-full rounded-2xl" />
        <div className="space-y-4">
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-9 w-4/5" />
          <Skeleton className="h-6 w-1/4" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      </div>
    );
  }

  if (product.error || !product.data) {
    return (
      <div className="container-hub py-16">
        <ErrorState
          message={product.error ?? 'Product not found'}
          onRetry={product.reload}
        />
        <div className="mt-6 text-center">
          <ButtonLink href="/products/" variant="secondary">
            Back to catalogue
          </ButtonLink>
        </div>
      </div>
    );
  }

  const data = product.data;
  const soldOut = data.available <= 0;
  const discount =
    data.compareAtPrice && Number(data.compareAtPrice) > Number(data.price)
      ? Math.round((1 - Number(data.price) / Number(data.compareAtPrice)) * 100)
      : 0;

  async function handleAdd(goToCart = false) {
    if (!user) {
      router.push(`/login/?next=${encodeURIComponent(`/product/?id=${data.id}`)}`);
      return;
    }
    if (user.role !== 'CUSTOMER') {
      toast.info('Sign in with a customer account to purchase.');
      return;
    }
    setAdding(true);
    try {
      await addItem(data.id, quantity);
      toast.success(`${quantity} × ${data.name} added to your cart.`);
      if (goToCart) router.push('/cart/');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not add this item.');
    } finally {
      setAdding(false);
    }
  }

  return (
    <div className="container-hub py-8">
      <nav className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500" aria-label="Breadcrumb">
        <Link href="/" className="hover:text-indigo-700">
          Home
        </Link>
        <ChevronRight className="h-3 w-3" aria-hidden />
        <Link href="/products/" className="hover:text-indigo-700">
          Products
        </Link>
        <ChevronRight className="h-3 w-3" aria-hidden />
        <Link href={`/category/?slug=${data.category.slug}`} className="hover:text-indigo-700">
          {data.category.name}
        </Link>
        <ChevronRight className="h-3 w-3" aria-hidden />
        <span className="truncate text-slate-700">{data.name}</span>
      </nav>

      <div className="mt-5 grid gap-8 lg:grid-cols-[1.05fr_1fr] lg:gap-12">
        <div>
          <div className="aspect-square overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <ProductImage src={data.imageUrl} alt={data.name} className="h-full w-full" />
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2 text-center text-[11px] font-semibold text-slate-600">
            <div className="rounded-xl border border-slate-200 bg-white px-2 py-2.5">
              <Truck className="mx-auto mb-1 h-4 w-4 text-sky-600" aria-hidden />
              Seller-wise delivery
            </div>
            <div className="rounded-xl border border-slate-200 bg-white px-2 py-2.5">
              <Boxes className="mx-auto mb-1 h-4 w-4 text-indigo-600" aria-hidden />
              Live stock check
            </div>
            <div className="rounded-xl border border-slate-200 bg-white px-2 py-2.5">
              <ShieldCheck className="mx-auto mb-1 h-4 w-4 text-teal-600" aria-hidden />
              Secure demo pay
            </div>
          </div>
        </div>

        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="indigo">{data.category.name}</Badge>
            {data.brand ? <Badge tone="slate">{data.brand}</Badge> : null}
            {discount > 0 ? <Badge tone="orange">{discount}% off</Badge> : null}
            {soldOut ? (
              <Badge tone="rose">Out of stock</Badge>
            ) : data.lowStock ? (
              <Badge tone="amber">Only {data.available} left</Badge>
            ) : (
              <Badge tone="teal">In stock</Badge>
            )}
          </div>

          <h1 className="mt-3 text-3xl font-extrabold leading-tight tracking-tight text-navy sm:text-4xl">
            {data.name}
          </h1>

          <div className="mt-3 flex flex-wrap items-center gap-4 text-sm">
            <RatingStars rating={data.rating} count={data.reviewCount} />
            {data.soldCount > 0 ? (
              <span className="text-xs text-slate-500">{data.soldCount} units purchased</span>
            ) : (
              <span className="text-xs text-slate-400">No purchases yet</span>
            )}
            <span className="text-xs text-slate-400">SKU {data.sku}</span>
          </div>

          <div className="mt-5 flex flex-wrap items-end gap-3">
            <p className="text-3xl font-extrabold tracking-tight text-navy">{formatMoney(data.price)}</p>
            {data.compareAtPrice ? (
              <>
                <p className="text-lg text-slate-400 line-through">{formatMoney(data.compareAtPrice)}</p>
                <p className="text-sm font-bold text-teal-600">
                  Save {formatMoney(Number(data.compareAtPrice) - Number(data.price))}
                </p>
              </>
            ) : null}
          </div>
          <p className="mt-1 text-xs text-slate-500">Inclusive of all taxes · INR</p>

          <p className="mt-5 whitespace-pre-line text-sm leading-7 text-slate-600">{data.description}</p>

          <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-slate-500">
                  Available now
                </p>
                <p className="mt-1 text-sm font-bold text-navy">
                  {soldOut ? 'Currently sold out' : `${data.available} unit${data.available === 1 ? '' : 's'} ready to ship`}
                </p>
              </div>
              {!soldOut ? (
                <div className="flex items-center rounded-xl border border-slate-200">
                  <button
                    type="button"
                    onClick={() => setQuantity((value) => Math.max(1, value - 1))}
                    className="flex h-10 w-10 items-center justify-center text-slate-600 transition hover:bg-slate-50 disabled:opacity-40"
                    disabled={quantity <= 1}
                    aria-label="Decrease quantity"
                  >
                    <Minus className="h-4 w-4" aria-hidden />
                  </button>
                  <span className="w-10 text-center text-sm font-bold text-navy" aria-live="polite">
                    {quantity}
                  </span>
                  <button
                    type="button"
                    onClick={() => setQuantity((value) => Math.min(maxQuantity, value + 1))}
                    className="flex h-10 w-10 items-center justify-center text-slate-600 transition hover:bg-slate-50 disabled:opacity-40"
                    disabled={quantity >= maxQuantity}
                    aria-label="Increase quantity"
                  >
                    <Plus className="h-4 w-4" aria-hidden />
                  </button>
                </div>
              ) : null}
            </div>

            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <Button
                className="flex-1"
                size="lg"
                loading={adding}
                disabled={soldOut}
                onClick={() => handleAdd(false)}
                icon={<ShoppingBag className="h-4 w-4" />}
              >
                {soldOut ? 'Out of stock' : 'Add to cart'}
              </Button>
              <Button
                className="flex-1"
                size="lg"
                variant="navy"
                disabled={soldOut || adding}
                onClick={() => handleAdd(true)}
              >
                Buy now
              </Button>
            </div>
            <div className="mt-3">
              <DemoPaymentNotice compact />
            </div>
          </div>

          <div className="mt-5 flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-teal-600 to-emerald-600 text-sm font-extrabold text-white">
              {data.seller.logoUrl ? (
                <ProductImage src={data.seller.logoUrl} alt={data.seller.storeName} />
              ) : (
                data.seller.storeName.slice(0, 2).toUpperCase()
              )}
            </span>
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-1.5 text-sm font-bold text-navy">
                {data.seller.storeName}
                <BadgeCheck className="h-4 w-4 text-teal-600" aria-hidden />
              </p>
              <p className="truncate text-xs text-slate-500">
                {data.seller.description ?? 'Independent seller on MarketHub'}
              </p>
            </div>
            <Link
              href={`/search/?seller=${data.seller.storeSlug}`}
              className="inline-flex items-center gap-1 text-xs font-bold text-indigo-600 hover:text-indigo-800"
            >
              Visit store <ChevronRight className="h-3.5 w-3.5" aria-hidden />
            </Link>
          </div>
        </div>
      </div>

      <section className="mt-12 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="card p-6">
          <h2 className="text-lg font-bold text-navy">Product details</h2>
          <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
            <Detail label="Category" value={data.category.name} />
            <Detail label="Brand" value={data.brand ?? 'Unbranded'} />
            <Detail label="SKU" value={data.sku} />
            <Detail label="Listed" value={formatDate(data.createdAt)} />
          </dl>
          <p className="mt-5 whitespace-pre-line text-sm leading-7 text-slate-600">{data.description}</p>
        </div>
        <div className="card p-6">
          <h2 className="text-lg font-bold text-navy">Shipping &amp; returns</h2>
          <ul className="mt-4 space-y-3 text-sm text-slate-600">
            <li className="flex gap-2.5">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-teal-600" aria-hidden />
              Each seller ships their own items with independent tracking.
            </li>
            <li className="flex gap-2.5">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-teal-600" aria-hidden />
              Free delivery on seller subtotals over ₹999, otherwise a flat ₹49.
            </li>
            <li className="flex gap-2.5">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-teal-600" aria-hidden />
              Cancel free of charge before any parcel is shipped.
            </li>
            <li className="flex gap-2.5">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-teal-600" aria-hidden />
              Simulated refunds restore reserved stock exactly once.
            </li>
          </ul>
        </div>
      </section>

      <section className="mt-10">
        <div className="flex items-end justify-between">
          <div>
            <h2 className="text-xl font-extrabold tracking-tight text-navy">Customer reviews</h2>
            <p className="mt-1 text-sm text-slate-500">
              Only verified, delivered purchases can leave a review.
            </p>
          </div>
          <RatingStars rating={data.rating} count={data.reviewCount} />
        </div>
        <div className="mt-4 space-y-3">
          {data.reviews.length === 0 ? (
            <div className="card p-6 text-sm text-slate-500">
              No reviews yet. Reviews appear after a customer receives this product.
            </div>
          ) : (
            data.reviews.map((review) => <ReviewItem key={review.id} review={review} />)
          )}
        </div>
      </section>

      {relatedItems.length > 0 ? (
        <section className="mt-12">
          <div className="flex items-end justify-between">
            <h2 className="text-xl font-extrabold tracking-tight text-navy">More in {data.category.name}</h2>
            <ButtonLink href={`/category/?slug=${data.category.slug}`} variant="ghost" size="sm">
              See all
            </ButtonLink>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3.5 sm:gap-4 md:grid-cols-4">
            {relatedItems.map((item) => (
              <ProductCard key={item.id} product={item} />
            ))}
          </div>
        </section>
      ) : null}

      <div className="mt-10">
        <Button variant="ghost" size="sm" onClick={() => router.back()} icon={<ArrowLeft className="h-4 w-4" />}>
          Back
        </Button>
      </div>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-slate-50 px-3 py-2">
      <dt className="text-[10px] font-bold uppercase tracking-[0.1em] text-slate-500">{label}</dt>
      <dd className="mt-0.5 font-semibold text-slate-800">{value}</dd>
    </div>
  );
}

function ReviewItem({ review }: { review: Review }) {
  return (
    <article className="card p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-50 text-xs font-bold text-indigo-700">
            {(review.customer?.name ?? 'C').slice(0, 1).toUpperCase()}
          </span>
          <div>
            <p className="text-sm font-bold text-navy">{review.customer?.name ?? 'Verified customer'}</p>
            <p className="text-[11px] text-slate-400">{formatDate(review.createdAt)}</p>
          </div>
        </div>
        <span className="flex items-center gap-0.5" aria-label={`${review.rating} out of 5 stars`}>
          {Array.from({ length: 5 }).map((_, index) => (
            <span
              key={index}
              className={index < review.rating ? 'text-amber-400' : 'text-slate-200'}
              aria-hidden
            >
              ★
            </span>
          ))}
        </span>
      </div>
      {review.title ? <p className="mt-3 text-sm font-bold text-slate-800">{review.title}</p> : null}
      {review.comment ? <p className="mt-1 text-sm leading-6 text-slate-600">{review.comment}</p> : null}
      <p className="mt-3 inline-flex items-center gap-1 text-[11px] font-semibold text-teal-600">
        <CheckCircle2 className="h-3.5 w-3.5" aria-hidden /> Verified purchase
      </p>
    </article>
  );
}

export default function ProductPage() {
  return (
    <Suspense
      fallback={
        <div className="container-hub grid gap-8 py-10 lg:grid-cols-2">
          <Skeleton className="aspect-square w-full rounded-2xl" />
          <div className="space-y-4">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-9 w-4/5" />
            <Skeleton className="h-6 w-1/4" />
            <Skeleton className="h-24 w-full" />
          </div>
        </div>
      }
    >
      <ProductView />
    </Suspense>
  );
}
