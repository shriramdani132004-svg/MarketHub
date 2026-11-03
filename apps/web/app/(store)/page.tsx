'use client';

import Link from 'next/link';
import {
  ArrowRight,
  BadgeCheck,
  Boxes,
  CreditCard,
  Headphones,
  Laptop,
  Leaf,
  PackageCheck,
  Shirt,
  ShieldCheck,
  ShoppingBasket,
  Sparkles,
  Store,
  Truck,
} from 'lucide-react';
import { useApiData } from '../../lib/useApi';
import type { Category, Paginated, ProductCard as ProductCardType, SellerSummary } from '../../lib/types';
import { ProductCard } from '../../components/store/ProductCard';
import { ProductCardSkeleton, ButtonLink, ProductImage } from '../../components/ui';
import { formatCompact, formatMoney } from '../../lib/format';

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  electronics: <Laptop className="h-5 w-5" />,
  audio: <Headphones className="h-5 w-5" />,
  fashion: <Shirt className="h-5 w-5" />,
  'home-living': <ShoppingBasket className="h-5 w-5" />,
  beauty: <Sparkles className="h-5 w-5" />,
  sports: <Leaf className="h-5 w-5" />,
  books: <Boxes className="h-5 w-5" />,
};

const CATEGORY_TONES = [
  'bg-indigo-50 text-indigo-600',
  'bg-teal-50 text-teal-600',
  'bg-orange-50 text-orange-600',
  'bg-sky-50 text-sky-600',
  'bg-violet-50 text-violet-600',
  'bg-amber-50 text-amber-600',
];

