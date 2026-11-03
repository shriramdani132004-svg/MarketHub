'use client';

import { useState } from 'react';
import {
  CheckCircle2,
  MapPin,
  Pencil,
  Plus,
  Trash2,
  User as UserIcon,
} from 'lucide-react';
import { useAuth } from '../../../lib/auth';
import { useApiData } from '../../../lib/useApi';
import { api, errorMessage } from '../../../lib/api';
import type { Address } from '../../../lib/types';
import {
  Button,
  ButtonLink,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  Field,
  Input,
  Modal,
  Skeleton,
} from '../../../components/ui';
import { useToast } from '../../../components/ui/toast';

const BLANK = {
  recipientName: '',
  phone: '',
  addressLine1: '',
  addressLine2: '',
  city: '',
  state: '',
  postalCode: '',
  country: 'India',
  isDefault: false,
};

type AddressForm = typeof BLANK;

export default function AddressesPage() {
  const { user, loading: authLoading } = useAuth();
  const toast = useToast();
  const addresses = useApiData<{ items: Address[] }>(user ? '/addresses' : null);
  const [editing, setEditing] = useState<Address | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<Address | null>(null);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState<AddressForm>({ ...BLANK });
  const [error, setError] = useState<string | null>(null);

  if (authLoading) {
    return (
      <div className="container-hub space-y-4 py-10">
        <Skeleton className="h-10 w-56" />
        <Skeleton className="h-32 w-full rounded-2xl" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="container-hub py-16">
        <EmptyState
          icon={<MapPin className="h-5 w-5" />}
          title="Sign in to manage addresses"
          description="Delivery addresses are stored securely against your account."
          action={<ButtonLink href="/login/?next=%2Faddresses%2F">Sign in</ButtonLink>}
        />
      </div>
    );
  }

  function startCreate() {
    setForm({ ...BLANK, isDefault: (addresses.data?.items.length ?? 0) === 0 });
    setEditing(null);
    setCreating(true);
    setError(null);
  }

  function startEdit(address: Address) {
    setForm({
      recipientName: address.recipientName,
      phone: address.phone,
      addressLine1: address.addressLine1,
      addressLine2: address.addressLine2 ?? '',
      city: address.city,
      state: address.state,
      postalCode: address.postalCode,
      country: address.country,
      isDefault: address.isDefault,
    });
    setEditing(address);
    setCreating(false);
    setError(null);
  }

  function closeForm() {
    setCreating(false);
    setEditing(null);
    setError(null);
  }

  function update(key: keyof AddressForm, value: string | boolean) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const body = {
        ...form,
        addressLine2: form.addressLine2.trim() || undefined,
      };
      if (editing) {
        await api(`/addresses/${editing.id}`, { method: 'PATCH', body });
        toast.success('Address updated.');
      } else {
        await api('/addresses', { method: 'POST', body });
        toast.success('Address added.');
      }
      closeForm();
      addresses.reload();
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  }

  async function makeDefault(address: Address) {
    try {
      await api(`/addresses/${address.id}/default`, { method: 'PATCH' });
      toast.success('Default delivery address updated.');
      addresses.reload();
    } catch (cause) {
      toast.error(errorMessage(cause));
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    setBusy(true);
    try {
      await api(`/addresses/${deleting.id}`, { method: 'DELETE' });
      toast.success('Address removed.');
      setDeleting(null);
      addresses.reload();
    } catch (cause) {
      toast.error(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  }

  const items = addresses.data?.items ?? [];

  return (
    <div className="container-hub py-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-indigo-600">
            Account
          </p>
          <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-navy sm:text-3xl">
            Saved addresses
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Reuse delivery details at checkout. One address is marked as your default.
          </p>
        </div>
        <Button onClick={startCreate} icon={<Plus className="h-4 w-4" />}>
          Add address
        </Button>
      </div>

      <div className="mt-6">
        {addresses.error ? (
          <ErrorState message={addresses.error} onRetry={addresses.reload} />
        ) : addresses.loading ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {Array.from({ length: 2 }).map((_, index) => (
              <Skeleton key={index} className="h-40 w-full rounded-2xl" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <EmptyState
            icon={<MapPin className="h-5 w-5" />}
            title="No saved addresses"
            description="Add a delivery address now, or create one during your next checkout."
            action={<Button onClick={startCreate}>Add your first address</Button>}
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {items.map((address) => (
              <article
                key={address.id}
                className={`card relative p-5 ${
                  address.isDefault ? 'border-indigo-300 ring-1 ring-indigo-100' : ''
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-bold text-navy">{address.recipientName}</p>
                    <p className="mt-0.5 text-xs text-slate-500">{address.phone}</p>
                  </div>
                  {address.isDefault ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-teal-50 px-2 py-0.5 text-[10px] font-bold uppercase text-teal-700 ring-1 ring-inset ring-teal-200">
                      <CheckCircle2 className="h-3 w-3" aria-hidden />
                      Default
                    </span>
                  ) : null}
                </div>
                <p className="mt-2.5 text-xs leading-5 text-slate-600">
                  {address.addressLine1}
                  {address.addressLine2 ? `, ${address.addressLine2}` : ''}
                  <br />
                  {address.city}, {address.state} {address.postalCode}
                  <br />
                  {address.country}
                </p>

                <div className="mt-4 flex flex-wrap items-center gap-1.5 border-t border-slate-100 pt-3">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => startEdit(address)}
                    icon={<Pencil className="h-3.5 w-3.5" />}
                  >
                    Edit
                  </Button>
                  {!address.isDefault ? (
                    <Button variant="ghost" size="sm" onClick={() => makeDefault(address)}>
                      Make default
                    </Button>
                  ) : null}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-rose-600 hover:bg-rose-50"
                    onClick={() => setDeleting(address)}
                    icon={<Trash2 className="h-3.5 w-3.5" />}
                  >
                    Delete
                  </Button>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>

      <Modal
        open={creating || editing !== null}
        onClose={closeForm}
        title={editing ? 'Edit address' : 'Add a delivery address'}
        description="Fields marked with an asterisk are required."
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={closeForm} disabled={busy}>
              Cancel
            </Button>
            <Button loading={busy} onClick={() => {
              const formEl = document.getElementById('address-form') as HTMLFormElement | null;
              formEl?.requestSubmit();
            }}>
              {editing ? 'Save changes' : 'Add address'}
            </Button>
          </>
        }
      >
        <form id="address-form" onSubmit={submit} className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Recipient name" required>
              <Input
                value={form.recipientName}
                onChange={(event) => update('recipientName', event.target.value)}
                required
                minLength={2}
                maxLength={80}
                placeholder="Aarav Mehta"
              />
            </Field>
            <Field label="Phone" required>
              <Input
                value={form.phone}
                onChange={(event) => update('phone', event.target.value)}
                required
                pattern="^[0-9+\-\s()]{6,24}$"
                placeholder="9876543210"
              />
            </Field>
          </div>
          <Field label="Address line 1" required>
            <Input
              value={form.addressLine1}
              onChange={(event) => update('addressLine1', event.target.value)}
              required
              minLength={4}
              maxLength={160}
              placeholder="Flat, house number, street"
            />
          </Field>
          <Field label="Address line 2" hint="Optional: landmark or area">
            <Input
              value={form.addressLine2}
              onChange={(event) => update('addressLine2', event.target.value)}
              maxLength={160}
            />
          </Field>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="City" required>
              <Input
                value={form.city}
                onChange={(event) => update('city', event.target.value)}
                required
                minLength={2}
                maxLength={80}
              />
            </Field>
            <Field label="State" required>
              <Input
                value={form.state}
                onChange={(event) => update('state', event.target.value)}
                required
                minLength={2}
                maxLength={80}
              />
            </Field>
            <Field label="Postal code" required>
              <Input
                value={form.postalCode}
                onChange={(event) => update('postalCode', event.target.value)}
                required
                pattern="^[0-9A-Za-z -]{4,12}$"
                maxLength={12}
              />
            </Field>
          </div>
          <Field label="Country">
            <Input
              value={form.country}
              onChange={(event) => update('country', event.target.value)}
              maxLength={80}
            />
          </Field>
          <label className="flex items-center gap-2.5 rounded-xl border border-slate-200 bg-slate-50/60 px-3 py-2.5 text-sm font-medium text-slate-700">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              checked={form.isDefault}
              onChange={(event) => update('isDefault', event.target.checked)}
            />
            Use this as my default delivery address
          </label>
          {error ? (
            <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">
              {error}
            </p>
          ) : null}
        </form>
      </Modal>

      <ConfirmDialog
        open={deleting !== null}
        title="Delete this address?"
        description="The address will be removed from your account. Past orders keep their own address snapshot."
        confirmLabel="Delete address"
        loading={busy}
        onConfirm={confirmDelete}
        onClose={() => setDeleting(null)}
      />
    </div>
  );
}
