'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Loader2, Plus, ShoppingBag } from 'lucide-react';
import { useAuth } from '../../lib/auth';
import { useCart } from '../../lib/cart';
import { formatMoney } from '../../lib/format';
import { cn } from '../../lib/utils';
import type { ProductCard as ProductCardType } from '../../lib/types';
import { useToast } from '../ui/toast';
import { ProductImage, RatingStars } from '../ui';

export function ProductCard({ product }: { product: ProductCardType }) {
  const router = useRouter();
  const { user } = useAuth();
  const { addItem } = useCart();
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  const soldOut = product.available <= 0;
  const discount =
    product.compareAtPrice && Number(product.compareAtPrice) > Number(product.price)
      ? Math.round((1 - Number(product.price) / Number(product.compareAtPrice)) * 100)
      : 0;

  async function handleAdd() {
    if (!user) {
      router.push(`/login/?next=${encodeURIComponent(`/product/?id=${product.id}`)}`);
      return;
    }
    if (user.role !== 'CUSTOMER') {
      toast.info('Only customer accounts can add items to a cart.');
      return;
    }
    setBusy(true);
    try {
      await addItem(product.id, 1);
      toast.success(`${product.name} added to your cart.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not add this item.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className="group card card-hover flex flex-col overflow-hidden p-0">
      <Link
        href={`/product/?id=${product.id}`}
        className="relative block aspect-[4/3] overflow-hidden bg-slate-100"
        aria-label={`View ${product.name}`}
      >
        <ProductImage
          src={product.imageUrl}
          alt={product.name}
          className="transition duration-500 group-hover:scale-[1.04]"
        />
        <div className="absolute left-2.5 top-2.5 flex flex-wrap gap-1.5">
          {discount > 0 ? (
            <span className="rounded-full bg-orange-500 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-white shadow-sm">
              {discount}% off
            </span>
          ) : null}
          {soldOut ? (
            <span className="rounded-full bg-slate-900/80 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-white">
              Sold out
            </span>
          ) : product.lowStock ? (
            <span className="rounded-full bg-amber-500 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-white">
              Only {product.available} left
            </span>
          ) : null}
        </div>
      </Link>

      <div className="flex flex-1 flex-col p-3.5">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-[10px] font-bold uppercase tracking-[0.12em] text-indigo-600">
            {product.category.name}
          </span>
          <RatingStars rating={null} />
        </div>
        <Link href={`/product/?id=${product.id}`} className="mt-1 block">
          <h3 className="line-clamp-2 text-sm font-bold leading-5 text-navy transition group-hover:text-indigo-700">
            {product.name}
          </h3>
        </Link>
        <p className="mt-1 truncate text-xs text-slate-500">
          by{' '}
          <Link
            href={`/search/?seller=${product.seller.storeSlug}`}
            className="font-semibold text-slate-600 hover:text-indigo-700"
          >
            {product.seller.storeName}
          </Link>
        </p>

        <div className="mt-3 flex items-end justify-between gap-2">
          <div>
            <p className="text-base font-extrabold tracking-tight text-navy">
              {formatMoney(product.price)}
            </p>
            {product.compareAtPrice ? (
              <p className="text-xs text-slate-400 line-through">{formatMoney(product.compareAtPrice)}</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={handleAdd}
            disabled={soldOut || busy}
            className={cn(
              'inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-xs font-bold transition',
              soldOut
                ? 'cursor-not-allowed bg-slate-100 text-slate-400'
                : 'bg-indigo-600 text-white hover:bg-indigo-700',
            )}
            aria-label={`Add ${product.name} to cart`}
          >
            {busy ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
            ) : soldOut ? (
              <ShoppingBag className="h-3.5 w-3.5" aria-hidden />
            ) : (
              <Plus className="h-3.5 w-3.5" aria-hidden />
            )}
            {soldOut ? 'Sold out' : 'Add'}
          </button>
        </div>
      </div>
    </article>
  );
}

export function ProductGrid({ products }: { products: ProductCardType[] }) {
  return (
    <div className="grid grid-cols-2 gap-3.5 sm:gap-4 md:grid-cols-3 xl:grid-cols-4">
      {products.map((product) => (
        <ProductCard key={product.id} product={product} />
      ))}
    </div>
  );
}