export default function HomePage() {
  const products = useApiData<Paginated<ProductCardType>>('/products?sort=newest&pageSize=8');
  const categories = useApiData<{ items: Category[] }>('/categories');
  const sellers = useApiData<{ items: SellerSummary[] }>('/sellers');
  const featured = products.data?.items ?? [];
  const heroProduct = featured[0];
  const heroProductTwo = featured[1];

  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-slate-200/70 bg-page">
        <div className="pointer-events-none absolute -left-24 top-10 h-72 w-72 rounded-full bg-indigo-200/40 blur-3xl" />
        <div className="pointer-events-none absolute -right-16 bottom-0 h-80 w-80 rounded-full bg-teal-200/40 blur-3xl" />
        <div className="container-hub relative grid items-center gap-10 py-12 lg:grid-cols-[1.08fr_1fr] lg:py-16">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-white/80 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-indigo-700">
              <BadgeCheck className="h-3.5 w-3.5" aria-hidden />
              Multi-vendor marketplace
            </span>
            <h1 className="mt-5 text-4xl font-extrabold leading-[1.08] tracking-tight text-navy sm:text-5xl lg:text-[3.35rem]">
              Everything you need,
              <span className="block bg-gradient-to-r from-indigo-600 via-violet-600 to-teal-600 bg-clip-text text-transparent">
                from sellers you can trust.
              </span>
            </h1>
            <p className="mt-5 max-w-xl text-base leading-7 text-slate-600">
              Discover curated products across independent stores, then check out once. MarketHub
              splits your order by seller, reserves stock transactionally and keeps every parcel
              trackable.
            </p>
            <div className="mt-7 flex flex-wrap items-center gap-3">
              <ButtonLink href="/products/" size="lg" icon={<ArrowRight className="h-4 w-4" />}>
                Start shopping
              </ButtonLink>
              <ButtonLink href="/seller-apply/" size="lg" variant="secondary" icon={<Store className="h-4 w-4" />}>
                Sell on MarketHub
              </ButtonLink>
            </div>
            <dl className="mt-9 grid max-w-lg grid-cols-3 gap-3">
              {[
                { label: 'Verified stores', value: sellers.data?.items.length ?? '—' },
                { label: 'Live products', value: products.data?.meta.total ?? '—' },
                { label: 'Categories', value: categories.data?.items.length ?? '—' },
              ].map((stat) => (
                <div key={stat.label} className="rounded-xl border border-slate-200 bg-white/80 px-3 py-2.5">
                  <dt className="text-[10px] font-bold uppercase tracking-[0.1em] text-slate-500">
                    {stat.label}
                  </dt>
                  <dd className="mt-1 text-lg font-extrabold text-navy">{stat.value}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="relative mx-auto w-full max-w-md lg:max-w-none">
            <div className="relative rounded-[28px] border border-white/60 bg-gradient-to-br from-navy to-indigo-900 p-5 shadow-lift">
              <div className="flex items-center justify-between text-white">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-indigo-200">
                    This week on MarketHub
                  </p>
                  <p className="mt-1 text-lg font-bold">One cart. Many stores.</p>
                </div>
                <span className="rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-teal-300">
                  Live
                </span>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3">
                <Link
                  href={heroProduct ? `/product/?id=${heroProduct.id}` : '/products/'}
                  className="group col-span-2 overflow-hidden rounded-2xl bg-white/10 ring-1 ring-white/10"
                >
                  <div className="flex items-center gap-3 p-3">
                    <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-white/10">
                      <ProductImage
                        src={heroProduct?.imageUrl}
                        alt={heroProduct?.name ?? 'Featured product'}
                        className="transition duration-500 group-hover:scale-105"
                      />
                    </div>
                    <div className="min-w-0 text-white">
                      <p className="truncate text-sm font-bold">
                        {heroProduct?.name ?? 'Curated products, refreshed daily'}
                      </p>
                      <p className="mt-0.5 truncate text-xs text-indigo-200">
                        {heroProduct?.seller.storeName ?? 'Independent sellers'}
                      </p>
                      <p className="mt-1.5 text-sm font-extrabold">
                        {heroProduct ? formatMoney(heroProduct.price) : 'Discover the catalogue'}
                      </p>
                    </div>
                  </div>
                </Link>

                <Link
                  href={heroProductTwo ? `/product/?id=${heroProductTwo.id}` : '/products/'}
                  className="group overflow-hidden rounded-xl bg-white/10 p-2.5 ring-1 ring-white/10"
                >
                  <div className="aspect-square overflow-hidden rounded-lg bg-white/10">
                    <ProductImage
                      src={heroProductTwo?.imageUrl}
                      alt={heroProductTwo?.name ?? 'Product'}
                      className="transition duration-500 group-hover:scale-105"
                    />
                  </div>
                  <p className="mt-2 line-clamp-1 text-[11px] font-semibold text-white">
                    {heroProductTwo?.name ?? 'New arrivals'}
                  </p>
                </Link>

                <div className="rounded-xl bg-white p-3">
                  <div className="flex items-center gap-1.5">
                    <PackageCheck className="h-4 w-4 text-teal-600" aria-hidden />
                    <p className="text-[11px] font-bold text-navy">Seller order split</p>
                  </div>
                  <div className="mt-2 space-y-1.5">
                    <div className="flex items-center justify-between rounded-md bg-indigo-50 px-2 py-1 text-[10px] font-semibold text-indigo-700">
                      <span>Store A</span>
                      <span>₹{heroProduct ? Number(heroProduct.price).toFixed(0) : '—'}</span>
                    </div>
                    <div className="flex items-center justify-between rounded-md bg-teal-50 px-2 py-1 text-[10px] font-semibold text-teal-700">
                      <span>Store B</span>
                      <span>₹{heroProductTwo ? Number(heroProductTwo.price).toFixed(0) : '—'}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-4 flex items-center gap-2 rounded-xl bg-white/10 px-3 py-2 text-[11px] font-medium text-indigo-100">
                <ShieldCheck className="h-4 w-4 text-teal-300" aria-hidden />
                Demo checkout with transactional stock reservation
              </div>
            </div>

            <div className="absolute -bottom-5 -left-4 hidden rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-lift sm:block">
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">Free delivery</p>
              <p className="mt-0.5 text-sm font-extrabold text-navy">on orders over ₹999</p>
            </div>
          </div>
        </div>
      </section>

      {/* Categories */}
      <section className="container-hub py-10">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-indigo-600">Browse</p>
            <h2 className="mt-1 text-2xl font-extrabold tracking-tight text-navy">Shop by category</h2>
          </div>
          <Link href="/products/" className="inline-flex items-center gap-1 text-sm font-bold text-indigo-600 hover:text-indigo-800">
            All categories <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {(categories.data?.items ?? []).slice(0, 6).map((category, index) => (
            <Link
              key={category.id}
              href={`/category/?slug=${category.slug}`}
              className="card card-hover flex flex-col gap-3 p-4"
            >
              <span
                className={`flex h-10 w-10 items-center justify-center rounded-xl ${CATEGORY_TONES[index % CATEGORY_TONES.length]}`}
              >
                {CATEGORY_ICONS[category.slug] ?? <Boxes className="h-5 w-5" />}
              </span>
              <div>
                <p className="text-sm font-bold text-navy">{category.name}</p>
                <p className="mt-0.5 text-xs text-slate-500">
                  {category.productCount ?? 0} product{(category.productCount ?? 0) === 1 ? '' : 's'}
                </p>
              </div>
            </Link>
          ))}
          {!categories.data
            ? Array.from({ length: 6 }).map((_, index) => (
                <div key={index} className="card space-y-3 p-4">
                  <div className="skeleton h-10 w-10 rounded-xl" />
                  <div className="skeleton h-4 w-2/3" />
                </div>
              ))
            : null}
        </div>
      </section>

      {/* Featured products */}
      <section className="container-hub pb-12">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-indigo-600">
              Fresh arrivals
            </p>
            <h2 className="mt-1 text-2xl font-extrabold tracking-tight text-navy">
              Newly listed by our sellers
            </h2>
          </div>
          <Link href="/products/" className="inline-flex items-center gap-1 text-sm font-bold text-indigo-600 hover:text-indigo-800">
            View all <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>
        <div className="mt-5">
          {products.loading ? (
            <div className="grid grid-cols-2 gap-3.5 sm:gap-4 md:grid-cols-3 xl:grid-cols-4">
              {Array.from({ length: 8 }).map((_, index) => (
                <ProductCardSkeleton key={index} />
              ))}
            </div>
          ) : featured.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
              <p className="text-sm font-semibold text-navy">No products published yet</p>
              <p className="mt-1 text-sm text-slate-500">
                Sellers are onboarding. Once a store is approved and publishes products, they will
                appear here.
              </p>
              <ButtonLink href="/seller-apply/" className="mt-4" size="sm">
                Become the first seller
              </ButtonLink>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3.5 sm:gap-4 md:grid-cols-3 xl:grid-cols-4">
              {featured.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Value band */}
      <section className="border-y border-slate-200 bg-white">
        <div className="container-hub grid gap-6 py-10 sm:grid-cols-2 lg:grid-cols-4">
          {[
            {
              icon: <Truck className="h-5 w-5" />,
              title: 'Seller-wise delivery',
              text: 'Each store fulfils its own parcel, tracked independently.',
              tone: 'bg-sky-50 text-sky-600',
            },
            {
              icon: <Boxes className="h-5 w-5" />,
              title: 'Real inventory',
              text: 'Stock is reserved atomically at checkout and released on failure.',
              tone: 'bg-indigo-50 text-indigo-600',
            },
            {
              icon: <CreditCard className="h-5 w-5" />,
              title: 'Safe demo payments',
              text: 'Simulate success or failure. No card data is ever collected.',
              tone: 'bg-amber-50 text-amber-600',
            },
            {
              icon: <ShieldCheck className="h-5 w-5" />,
              title: 'Role-based access',
              text: 'Customers, sellers and admins each see only what they should.',
              tone: 'bg-teal-50 text-teal-600',
            },
          ].map((item) => (
            <div key={item.title} className="flex gap-3">
              <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${item.tone}`}>
                {item.icon}
              </span>
              <div>
                <p className="text-sm font-bold text-navy">{item.title}</p>
                <p className="mt-1 text-xs leading-5 text-slate-500">{item.text}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Stores */}
      <section className="container-hub py-12">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-indigo-600">Stores</p>
            <h2 className="mt-1 text-2xl font-extrabold tracking-tight text-navy">
              Independent sellers to explore
            </h2>
          </div>
          <Link href="/sellers/" className="inline-flex items-center gap-1 text-sm font-bold text-indigo-600 hover:text-indigo-800">
            All stores <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {(sellers.data?.items ?? []).slice(0, 6).map((seller) => (
            <Link
              key={seller.id}
              href={`/search/?seller=${seller.storeSlug}`}
              className="card card-hover flex items-center gap-3 p-4"
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 text-sm font-extrabold text-white">
                {seller.logoUrl ? (
                  <ProductImage src={seller.logoUrl} alt={seller.storeName} />
                ) : (
                  seller.storeName.slice(0, 2).toUpperCase()
                )}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-navy">{seller.storeName}</p>
                <p className="truncate text-xs text-slate-500">
                  {seller.productCount ?? 0} product{(seller.productCount ?? 0) === 1 ? '' : 's'} · Approved store
                </p>
              </div>
              <ArrowRight className="h-4 w-4 text-slate-400" aria-hidden />
            </Link>
          ))}
          {sellers.loading
            ? Array.from({ length: 3 }).map((_, index) => (
                <div key={index} className="card flex items-center gap-3 p-4">
                  <div className="skeleton h-11 w-11 rounded-xl" />
                  <div className="flex-1 space-y-2">
                    <div className="skeleton h-4 w-1/2" />
                    <div className="skeleton h-3 w-1/3" />
                  </div>
                </div>
              ))
            : null}
          {!sellers.loading && (sellers.data?.items.length ?? 0) === 0 ? (
            <div className="card col-span-full p-8 text-center">
              <p className="text-sm font-semibold text-navy">No approved stores yet</p>
              <p className="mt-1 text-sm text-slate-500">
                Seller applications are reviewed by a marketplace administrator before stores go live.
              </p>
            </div>
          ) : null}
        </div>
      </section>

      {/* Seller CTA */}
      <section className="container-hub pb-16">
        <div className="relative overflow-hidden rounded-3xl bg-navy px-6 py-10 sm:px-10">
          <div className="pointer-events-none absolute -right-10 -top-10 h-56 w-56 rounded-full bg-violet-600/30 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-16 left-10 h-56 w-56 rounded-full bg-teal-500/20 blur-3xl" />
          <div className="relative grid items-center gap-6 lg:grid-cols-[1.4fr_1fr]">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-teal-300">
                Grow with MarketHub
              </p>
              <h2 className="mt-2 max-w-xl text-2xl font-extrabold leading-tight text-white sm:text-3xl">
                Run your store with real inventory, fulfilment and analytics.
              </h2>
              <p className="mt-3 max-w-xl text-sm leading-6 text-indigo-100">
                Apply in minutes. Once approved, publish products, manage stock and process orders
                from a dedicated seller workspace.
              </p>
            </div>
            <div className="flex flex-wrap gap-3 lg:justify-end">
              <ButtonLink href="/seller-apply/" size="lg" variant="teal" icon={<Store className="h-4 w-4" />}>
                Apply to sell
              </ButtonLink>
              <ButtonLink
                href="/login/"
                size="lg"
                variant="secondary"
                className="border-white/20 bg-white/10 text-white hover:bg-white/15"
              >
                Seller sign in
              </ButtonLink>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
