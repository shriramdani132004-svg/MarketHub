import Link from 'next/link';
import { LogoMark } from '../components/brand/Logo';

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-page px-6 text-center">
      <LogoMark className="h-12 w-12" />
      <p className="mt-6 text-[11px] font-bold uppercase tracking-[0.18em] text-indigo-600">
        404 · Page not found
      </p>
      <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-navy">
        This aisle doesn’t exist
      </h1>
      <p className="mt-3 max-w-md text-sm leading-6 text-slate-500">
        The page you were looking for may have moved, or the link is incomplete. Head back to the
        marketplace to keep exploring.
      </p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <Link
          href="/"
          className="inline-flex h-11 items-center justify-center rounded-xl bg-indigo-600 px-5 text-sm font-bold text-white transition hover:bg-indigo-700"
        >
          Back to MarketHub
        </Link>
        <Link
          href="/products/"
          className="inline-flex h-11 items-center justify-center rounded-xl border border-slate-200 bg-white px-5 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
        >
          Browse products
        </Link>
      </div>
    </div>
  );
}
