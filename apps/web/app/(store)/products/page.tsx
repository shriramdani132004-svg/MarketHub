import { Suspense } from 'react';
import { CatalogView } from '../../../components/store/CatalogView';
import { ProductCardSkeleton } from '../../../components/ui';

export const metadata = { title: 'All products' };

export default function ProductsPage() {
  return (
    <Suspense fallback={<CatalogFallback />}>
      <CatalogView variant="all" />
    </Suspense>
  );
}

function CatalogFallback() {
  return (
    <div className="container-hub py-10">
      <div className="skeleton h-8 w-56" />
      <div className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, index) => (
          <ProductCardSkeleton key={index} />
        ))}
      </div>
    </div>
  );
}
