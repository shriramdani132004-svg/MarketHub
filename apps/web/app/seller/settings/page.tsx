'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  BadgeCheck,
  Clock,
  ExternalLink,
  ImageOff,
  Lock,
  Save,
  ShieldAlert,
  Store,
} from 'lucide-react';
import { useApiData } from '../../../lib/useApi';
import { useAuth } from '../../../lib/auth';
import { api, errorMessage } from '../../../lib/api';
import { formatDateTime, statusLabel } from '../../../lib/format';
import {
  Badge,
  Button,
  ButtonLink,
  ErrorState,
  Field,
  Input,
  Skeleton,
  Textarea,
} from '../../../components/ui';
import { useToast } from '../../../components/ui/toast';

interface SellerProfile {
  id: string;
  storeName: string;
  storeSlug: string;
  description: string | null;
  logoUrl: string | null;
  businessContact: string | null;
  approvalStatus: string;
  rejectionReason: string | null;
  approvedAt: string | null;
  createdAt: string;
}

export default function SellerSettingsPage() {
  const toast = useToast();
  const { user, setUser } = useAuth();
  const profile = useApiData<SellerProfile>('/seller/profile');
  const [form, setForm] = useState({
    storeName: '',
    description: '',
    logoUrl: '',
    businessContact: '',
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!profile.data) return;
    setForm({
      storeName: profile.data.storeName,
      description: profile.data.description ?? '',
      logoUrl: profile.data.logoUrl ?? '',
      businessContact: profile.data.businessContact ?? '',
    });
  }, [profile.data]);

  if (profile.error) {
    return <ErrorState message={profile.error} onRetry={profile.reload} />;
  }

  if (profile.loading || !profile.data) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-20 w-full rounded-2xl" />
        <Skeleton className="h-72 w-full rounded-2xl" />
      </div>
    );
  }

  const data = profile.data;
  const suspended = data.approvalStatus === 'SUSPENDED';

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const updated = await api<SellerProfile>('/seller/profile', {
        method: 'PATCH',
        body: {
          storeName: form.storeName.trim(),
          description: form.description.trim(),
          logoUrl: form.logoUrl.trim(),
          businessContact: form.businessContact.trim(),
        },
      });
      toast.success('Store profile updated.');
      profile.reload();
      if (user?.sellerProfile) {
        setUser({
          ...user,
          sellerProfile: {
            ...user.sellerProfile,
            storeName: updated.storeName,
            description: updated.description,
            logoUrl: updated.logoUrl,
          },
        });
      }
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-teal-700">Settings</p>
          <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-navy">Store profile</h1>
          <p className="mt-1 text-sm text-slate-500">
            Public branding and contact details shown on your store page and product listings.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge
            tone={
              data.approvalStatus === 'APPROVED'
                ? 'teal'
                : data.approvalStatus === 'PENDING'
                  ? 'amber'
                  : 'rose'
            }
          >
            {statusLabel(data.approvalStatus)}
          </Badge>
          {data.approvalStatus === 'APPROVED' ? (
            <ButtonLink
              href={`/sellers/?slug=${data.storeSlug}`}
              size="sm"
              variant="secondary"
              icon={<ExternalLink className="h-3.5 w-3.5" />}
            >
              View public store
            </ButtonLink>
          ) : null}
        </div>
      </div>

      {data.approvalStatus !== 'APPROVED' ? (
        <div
          className={`flex items-start gap-3 rounded-2xl border px-4 py-3 text-sm ${
            data.approvalStatus === 'PENDING'
              ? 'border-amber-200 bg-amber-50 text-amber-900'
              : 'border-rose-200 bg-rose-50 text-rose-900'
          }`}
        >
          {data.approvalStatus === 'PENDING' ? (
            <Clock className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
          ) : (
            <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
          )}
          <div>
            <p className="font-bold">
              {data.approvalStatus === 'PENDING'
                ? 'Your store is awaiting approval'
                : data.approvalStatus === 'SUSPENDED'
                  ? 'Your store is suspended'
                  : 'Your application was not approved'}
            </p>
            <p className="mt-1 text-xs leading-5">
              {data.rejectionReason ??
                'An administrator reviews every application. You can prepare your profile meanwhile.'}
            </p>
          </div>
        </div>
      ) : null}

      {suspended ? (
        <div className="flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
          <Lock className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
          <p>
            Suspended stores cannot edit their profile. Contact marketplace administration if you
            believe this is an error. Your existing orders remain visible and must be fulfilled.
          </p>
        </div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr] xl:items-start">
        <form onSubmit={submit} className="card space-y-4 p-5">
          <div className="flex items-center gap-2">
            <Store className="h-4 w-4 text-teal-600" aria-hidden />
            <h2 className="text-base font-bold text-navy">Public information</h2>
          </div>

          <Field label="Store name" required hint="2-80 characters. Shown across the marketplace.">
            <Input
              value={form.storeName}
              onChange={(event) => setForm((current) => ({ ...current, storeName: event.target.value }))}
              required
              minLength={2}
              maxLength={80}
              disabled={suspended}
            />
          </Field>

          <Field label="Store slug" hint="Slugs are fixed after creation to keep store links stable.">
            <Input value={data.storeSlug} disabled readOnly />
          </Field>

          <Field label="Description" hint="Up to 1000 characters. Tell customers about your store.">
            <Textarea
              value={form.description}
              onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
              maxLength={1000}
              disabled={suspended}
              placeholder="Independent audio store specialising in studio headphones and accessories."
            />
          </Field>

          <Field label="Business contact" hint="Support email or phone shown to customers.">
            <Input
              value={form.businessContact}
              onChange={(event) =>
                setForm((current) => ({ ...current, businessContact: event.target.value }))
              }
              maxLength={160}
              disabled={suspended}
              placeholder="support@nimbus.example"
            />
          </Field>

          <Field label="Logo URL" hint="Optional. Must be a valid http(s) image URL.">
            <Input
              value={form.logoUrl}
              onChange={(event) => setForm((current) => ({ ...current, logoUrl: event.target.value }))}
              maxLength={500}
              disabled={suspended}
              placeholder="https://images.example.com/logo.jpg"
            />
          </Field>

          {error ? (
            <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">
              {error}
            </p>
          ) : null}

          <div className="flex items-center justify-between gap-3 border-t border-slate-100 pt-3">
            <p className="text-[11px] text-slate-500">Changes publish immediately.</p>
            <Button
              type="submit"
              loading={busy}
              disabled={suspended}
              icon={<Save className="h-4 w-4" />}
            >
              Save changes
            </Button>
          </div>
        </form>

        <div className="space-y-4">
          <section className="card p-5">
            <h2 className="text-base font-bold text-navy">Store preview</h2>
            <div className="mt-3 overflow-hidden rounded-xl border border-slate-200">
              <div className="h-16 bg-gradient-to-r from-navy via-indigo-900 to-teal-800" />
              <div className="px-4 pb-4">
                <div className="-mt-7 flex items-end gap-3">
                  <span className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-xl border-4 border-white bg-gradient-to-br from-indigo-600 to-violet-600 text-sm font-extrabold text-white">
                    {form.logoUrl ? (
                      <img
                        src={form.logoUrl}
                        alt="Store logo preview"
                        className="h-full w-full object-cover"
                        onError={(event) => {
                          event.currentTarget.style.display = 'none';
                        }}
                      />
                    ) : (
                      (form.storeName || 'MH').slice(0, 2).toUpperCase()
                    )}
                  </span>
                  <div className="pb-0.5">
                    <p className="flex items-center gap-1 text-sm font-extrabold text-navy">
                      {form.storeName || 'Store name'}
                      {data.approvalStatus === 'APPROVED' ? (
                        <BadgeCheck className="h-4 w-4 text-teal-600" aria-hidden />
                      ) : null}
                    </p>
                    <p className="text-[10px] text-slate-500">/{data.storeSlug}</p>
                  </div>
                </div>
                <p className="mt-3 line-clamp-3 text-xs leading-5 text-slate-600">
                  {form.description || 'Your store description appears here.'}
                </p>
                {form.businessContact ? (
                  <p className="mt-2 text-[11px] font-semibold text-indigo-700">
                    {form.businessContact}
                  </p>
                ) : null}
              </div>
            </div>
            {!form.logoUrl ? (
              <p className="mt-2 flex items-center gap-1.5 text-[11px] text-slate-500">
                <ImageOff className="h-3.5 w-3.5" aria-hidden />
                Add a logo URL to replace the initials placeholder.
              </p>
            ) : null}
          </section>

          <section className="card p-5 text-xs text-slate-600">
            <h2 className="text-base font-bold text-navy">Store record</h2>
            <dl className="mt-2 space-y-1.5">
              <Row label="Store ID" value={data.id} mono />
              <Row label="Created" value={formatDateTime(data.createdAt)} />
              <Row label="Approved" value={data.approvedAt ? formatDateTime(data.approvedAt) : 'Not yet'} />
              <Row label="Status" value={statusLabel(data.approvalStatus)} />
            </dl>
            <Link
              href="/seller/products/"
              className="mt-3 inline-flex text-[11px] font-bold text-indigo-600 hover:text-indigo-800"
            >
              Manage your catalogue →
            </Link>
          </section>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-slate-100 py-1 last:border-0">
      <dt className="text-slate-500">{label}</dt>
      <dd className={`text-right font-semibold text-slate-800 ${mono ? 'font-mono text-[10px]' : ''}`}>
        {value}
      </dd>
    </div>
  );
}
