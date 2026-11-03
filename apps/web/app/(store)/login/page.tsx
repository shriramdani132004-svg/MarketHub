'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import {
  ArrowRight,
  Eye,
  EyeOff,
  Lock,
  Mail,
  ShieldCheck,
  ShoppingBag,
  Store,
} from 'lucide-react';
import { useAuth } from '../../../lib/auth';
import { errorMessage } from '../../../lib/api';
import { Button, Field, Input, Skeleton } from '../../../components/ui';

function LoginView() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get('next');
  const { user, loading, login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (loading || !user) return;
    if (next) {
      router.replace(next);
      return;
    }
    router.replace(
      user.role === 'ADMIN' ? '/admin/' : user.role === 'SELLER' ? '/seller/' : '/my-orders/',
    );
  }, [loading, user, next, router]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login(email.trim(), password);
    } catch (cause) {
      setError(errorMessage(cause));
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="container-hub py-16">
        <Skeleton className="mx-auto h-80 w-full max-w-md rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="container-hub py-10">
      <div className="mx-auto grid max-w-5xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-soft lg:grid-cols-2">
        <div className="relative hidden flex-col justify-between bg-navy p-8 text-white lg:flex">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-teal-300">
              Welcome back
            </p>
            <h2 className="mt-3 text-3xl font-extrabold leading-tight">
              One account for shopping, selling and operations.
            </h2>
            <p className="mt-4 text-sm leading-6 text-indigo-100">
              Sign in to pick up your cart, track seller-wise parcels or manage your store. All
              payments stay simulated.
            </p>
          </div>
          <ul className="mt-8 space-y-3 text-sm text-indigo-100">
            <li className="flex items-center gap-2.5">
              <ShoppingBag className="h-4 w-4 text-teal-300" aria-hidden />
              Persistent cart and order history
            </li>
            <li className="flex items-center gap-2.5">
              <Store className="h-4 w-4 text-teal-300" aria-hidden />
              Seller workspace with real inventory
            </li>
            <li className="flex items-center gap-2.5">
              <ShieldCheck className="h-4 w-4 text-teal-300" aria-hidden />
              HttpOnly sessions with rotating refresh
            </li>
          </ul>
        </div>

        <div className="p-6 sm:p-10">
          <h1 className="text-2xl font-extrabold tracking-tight text-navy">Sign in</h1>
          <p className="mt-1.5 text-sm text-slate-500">
            New to MarketHub?{' '}
            <Link href="/register/" className="link font-semibold">
              Create an account
            </Link>
          </p>

          <form onSubmit={submit} className="mt-6 space-y-4">
            <Field label="Email address" htmlFor="login-email" required>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
                <Input
                  id="login-email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                  autoComplete="email"
                  placeholder="you@example.com"
                  className="pl-10"
                />
              </div>
            </Field>
            <Field label="Password" htmlFor="login-password" required>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
                <Input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                  autoComplete="current-password"
                  placeholder="Your password"
                  className="pl-10 pr-11"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" aria-hidden /> : <Eye className="h-4 w-4" aria-hidden />}
                </button>
              </div>
            </Field>

            {error ? (
              <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">
                {error}
              </p>
            ) : null}

            <Button type="submit" size="lg" className="w-full" loading={busy} icon={<ArrowRight className="h-4 w-4" />}>
              Sign in securely
            </Button>
          </form>

          <div className="mt-5 rounded-xl bg-slate-50 px-3.5 py-3 text-[11px] leading-5 text-slate-500">
            Accounts are protected with Argon2id hashing, rotated refresh sessions and CSRF
            protection. Sessions use HttpOnly cookies.
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
            <Link href="/register/" className="font-semibold text-indigo-600 hover:text-indigo-800">
              Create a customer account
            </Link>
            <Link href="/seller-apply/" className="font-semibold text-teal-700 hover:text-teal-900">
              Apply to sell
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="container-hub py-16">
          <Skeleton className="mx-auto h-80 w-full max-w-md rounded-2xl" />
        </div>
      }
    >
      <LoginView />
    </Suspense>
  );
}
