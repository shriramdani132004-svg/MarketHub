'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { Filter, Search, SlidersHorizontal, X } from 'lucide-react';
import { useApiData } from '../../lib/useApi';
import type { Category, Paginated, ProductCard as ProductCardType, SellerSummary } from '../../lib/types';
import { ProductCard, ProductGrid } from './ProductCard';
import {
  Button,
  EmptyState,
  ErrorState,
  Input,
  Pagination,
  ProductCardSkeleton,
  Select,
} from '../ui';
import { cn } from '../../lib/utils';

const SORTS = [
  { value: 'newest', label: 'Newest first' },
  { value: 'price_asc', label: 'Price: low to high' },
  { value: 'price_desc', label: 'Price: high to low' },
  { value: 'popular', label: 'Most purchased' },
];

export function CatalogView({ variant = 'all' }: { variant?: 'all' | 'category' | 'search' }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const q = params.get('q') ?? '';
  const categoryParam = params.get('category') ?? params.get('slug') ?? '';
  const sellerParam = params.get('seller') ?? '';
  const minPrice = params.get('minPrice') ?? '';
  const maxPrice = params.get('maxPrice') ?? '';
  const inStock = params.get('inStock') === 'true';
  const sort = params.get('sort') ?? 'newest';
  const page = Math.max(1, Number(params.get('page') ?? '1') || 1);

  const [searchInput, setSearchInput] = useState(q);
  const [minInput, setMinInput] = useState(minPrice);
  const [maxInput, setMaxInput] = useState(maxPrice);
  const [filtersOpen, setFiltersOpen] = useState(false);

  useEffect(() => setSearchInput(q), [q]);
  useEffect(() => setMinInput(minPrice), [minPrice]);
  useEffect(() => setMaxInput(maxPrice), [maxPrice]);

  const categories = useApiData<{ items: Category[] }>('/categories');
  const sellers = useApiData<{ items: SellerSummary[] }>('/sellers');

  const path = useMemo(() => {
    const search = new URLSearchParams();
    search.set('pageSize', '12');
    search.set('page', String(page));
    search.set('sort', sort);
    if (q) search.set('q', q);
    if (categoryParam) search.set('category', categoryParam);
    if (sellerParam) search.set('seller', sellerParam);
    if (minPrice) search.set('minPrice', minPrice);
    if (maxPrice) search.set('maxPrice', maxPrice);
    if (inStock) search.set('inStock', 'true');
    return `/products?${search.toString()}`;
  }, [page, sort, q, categoryParam, sellerParam, minPrice, maxPrice, inStock]);

  const products = useApiData<Paginated<ProductCardType>>(path);

  const selectedCategory = useMemo(() => {
    if (!categoryParam) return null;
    return (
      categories.data?.items.find(
        (category) => category.id === categoryParam || category.slug === categoryParam,
      ) ?? null
    );
  }, [categories.data, categoryParam]);

  const selectedSeller = useMemo(() => {
    if (!sellerParam) return null;
    return (
      sellers.data?.items.find(
        (seller) => seller.id === sellerParam || seller.storeSlug === sellerParam,
      ) ?? null
    );
  }, [sellers.data, sellerParam]);

  const activeFilterCount = [q, categoryParam, sellerParam, minPrice, maxPrice, inStock ? 'yes' : ''].filter(
    Boolean,
  ).length;

  function navigate(next: Record<string, string | null>, resetPage = true) {
    const search = new URLSearchParams(params.toString());
    if (resetPage) search.delete('page');
    for (const [key, value] of Object.entries(next)) {
      if (value === null || value === '') search.delete(key);
      else search.set(key, value);
    }
    const query = search.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  }

  function applyFilters() {
    navigate({
      minPrice: minInput || null,
      maxPrice: maxInput || null,
    });
    setFiltersOpen(false);
  }

  function clearFilters() {
    setSearchInput('');
    setMinInput('');
    setMaxInput('');
    router.push(pathname);
  }

  const title =
    variant === 'search' && q
      ? `Results for “${q}”`
      : selectedCategory
        ? selectedCategory.name
        : selectedSeller
          ? selectedSeller.storeName
          : 'All products';

  const description =
    variant === 'search'
      ? 'Search across every approved store on MarketHub. Prices and availability are confirmed live.'
      : selectedCategory?.description ??
        (selectedSeller
          ? `Products sold by ${selectedSeller.storeName}.`
          : 'Browse every published product from approved sellers across the marketplace.');

  const filterPanel = (
    <div className="space-y-5">
      <div>
        <p className="label">Category</p>
        <Select
          value={categoryParam}
          onChange={(event) => navigate({ category: event.target.value || null, slug: null })}
          aria-label="Filter by category"
        >
          <option value="">All categories</option>
          {(categories.data?.items ?? []).map((category) => (
            <option key={category.id} value={category.slug}>
              {category.parentId ? '— ' : ''}
              {category.name}
            </option>
          ))}
        </Select>
      </div>

      <div>
        <p className="label">Store</p>
        <Select
          value={sellerParam}
          onChange={(event) => navigate({ seller: event.target.value || null })}
          aria-label="Filter by store"
        >
          <option value="">All stores</option>
          {(sellers.data?.items ?? []).map((seller) => (
            <option key={seller.id} value={seller.storeSlug}>
              {seller.storeName}
            </option>
          ))}
        </Select>
      </div>

      <div>
        <p className="label">Price range (₹)</p>
        <div className="flex items-center gap-2">
          <Input
            type="number"
            min={0}
            placeholder="Min"
            value={minInput}
            onChange={(event) => setMinInput(event.target.value)}
            aria-label="Minimum price"
          />
          <span className="text-slate-400">–</span>
          <Input
            type="number"
            min={0}
            placeholder="Max"
            value={maxInput}
            onChange={(event) => setMaxInput(event.target.value)}
            aria-label="Maximum price"
          />
        </div>
      </div>

      <label className="flex items-center gap-2.5 rounded-xl border border-slate-200 bg-slate-50/60 px-3 py-2.5 text-sm font-medium text-slate-700">
        <input
          type="checkbox"
          className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
          checked={inStock}
          onChange={(event) => navigate({ inStock: event.target.checked ? 'true' : null })}
        />
        In stock only
      </label>

      <div className="flex gap-2">
        <Button size="sm" className="flex-1" onClick={applyFilters}>
          Apply
        </Button>
        <Button size="sm" variant="secondary" onClick={clearFilters} disabled={activeFilterCount === 0}>
          Clear
        </Button>
      </div>
    </div>
  );

  return (
    <div className="container-hub py-8">
      <div className="flex flex-col gap-3 border-b border-slate-200 pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-indigo-600">
            {variant === 'search' ? 'Search' : selectedSeller ? 'Store' : 'Catalogue'}
          </p>
          <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-navy sm:text-3xl">{title}</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">{description}</p>
        </div>
        <div className="flex items-center gap-2">
          <form
            className="relative flex-1 sm:w-64"
            onSubmit={(event) => {
              event.preventDefault();
              navigate({ q: searchInput.trim() || null });
            }}
            role="search"
          >
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
            <input
              type="search"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Search this catalogue"
              className="input pl-9"
              aria-label="Search products"
            />
          </form>
          <Button
            variant="secondary"
            size="md"
            className="lg:hidden"
            onClick={() => setFiltersOpen(true)}
            icon={<SlidersHorizontal className="h-4 w-4" />}
          >
            Filters{activeFilterCount ? ` (${activeFilterCount})` : ''}
          </Button>
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[240px_1fr]">
        <aside className="hidden lg:block">
          <div className="card sticky top-32 p-4">
            <div className="mb-4 flex items-center gap-2 border-b border-slate-100 pb-3">
              <Filter className="h-4 w-4 text-indigo-600" aria-hidden />
              <p className="text-sm font-bold text-navy">Refine results</p>
            </div>
            {filterPanel}
          </div>
        </aside>

        <div>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs font-medium text-slate-500">
              {products.loading
                ? 'Loading products…'
                : `${products.data?.meta.total ?? 0} product${(products.data?.meta.total ?? 0) === 1 ? '' : 's'}`}
            </p>
            <div className="flex items-center gap-2">
              <label className="text-xs font-semibold text-slate-500" htmlFor="catalog-sort">
                Sort
              </label>
              <Select
                id="catalog-sort"
                value={sort}
                onChange={(event) => navigate({ sort: event.target.value })}
                className="h-9 w-auto min-w-[170px] text-xs"
              >
                {SORTS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          {activeFilterCount > 0 ? (
            <div className="mb-4 flex flex-wrap items-center gap-2">
              {q ? (
                <FilterChip label={`Search: ${q}`} onRemove={() => navigate({ q: null })} />
              ) : null}
              {selectedCategory ? (
                <FilterChip
                  label={selectedCategory.name}
                  onRemove={() => navigate({ category: null, slug: null })}
                />
              ) : null}
              {selectedSeller ? (
                <FilterChip label={selectedSeller.storeName} onRemove={() => navigate({ seller: null })} />
              ) : null}
              {minPrice || maxPrice ? (
                <FilterChip
                  label={`₹${minPrice || '0'} – ₹${maxPrice || 'any'}`}
                  onRemove={() => navigate({ minPrice: null, maxPrice: null })}
                />
              ) : null}
              {inStock ? (
                <FilterChip label="In stock" onRemove={() => navigate({ inStock: null })} />
              ) : null}
              <button
                type="button"
                onClick={clearFilters}
                className="text-xs font-semibold text-slate-500 underline-offset-2 hover:text-rose-600 hover:underline"
              >
                Clear all
              </button>
            </div>
          ) : null}

          {products.error ? (
            <ErrorState message={products.error} onRetry={products.reload} />
          ) : products.loading ? (
            <div className="grid grid-cols-2 gap-3.5 sm:gap-4 md:grid-cols-3">
              {Array.from({ length: 6 }).map((_, index) => (
                <ProductCardSkeleton key={index} />
              ))}
            </div>
          ) : (products.data?.items.length ?? 0) === 0 ? (
            <EmptyState
              icon={<Search className="h-5 w-5" />}
              title="No products match these filters"
              description="Try widening the price range, choosing another category or clearing the search term."
              action={
                <Button variant="secondary" onClick={clearFilters}>
                  Clear filters
                </Button>
              }
            />
          ) : (
            <>
              <ProductGrid products={products.data?.items ?? []} />
              <Pagination
                page={products.data?.meta.page ?? page}
                totalPages={products.data?.meta.totalPages ?? 1}
                total={products.data?.meta.total}
                onChange={(next) => {
                  navigate({ page: String(next) }, false);
                  if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
              />
            </>
          )}
        </div>
      </div>

      {filtersOpen ? (
        <div className="fixed inset-0 z-[80] flex lg:hidden">
          <div
            className="absolute inset-0 bg-navy/40 backdrop-blur-sm"
            onClick={() => setFiltersOpen(false)}
            role="presentation"
          />
          <div className="relative ml-auto h-full w-80 max-w-[88%] overflow-y-auto bg-white p-5 shadow-lift">
            <div className="mb-4 flex items-center justify-between">
              <p className="text-base font-bold text-navy">Filters</p>
              <button
                type="button"
                onClick={() => setFiltersOpen(false)}
                className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"
                aria-label="Close filters"
              >
                <X className="h-5 w-5" aria-hidden />
              </button>
            </div>
            {filterPanel}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function FilterChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2.5 py-1 text-[11px] font-semibold text-indigo-700 ring-1 ring-indigo-100')}>
      {label}
      <button type="button" onClick={onRemove} aria-label={`Remove ${label} filter`} className="rounded-full hover:text-indigo-900">
        <X className="h-3 w-3" aria-hidden />
      </button>
    </span>
  );
}
