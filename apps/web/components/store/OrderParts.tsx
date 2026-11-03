'use client';

import Link from 'next/link';
import {
  CheckCircle2,
  Circle,
  ExternalLink,
  MapPin,
  Package,
  Store,
  Truck,
} from 'lucide-react';
import type { Order, SellerOrder } from '../../lib/types';
import { formatDateTime, formatMoney, statusLabel } from '../../lib/format';
import { ProductImage, StatusBadge } from '../ui';

export function OrderTimeline({ items }: { items: Order['timeline'] }) {
  if (items.length === 0) {
    return <p className="text-sm text-slate-500">No timeline events recorded yet.</p>;
  }
  return (
    <ol className="relative space-y-4 border-l border-slate-200 pl-5">
      {items.map((event, index) => {
        const last = index === items.length - 1;
        return (
          <li key={`${event.status}-${event.at}-${index}`} className="relative">
            <span
              className={`absolute -left-[27px] flex h-4 w-4 items-center justify-center rounded-full ring-4 ring-white ${
                last ? 'bg-indigo-600' : 'bg-slate-300'
              }`}
            >
              {last ? (
                <CheckCircle2 className="h-3 w-3 text-white" aria-hidden />
              ) : (
                <Circle className="h-2 w-2 fill-white text-white" aria-hidden />
              )}
            </span>
            <p className={`text-sm font-semibold ${last ? 'text-navy' : 'text-slate-700'}`}>{event.label}</p>
            <p className="text-[11px] text-slate-400">
              {event.at ? formatDateTime(event.at) : 'Pending'} · {statusLabel(event.status)}
            </p>
          </li>
        );
      })}
    </ol>
  );
}

export function OrderTotals({ order }: { order: Order }) {
  return (
    <dl className="space-y-2 text-sm">
      <div className="flex justify-between">
        <dt className="text-slate-500">Subtotal</dt>
        <dd className="font-semibold text-slate-800">{formatMoney(order.subtotal)}</dd>
      </div>
      <div className="flex justify-between">
        <dt className="text-slate-500">Shipping</dt>
        <dd className="font-semibold text-slate-800">
          {Number(order.shippingTotal) === 0 ? 'Free' : formatMoney(order.shippingTotal)}
        </dd>
      </div>
      {Number(order.discountTotal) > 0 ? (
        <div className="flex justify-between">
          <dt className="text-slate-500">Discount</dt>
          <dd className="font-semibold text-teal-700">−{formatMoney(order.discountTotal)}</dd>
        </div>
      ) : null}
      <div className="flex justify-between border-t border-slate-100 pt-2 text-base">
        <dt className="font-bold text-navy">Total</dt>
        <dd className="font-extrabold text-navy">{formatMoney(order.grandTotal)}</dd>
      </div>
      <p className="text-[10px] text-slate-400">Simulated transaction · INR · no real money charged</p>
    </dl>
  );
}

export function AddressBlock({ address, title }: { address: Record<string, string>; title?: string }) {
  return (
    <div>
      {title ? (
        <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.1em] text-slate-500">
          <MapPin className="h-3.5 w-3.5" aria-hidden />
          {title}
        </p>
      ) : null}
      <p className="text-sm font-bold text-navy">{address.recipientName}</p>
      <p className="mt-1 text-xs leading-5 text-slate-600">
        {address.addressLine1}
        {address.addressLine2 ? `, ${address.addressLine2}` : ''}
        <br />
        {address.city}, {address.state} {address.postalCode}
        <br />
        {address.country} · {address.phone}
      </p>
    </div>
  );
}

export function SellerOrderSection({
  sellerOrder,
  showTracking = true,
}: {
  sellerOrder: SellerOrder;
  showTracking?: boolean;
}) {
  const itemCount = sellerOrder.items.reduce((sum, item) => sum + item.quantity, 0);
  return (
    <section className="card overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 bg-slate-50/60 px-4 py-3">
        <Link
          href={`/search/?seller=${sellerOrder.seller.storeSlug}`}
          className="flex items-center gap-2 text-sm font-bold text-navy hover:text-indigo-700"
        >
          <Store className="h-4 w-4 text-teal-600" aria-hidden />
          {sellerOrder.seller.storeName}
        </Link>
        <div className="flex items-center gap-2">
          <StatusBadge status={sellerOrder.status} />
          <span className="text-xs text-slate-500">
            {itemCount} item{itemCount === 1 ? '' : 's'}
          </span>
        </div>
      </div>

      <ul className="divide-y divide-slate-100">
        {sellerOrder.items.map((item) => (
          <li key={item.id} className="flex items-center gap-3 px-4 py-3">
            <span className="h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-white">
              <ProductImage src={item.product?.imageUrl} alt={item.name} />
            </span>
            <div className="min-w-0 flex-1">
              <Link
                href={`/product/?id=${item.productId}`}
                className="line-clamp-1 text-sm font-semibold text-slate-800 hover:text-indigo-700"
              >
                {item.name}
              </Link>
              <p className="text-[11px] text-slate-500">
                {item.quantity} × {formatMoney(item.unitPrice)} · SKU {item.sku}
              </p>
            </div>
            <p className="text-sm font-bold text-navy">{formatMoney(item.lineTotal)}</p>
          </li>
        ))}
      </ul>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 px-4 py-3 text-xs">
        <div className="text-slate-500">
          Subtotal {formatMoney(sellerOrder.subtotal)} · Shipping{' '}
          {Number(sellerOrder.shippingAmount) === 0 ? 'Free' : formatMoney(sellerOrder.shippingAmount)}
        </div>
        {showTracking && sellerOrder.trackingReference ? (
          <div className="flex items-center gap-2 font-semibold text-indigo-700">
            <Truck className="h-4 w-4" aria-hidden />
            {sellerOrder.trackingUrl ? (
              <a
                href={sellerOrder.trackingUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 hover:underline"
              >
                {sellerOrder.trackingReference}
                <ExternalLink className="h-3 w-3" aria-hidden />
              </a>
            ) : (
              <span>{sellerOrder.trackingReference}</span>
            )}
          </div>
        ) : null}
      </div>
    </section>
  );
}

export function OrderHeader({ order }: { order: Order }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-indigo-600">Order</p>
        <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-navy sm:text-3xl">
          {order.orderNumber}
        </h1>
        <p className="mt-1.5 text-sm text-slate-500">Placed {formatDateTime(order.createdAt)}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge status={order.orderStatus} />
        <StatusBadge status={order.paymentStatus} type="payment" />
      </div>
    </div>
  );
}

export function OrderMeta({ order }: { order: Order }) {
  return (
    <div className="grid gap-3 text-sm sm:grid-cols-3">
      <div className="rounded-xl border border-slate-200 bg-white p-3">
        <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.1em] text-slate-500">
          <Package className="h-3.5 w-3.5" aria-hidden />
          Seller groups
        </p>
        <p className="mt-1 text-lg font-extrabold text-navy">{order.sellerOrders.length}</p>
      </div>
      <div className="rounded-xl border border-slate-200 bg-white p-3">
        <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-slate-500">Payment reference</p>
        <p className="mt-1 truncate text-sm font-bold text-navy">
          {order.payment?.paymentReference ?? '—'}
        </p>
      </div>
      <div className="rounded-xl border border-slate-200 bg-white p-3">
        <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-slate-500">Paid (simulated)</p>
        <p className="mt-1 text-sm font-bold text-navy">
          {order.paidAt ? formatDateTime(order.paidAt) : 'Not paid'}
        </p>
      </div>
    </div>
  );
}
