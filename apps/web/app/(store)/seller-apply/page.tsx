'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  ArrowRight,
  BadgeCheck,
  BarChart3,
  Boxes,
  Building2,
  CheckCircle2,
  Eye,
  EyeOff,
  Lock,
  Mail,
  Phone,
  Store,
  Truck,
  User as UserIcon,
} from 'lucide-react';
import { useAuth } from '../../../lib/auth';
import { errorMessage } from '../../../lib/api';
import { Button, Field, Input, Skeleton, Textarea } from '../../../components/ui';
import { useToast } from '../../../components/ui/toast';

const PASSWORD_RULE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{10,128}$/;

const BENEFITS = [
  {
    icon: <Store className="h-4 w-4" />,
    title: 'Your own storefront',
    text: 'A public store page and product catalogue, reviewed by marketplace admins.',
  },
  {
    icon: <Boxes className="h-4 w-4" />,
    title: 'Real inventory controls',
    text: 'Stock on hand, reservations and an immutable movement ledger per product.',
  },
  {
    icon: <Truck className="h-4 w-4" />,
    title: 'Seller-wise fulfilment',
    text: 'Process only your parcel of each multi-vendor order with tracking references.',
  },
  {
    icon: <BarChart3 className="h-4 w-4" />,
    title: 'Honest analytics',
    text: 'Simulated revenue, units sold and low-stock alerts based on confirmed demo orders.',
  },
];

export default function SellerApplyPage() {
  const router = useRouter();
  const toast = useToast();
  const { user, loading, applyAsSeller } = useAuth();
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    confirm: '',
    storeName: '',
    storeSlug: '',
    description: '',
    businessContact: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (loading || !user) return;
    router.replace(user.role === 'SELLER' ? '/seller/' : user.role === 'ADMIN' ? '/admin/' : '/account/');
  }, [loading, user, router]);

  function update(key: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!PASSWORD_RULE.test(form.password)) {
      setError('Password must be 10-128 characters and include upper case, lower case and a number.');
      return;
    }
    if (form.password !== form.confirm) {
      setError('Passwords do not match.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await applyAsSeller({
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
        phone: form.phone.trim() || undefined,
        storeName: form.storeName.trim(),
        description: form.description.trim() || undefined,
        businessContact: form.businessContact.trim() || undefined,
      });
      toast.success('Application submitted. An administrator will review your store.');
      router.push('/seller/');
    } catch (cause) {
      setError(errorMessage(cause));
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="container-hub py-16">
        <Skeleton className="mx-auto h-96 w-full max-w-3xl rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="container-hub py-10">
      <div className="grid gap-8 lg:grid-cols-[1fr_1.2fr] lg:items-start">
        <div className="lg:sticky lg:top-32">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-teal-700">
            Sell on MarketHub
          </p>
          <h1 className="mt-2 text-3xl font-extrabold leading-tight tracking-tight text-navy sm:text-4xl">
            Open your store on a marketplace built for real operations.
          </h1>
          <p className="mt-4 text-sm leading-6 text-slate-600">
            Apply in a couple of minutes. Marketplace administrators review every store before it
            goes live, and you keep full control of products, inventory and fulfilment.
          </p>

          <div className="mt-6 space-y-3">
            {BENEFITS.map((benefit) => (
              <div key={benefit.title} className="flex gap-3 rounded-xl border border-slate-200 bg-white p-3.5">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-teal-50 text-teal-700">
                  {benefit.icon}
                </span>
                <div>
                  <p className="text-sm font-bold text-navy">{benefit.title}</p>
                  <p className="mt-0.5 text-xs leading-5 text-slate-500">{benefit.text}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-3 text-[11px] leading-5 text-amber-900">
            Demo marketplace: orders and payments are simulated. No real payouts or card processing
            take place.
          </div>

          <p className="mt-4 text-xs text-slate-500">
            Already selling?{' '}
            <Link href="/login/" className="font-semibold text-indigo-600 hover:text-indigo-800">
              Sign in to your seller workspace
            </Link>
          </p>
        </div>

        <div className="card p-6 sm:p-8">
          <div className="flex items-center gap-2">
            <BadgeCheck className="h-5 w-5 text-teal-600" aria-hidden />
            <h2 className="text-lg font-extrabold text-navy">Seller application</h2>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Your store starts in a pending state until an administrator approves it.
          </p>

          <form onSubmit={submit} className="mt-5 space-y-4">
            <fieldset className="space-y-3">
              <legend className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">
                <UserIcon className="h-3.5 w-3.5" aria-hidden /> Account owner
              </legend>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Your full name" required>
                  <Input
                    value={form.name}
                    onChange={(event) => update('name', event.target.value)}
                    required
                    minLength={2}
                    maxLength={80}
                    autoComplete="name"
                    placeholder="Aarav Mehta"
                  />
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
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Password" required>
                  <div className="relative">
                    <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
                    <Input
                      type={showPassword ? 'text' : 'password'}
                      value={form.password}
                      onChange={(event) => update('password', event.target.value)}
                      required
                      autoComplete="new-password"
                      placeholder="Strong password"
                      className="pl-10 pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((value) => !value)}
                      className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
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
                    placeholder="Repeat password"
                  />
                </Field>
              </div>
              <p className="text-[11px] text-slate-500">
                10-128 characters with upper case, lower case and a number.
              </p>
            </fieldset>

            <fieldset className="space-y-3 border-t border-slate-100 pt-4">
              <legend className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">
                <Building2 className="h-3.5 w-3.5" aria-hidden /> Store details
              </legend>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Store name" required>
                  <Input
                    value={form.storeName}
                    onChange={(event) => update('storeName', event.target.value)}
                    required
                    minLength={2}
                    maxLength={80}
                    placeholder="Nimbus Audio"
                  />
                </Field>
                <Field label="Store slug" hint="Optional. Lowercase letters, numbers and hyphens.">
                  <Input
                    value={form.storeSlug}
                    onChange={(event) => update('storeSlug', value_slug(event.target.value))}
                    pattern="^[a-z0-9]+(?:-[a-z0-9]+)*$"
                    maxLength={60}
                    placeholder="nimbus-audio"
                  />
                </Field>
              </div>
              <Field label="Store description" hint="Tell customers what you sell.">
                <Textarea
                  value={form.description}
                  onChange={(event) => update('description', event.target.value)}
                  maxLength={1000}
                  placeholder="Independent audio store specialising in studio headphones and accessories."
                />
              </Field>
              <Field label="Business contact" hint="Optional support email or phone shown to customers.">
                <Input
                  value={form.businessContact}
                  onChange={(event) => update('businessContact', event.target.value)}
                  maxLength={160}
                  placeholder="support@nimbus.example"
                />
              </Field>
            </fieldset>

            <ul className="grid gap-1 rounded-xl bg-slate-50 p-3 text-[11px] text-slate-600">
              <li className="flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-teal-600" aria-hidden />
                Store review usually completes after an administrator reviews the application.
              </li>
              <li className="flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-teal-600" aria-hidden />
                You can prepare drafts while waiting for approval.
              </li>
            </ul>

            {error ? (
              <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">
                {error}
              </p>
            ) : null}

            <Button type="submit" size="lg" className="w-full" loading={busy} icon={<ArrowRight className="h-4 w-4" />}>
              Submit seller application
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}

function value_slug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-/, '');
}
