'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useMemo } from 'react';
import {
  ArrowRight,
  BadgeCheck,
  Package,
  Search,
  Store,
} from 'lucide-react';
import { useApiData } from '../../../lib/useApi';
import type { Paginated, ProductCard as ProductCardType, SellerSummary } from '../../../lib/types';
import { formatDate } from '../../../lib/format';
import {
  ButtonLink,
  EmptyState,
  ErrorState,
  ProductCardSkeleton,
  ProductImage,
  Skeleton,
} from '../../../components/ui';
import { ProductGrid } from '../../../components/store/ProductCard';

function StoresView() {
  const params = useSearchParams();
  const slug = params.get('slug') ?? '';
  const sellers = useApiData<{ items: SellerSummary[] }>('/sellers');
  const store = useApiData<SellerSummary & { productCount: number }>(
    slug ? `/sellers/${slug}` : null,
  );
  const products = useApiData<Paginated<ProductCardType>>(
    slug ? `/products?seller=${slug}&pageSize=12&sort=newest` : null,
  );

  const items = useMemo(() => sellers.data?.items ?? [], [sellers.data]);
  const selected = useMemo(
    () => items.find((seller) => seller.storeSlug === slug) ?? null,
    [items, slug],
  );

  if (slug) {
    if (store.loading) {
      return (
        <div className="container-hub space-y-4 py-10">
          <Skeleton className="h-28 w-full rounded-2xl" />
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <ProductCardSkeleton key={index} />
            ))}
          </div>
        </div>
      );
    }

    if (store.error || !store.data) {
      return (
        <div className="container-hub py-16">
          <ErrorState message={store.error ?? 'Store not found.'} onRetry={store.reload} />
          <div className="mt-6 text-center">
            <ButtonLink href="/sellers/" variant="secondary">
              All stores
            </ButtonLink>
          </div>
        </div>
      );
    }

    const data = store.data;
    return (
      <div className="container-hub py-8">
        <nav className="mb-4 flex items-center gap-1.5 text-xs text-slate-500" aria-label="Breadcrumb">
          <Link href="/" className="hover:text-indigo-700">
            Home
          </Link>
          <span aria-hidden>/</span>
          <Link href="/sellers/" className="hover:text-indigo-700">
            Stores
          </Link>
          <span aria-hidden>/</span>
          <span className="font-semibold text-slate-700">{data.storeName}</span>
        </nav>

        <div className="card overflow-hidden">
          <div className="h-24 bg-gradient-to-r from-navy via-indigo-900 to-teal-800" />
          <div className="px-5 pb-5">
            <div className="-mt-9 flex flex-wrap items-end justify-between gap-3">
              <div className="flex items-end gap-3">
                <span className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-2xl border-4 border-white bg-gradient-to-br from-indigo-600 to-violet-600 text-xl font-extrabold text-white shadow-soft">
                  {data.logoUrl ? (
                    <ProductImage src={data.logoUrl} alt={data.storeName} />
                  ) : (
                    data.storeName.slice(0, 2).toUpperCase()
                  )}
                </span>
                <div className="pb-1">
                  <p className="flex items-center gap-1.5 text-xl font-extrabold text-navy">
                    {data.storeName}
                    <BadgeCheck className="h-5 w-5 text-teal-600" aria-hidden />
                  </p>
                  <p className="text-xs text-slate-500">
                    {data.productCount} product{data.productCount === 1 ? '' : 's'} · Approved{' '}
                    {data.approvedAt ? formatDate(data.approvedAt) : ''}
                  </p>
                </div>
              </div>
              <ButtonLink href={`/search/?seller=${data.storeSlug}`} size="sm" variant="secondary">
                Search this store
              </ButtonLink>
            </div>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-600">
              {data.description ?? 'Independent seller on MarketHub.'}
            </p>
          </div>
        </div>

        <div className="mt-6 flex items-end justify-between gap-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-indigo-600">
              Store catalogue
            </p>
            <h2 className="mt-1 text-xl font-extrabold tracking-tight text-navy">
              Products from {data.storeName}
            </h2>
          </div>
          <Link href="/sellers/" className="text-sm font-bold text-indigo-600 hover:text-indigo-800">
            All stores
          </Link>
        </div>

        <div className="mt-4">
          {products.error ? (
            <ErrorState message={products.error} onRetry={products.reload} />
          ) : products.loading ? (
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
              {Array.from({ length: 4 }).map((_, index) => (
                <ProductCardSkeleton key={index} />
              ))}
            </div>
          ) : (products.data?.items.length ?? 0) === 0 ? (
            <EmptyState
              icon={<Package className="h-5 w-5" />}
              title="No published products yet"
              description="This store is approved but has not published products yet. Check back soon."
              action={<ButtonLink href="/products/">Browse the marketplace</ButtonLink>}
            />
          ) : (
            <ProductGrid products={products.data?.items ?? []} />
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="container-hub py-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-indigo-600">
            Marketplace
          </p>
          <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-navy sm:text-3xl">
            Approved stores
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
            Every store is reviewed by marketplace administrators before going live. Each fulfils
            its own parcels and manages its own inventory.
          </p>
        </div>
        <div className="flex gap-2">
          <ButtonLink href="/search/" variant="secondary" icon={<Search className="h-4 w-4" />}>
            Search products
          </ButtonLink>
          <ButtonLink href="/seller-apply/" icon={<Store className="h-4 w-4" />}>
            Sell here
          </ButtonLink>
        </div>
      </div>

      <div className="mt-6">
        {sellers.error ? (
          <ErrorState message={sellers.error} onRetry={sellers.reload} />
        ) : sellers.loading ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <Skeleton key={index} className="h-28 w-full rounded-2xl" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <EmptyState
            icon={<Store className="h-5 w-5" />}
            title="No approved stores yet"
            description="Seller applications are reviewed before stores appear in the directory. Be the first to join."
            action={<ButtonLink href="/seller-apply/">Apply to sell</ButtonLink>}
          />
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((seller) => (
                <Link
                  key={seller.id}
                  href={`/sellers/?slug=${seller.storeSlug}`}
                  className="card card-hover flex flex-col p-5"
                >
                  <div className="flex items-center gap-3">
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 text-sm font-extrabold text-white">
                      {seller.logoUrl ? (
                        <ProductImage src={seller.logoUrl} alt={seller.storeName} />
                      ) : (
                        seller.storeName.slice(0, 2).toUpperCase()
                      )}
                    </span>
                    <div className="min-w-0">
                      <p className="flex items-center gap-1 truncate text-sm font-bold text-navy">
                        {seller.storeName}
                        <BadgeCheck className="h-3.5 w-3.5 shrink-0 text-teal-600" aria-hidden />
                      </p>
                      <p className="text-xs text-slate-500">
                        {seller.productCount ?? 0} product
                        {(seller.productCount ?? 0) === 1 ? '' : 's'}
                      </p>
                    </div>
                  </div>
                  <p className="mt-3 line-clamp-2 flex-1 text-xs leading-5 text-slate-600">
                    {seller.description ?? 'Independent seller on MarketHub.'}
                  </p>
                  <span className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-indigo-600">
                    Visit store <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                  </span>
                </Link>
              ))}
            </div>
            {selected ? null : null}
          </>
        )}
      </div>
    </div>
  );
}

export default function SellersPage() {
  return (
    <Suspense
      fallback={
        <div className="container-hub py-10">
          <Skeleton className="h-40 w-full rounded-2xl" />
        </div>
      }
    >
      <StoresView />
    </Suspense>
  );
}
