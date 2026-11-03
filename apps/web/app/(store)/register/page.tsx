'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  Lock,
  Mail,
  Phone,
  User as UserIcon,
} from 'lucide-react';
import { useAuth } from '../../../lib/auth';
import { errorMessage } from '../../../lib/api';
import { Button, Field, Input, Skeleton } from '../../../components/ui';

const PASSWORD_RULE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{10,128}$/;

function RegisterView() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get('next');
  const { user, loading, register } = useAuth();
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '', confirm: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (loading || !user) return;
    router.replace(
      next ??
        (user.role === 'ADMIN' ? '/admin/' : user.role === 'SELLER' ? '/seller/' : '/my-orders/'),
    );
  }, [loading, user, next, router]);

  function update(key: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  const passwordChecks = [
    { label: 'At least 10 characters', valid: form.password.length >= 10 },
    { label: 'Upper and lower case', valid: /[a-z]/.test(form.password) && /[A-Z]/.test(form.password) },
    { label: 'Contains a number', valid: /\d/.test(form.password) },
  ];
  const passwordsMatch = form.password.length > 0 && form.password === form.confirm;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!PASSWORD_RULE.test(form.password)) {
      setError('Password must be 10-128 characters and include upper case, lower case and a number.');
      return;
    }
    if (!passwordsMatch) {
      setError('Passwords do not match.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await register({
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
        phone: form.phone.trim() || undefined,
      });
    } catch (cause) {
      setError(errorMessage(cause));
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="container-hub py-16">
        <Skeleton className="mx-auto h-96 w-full max-w-md rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="container-hub py-10">
      <div className="mx-auto max-w-xl">
        <div className="card p-6 sm:p-8">
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-indigo-600">
            Customer account
          </p>
          <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-navy">
            Create your MarketHub account
          </h1>
          <p className="mt-1.5 text-sm text-slate-500">
            Already registered?{' '}
            <Link href="/login/" className="link font-semibold">
              Sign in
            </Link>
          </p>

          <form onSubmit={submit} className="mt-6 space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Full name" required>
                <div className="relative">
                  <UserIcon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
                  <Input
                    value={form.name}
                    onChange={(event) => update('name', event.target.value)}
                    required
                    minLength={2}
                    maxLength={80}
                    autoComplete="name"
                    placeholder="Aarav Mehta"
                    className="pl-10"
                  />
                </div>
              </Field>
              <Field label="Phone" hint="Optional">
                <div className="relative">
                  <Phone className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
                  <Input
                    value={form.phone}
                    onChange={(event) => update('phone', event.target.value)}
                    maxLength={24}
                    autoComplete="tel"
                    placeholder="+91 98765 43210"
                    className="pl-10"
                  />
                </div>
              </Field>
            </div>

            <Field label="Email address" required>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
                <Input
                  type="email"
                  value={form.email}
                  onChange={(event) => update('email', event.target.value)}
                  required
                  autoComplete="email"
                  placeholder="you@example.com"
                  className="pl-10"
                />
              </div>
            </Field>

            <Field label="Password" required>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
                <Input
                  type={showPassword ? 'text' : 'password'}
                  value={form.password}
                  onChange={(event) => update('password', event.target.value)}
                  required
                  autoComplete="new-password"
                  placeholder="Create a strong password"
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

            <Field label="Confirm password" required>
              <Input
                type={showPassword ? 'text' : 'password'}
                value={form.confirm}
                onChange={(event) => update('confirm', event.target.value)}
                required
                autoComplete="new-password"
                placeholder="Repeat your password"
              />
            </Field>

            <ul className="grid gap-1.5 rounded-xl bg-slate-50 p-3 text-[11px]">
              {passwordChecks.map((check) => (
                <li
                  key={check.label}
                  className={`flex items-center gap-1.5 ${
                    check.valid ? 'font-semibold text-teal-700' : 'text-slate-500'
                  }`}
                >
                  <CheckCircle2
                    className={`h-3.5 w-3.5 ${check.valid ? 'text-teal-600' : 'text-slate-300'}`}
                    aria-hidden
                  />
                  {check.label}
                </li>
              ))}
              <li
                className={`flex items-center gap-1.5 ${
                  passwordsMatch ? 'font-semibold text-teal-700' : 'text-slate-500'
                }`}
              >
                <CheckCircle2
                  className={`h-3.5 w-3.5 ${passwordsMatch ? 'text-teal-600' : 'text-slate-300'}`}
                  aria-hidden
                />
                Passwords match
              </li>
            </ul>

            {error ? (
              <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">
                {error}
              </p>
            ) : null}

            <Button type="submit" size="lg" className="w-full" loading={busy} icon={<ArrowRight className="h-4 w-4" />}>
              Create account
            </Button>
          </form>

          <div className="mt-5 border-t border-slate-100 pt-4 text-xs text-slate-500">
            Want to sell instead?{' '}
            <Link href="/seller-apply/" className="font-semibold text-teal-700 hover:text-teal-900">
              Apply for a seller account
            </Link>
          </div>
        </div>

        <p className="mt-4 text-center text-[11px] leading-5 text-slate-500">
          By creating an account you acknowledge this is a demo marketplace. Payments are simulated
          and no real money is processed.
        </p>
      </div>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense
      fallback={
        <div className="container-hub py-16">
          <Skeleton className="mx-auto h-96 w-full max-w-md rounded-2xl" />
        </div>
      }
    >
      <RegisterView />
    </Suspense>
  );
}
