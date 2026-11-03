'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  ClipboardList,
  MapPin,
  PackageCheck,
  Truck,
} from 'lucide-react';
import { useApiData } from '../../../lib/useApi';
import { api, errorMessage } from '../../../lib/api';
import type { SellerOrderGroup } from '../../../lib/types';
import { formatDateTime, formatMoney, statusLabel } from '../../../lib/format';
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
  StatusBadge,
} from '../../../components/ui';
import { useToast } from '../../../components/ui/toast';
import { ProductImage } from '../../../components/ui';

function SellerOrderView() {
  const params = useSearchParams();
  const id = params.get('id');
  const toast = useToast();
  const order = useApiData<SellerOrderGroup>(id ? `/seller/orders/${id}` : null);
  const [action, setAction] = useState<'PROCESSING' | 'DELIVERED' | null>(null);
  const [shippingOpen, setShippingOpen] = useState(false);
  const [trackingReference, setTrackingReference] = useState('');
  const [trackingUrl, setTrackingUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!id) {
    return (
      <EmptyState
        icon={<ClipboardList className="h-5 w-5" />}
        title="No order selected"
        description="Open a seller order from your fulfilment queue."
        action={<ButtonLink href="/seller/orders/">Seller orders</ButtonLink>}
      />
    );
  }

  if (order.loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-16 w-full rounded-2xl" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    );
  }

  if (order.error || !order.data) {
    return (
      <div className="space-y-4">
        <ErrorState message={order.error ?? 'Order group not found.'} onRetry={order.reload} />
        <div className="text-center">
          <ButtonLink href="/seller/orders/" variant="secondary">
            Back to seller orders
          </ButtonLink>
        </div>
      </div>
    );
  }

  const data = order.data;
  const cancelled = data.status === 'CANCELLED' || data.order.orderStatus === 'CANCELLED';
  const units = data.items.reduce((sum, item) => sum + item.quantity, 0);

  async function transition(next: 'PROCESSING' | 'SHIPPED' | 'DELIVERED') {
    setBusy(true);
    setError(null);
    try {
      await api(`/seller/orders/${data.id}/status`, {
        method: 'PATCH',
        body: {
          status: next,
          ...(next === 'SHIPPED'
            ? {
                trackingReference: trackingReference.trim() || undefined,
                trackingUrl: trackingUrl.trim() || undefined,
              }
            : {}),
        },
      });
      toast.success(
        next === 'PROCESSING'
          ? 'Order moved to processing.'
          : next === 'SHIPPED'
            ? 'Order marked as shipped. The customer has been notified.'
            : 'Order marked as delivered. The customer can now review their items.',
      );
      setAction(null);
      setShippingOpen(false);
      order.reload();
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <ButtonLink href="/seller/orders/" size="sm" variant="ghost" icon={<ArrowLeft className="h-3.5 w-3.5" />}>
          Back to orders
        </ButtonLink>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-teal-700">
              Seller order group
            </p>
            <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-navy">
              {data.order.orderNumber}
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Placed {formatDateTime(data.createdAt)} · {units} unit{units === 1 ? '' : 's'} ·{' '}
              {data.order.customer.name}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={data.status} />
            <StatusBadge status={data.order.paymentStatus} type="payment" />
            {data.order.orderStatus === 'CANCELLED' ? (
              <StatusBadge status="CANCELLED" />
            ) : null}
          </div>
        </div>
      </div>

      {cancelled ? (
        <div className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-slate-500" aria-hidden />
          <p>
            This order was cancelled. No fulfilment action is possible, and reserved stock has been
            released automatically.
          </p>
        </div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[1.5fr_1fr] xl:items-start">
        <div className="space-y-4">
          <section className="card overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
              <h2 className="text-base font-bold text-navy">Your items in this order</h2>
              <span className="text-xs text-slate-500">{data.items.length} line items</span>
            </div>
            <ul className="divide-y divide-slate-100">
              {data.items.map((item) => (
                <li key={item.id} className="flex items-center gap-3 px-5 py-3">
                  <span className="h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-white">
                    <ProductImage src={item.product?.imageUrl} alt={item.name} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-800">{item.name}</p>
                    <p className="text-[11px] text-slate-500">
                      SKU {item.sku} · {item.quantity} × {formatMoney(item.unitPrice)}
                    </p>
                  </div>
                  <p className="text-sm font-bold text-navy">{formatMoney(item.lineTotal)}</p>
                </li>
              ))}
            </ul>
            <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/60 px-5 py-3 text-sm">
              <span className="text-slate-500">
                Subtotal {formatMoney(data.subtotal)} · Shipping{' '}
                {Number(data.shippingAmount) === 0 ? 'Free' : formatMoney(data.shippingAmount)}
              </span>
              <span className="font-extrabold text-navy">
                {formatMoney(Number(data.subtotal) + Number(data.shippingAmount))}
              </span>
            </div>
          </section>

          <section className="card overflow-hidden">
            <div className="border-b border-slate-100 px-5 py-3">
              <h2 className="text-base font-bold text-navy">Customer &amp; delivery</h2>
            </div>
            <div className="grid gap-4 p-5 sm:grid-cols-2">
              <div>
                <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.1em] text-slate-500">
                  <MapPin className="h-3.5 w-3.5" aria-hidden />
                  Ship to
                </p>
                <p className="mt-1.5 text-sm font-bold text-navy">
                  {data.order.shippingAddress.recipientName}
                </p>
                <p className="mt-1 text-xs leading-5 text-slate-600">
                  {data.order.shippingAddress.addressLine1}
                  {data.order.shippingAddress.addressLine2
                    ? `, ${data.order.shippingAddress.addressLine2}`
                    : ''}
                  <br />
                  {data.order.shippingAddress.city}, {data.order.shippingAddress.state}{' '}
                  {data.order.shippingAddress.postalCode}
                  <br />
                  {data.order.shippingAddress.country} · {data.order.shippingAddress.phone}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-slate-500">
                  Customer
                </p>
                <p className="mt-1.5 text-sm font-bold text-navy">{data.order.customer.name}</p>
                <p className="text-xs text-slate-600">{data.order.customer.email}</p>
                {data.order.customer.phone ? (
                  <p className="text-xs text-slate-600">{data.order.customer.phone}</p>
                ) : null}
                <p className="mt-2 text-[11px] text-slate-500">
                  Payment {data.order.payment?.status ?? '—'}
                  {data.order.payment ? ` · ${data.order.payment.paymentReference}` : ''}
                </p>
              </div>
            </div>
          </section>
        </div>

        <div className="space-y-4 xl:sticky xl:top-24">
          <section className="card p-5">
            <h2 className="flex items-center gap-2 text-base font-bold text-navy">
              <PackageCheck className="h-4 w-4 text-teal-600" aria-hidden />
              Fulfilment actions
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              Advance one step at a time. Each action notifies the customer.
            </p>

            <div className="mt-4 space-y-2">
              {data.status === 'PAID' ? (
                <Button className="w-full" onClick={() => setAction('PROCESSING')}>
                  Start processing
                </Button>
              ) : null}
              {data.status === 'PROCESSING' ? (
                <Button className="w-full" onClick={() => setShippingOpen(true)} icon={<Truck className="h-4 w-4" />}>
                  Mark as shipped
                </Button>
              ) : null}
              {data.status === 'SHIPPED' ? (
                <Button className="w-full" variant="teal" onClick={() => setAction('DELIVERED')} icon={<CheckCircle2 className="h-4 w-4" />}>
                  Mark as delivered
                </Button>
              ) : null}
              {data.status === 'DELIVERED' ? (
                <div className="rounded-lg border border-teal-200 bg-teal-50 px-3 py-2 text-xs font-semibold text-teal-800">
                  This parcel is fully delivered
                  {data.deliveredAt ? ` (${formatDateTime(data.deliveredAt)})` : ''}.
                </div>
              ) : null}
              {data.status === 'PENDING_PAYMENT' ? (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">
                  Waiting for the customer to complete the demo payment.
                </div>
              ) : null}
              {cancelled ? (
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600">
                  No actions available for cancelled orders.
                </div>
              ) : null}
            </div>

            {error && !shippingOpen ? (
              <p className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">
                {error}
              </p>
            ) : null}
          </section>

          <section className="card p-5 text-xs text-slate-600">
            <h2 className="text-base font-bold text-navy">Shipment</h2>
            <dl className="mt-2 space-y-1.5">
              <Row label="Group status" value={statusLabel(data.status)} />
              <Row label="Parent order" value={statusLabel(data.order.orderStatus)} />
              <Row label="Shipped" value={data.shippedAt ? formatDateTime(data.shippedAt) : 'Not yet'} />
              <Row label="Delivered" value={data.deliveredAt ? formatDateTime(data.deliveredAt) : 'Not yet'} />
              <Row label="Tracking ref" value={data.trackingReference ?? '—'} />
            </dl>
            {data.trackingUrl ? (
              <a
                href={data.trackingUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-block font-bold text-indigo-600 hover:text-indigo-800"
              >
                Open carrier tracking →
              </a>
            ) : null}
          </section>

          <Link href={`/order/?id=${data.order.id}`} className="hidden" aria-hidden />
        </div>
      </div>

      <ConfirmDialog
        open={action !== null}
        title={action === 'PROCESSING' ? 'Start processing this order?' : 'Mark this parcel delivered?'}
        description={
          action === 'PROCESSING'
            ? 'The customer will see that their parcel is being prepared. Stock is already reserved and paid.'
            : 'This confirms the customer received the parcel. They will be able to leave a verified review.'
        }
        confirmLabel={action === 'PROCESSING' ? 'Start processing' : 'Mark delivered'}
        tone="primary"
        loading={busy}
        onConfirm={() => action && transition(action)}
        onClose={() => setAction(null)}
      />

      <Modal
        open={shippingOpen}
        onClose={() => setShippingOpen(false)}
        title="Mark as shipped"
        description="Add a tracking reference or carrier URL so the customer can follow the parcel."
        footer={
          <>
            <Button variant="secondary" onClick={() => setShippingOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button loading={busy} onClick={() => transition('SHIPPED')} icon={<Truck className="h-4 w-4" />}>
              Confirm shipment
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <Field label="Tracking reference" hint="At least one of reference or URL is required.">
            <Input
              value={trackingReference}
              onChange={(event) => setTrackingReference(event.target.value)}
              maxLength={120}
              placeholder="MHX-458120"
            />
          </Field>
          <Field label="Carrier tracking URL" hint="Must start with http:// or https://">
            <Input
              value={trackingUrl}
              onChange={(event) => setTrackingUrl(event.target.value)}
              maxLength={500}
              placeholder="https://carrier.example/track/MHX-458120"
            />
          </Field>
          {!trackingReference.trim() && !trackingUrl.trim() ? (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-[11px] font-semibold text-amber-800">
              Enter a tracking reference or a tracking URL to continue.
            </p>
          ) : null}
          {error ? (
            <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">
              {error}
            </p>
          ) : null}
        </div>
      </Modal>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-slate-100 py-1 last:border-0">
      <dt className="text-slate-500">{label}</dt>
      <dd className="text-right font-semibold text-slate-800">{value}</dd>
    </div>
  );
}

export default function SellerOrderDetailPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-4">
          <Skeleton className="h-16 w-full rounded-2xl" />
          <Skeleton className="h-64 w-full rounded-2xl" />
        </div>
      }
    >
      <SellerOrderView />
    </Suspense>
  );
}
