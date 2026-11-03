'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import {
  FileText,
  MessageSquarePlus,
  Star,
  XCircle,
} from 'lucide-react';
import { useAuth } from '../../../lib/auth';
import { useApiData } from '../../../lib/useApi';
import { api, errorMessage } from '../../../lib/api';
import type { Order, OrderItem } from '../../../lib/types';
import { formatDateTime, formatMoney } from '../../../lib/format';
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
  Textarea,
} from '../../../components/ui';
import { useToast } from '../../../components/ui/toast';
import {
  AddressBlock,
  OrderHeader,
  OrderMeta,
  OrderTimeline,
  OrderTotals,
  SellerOrderSection,
} from '../../../components/store/OrderParts';

function OrderView() {
  const params = useSearchParams();
  const id = params.get('id');
  const { user, loading: authLoading } = useAuth();
  const toast = useToast();
  const order = useApiData<Order>(user && id ? `/orders/${id}` : null);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [reviewItem, setReviewItem] = useState<OrderItem | null>(null);

  if (authLoading) {
    return (
      <div className="container-hub space-y-4 py-10">
        <Skeleton className="h-10 w-1/2" />
        <Skeleton className="h-40 w-full rounded-2xl" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="container-hub py-16">
        <EmptyState
          icon={<FileText className="h-5 w-5" />}
          title="Sign in to view this order"
          action={
            <ButtonLink
              href={`/login/?next=${encodeURIComponent(`/order/?id=${id ?? ''}`)}`}
            >
              Sign in
            </ButtonLink>
          }
        />
      </div>
    );
  }

  if (!id) {
    return (
      <div className="container-hub py-16">
        <EmptyState
          icon={<FileText className="h-5 w-5" />}
          title="No order selected"
          description="Open an order from your order history."
          action={<ButtonLink href="/my-orders/">My orders</ButtonLink>}
        />
      </div>
    );
  }

  if (order.loading) {
    return (
      <div className="container-hub space-y-4 py-10">
        <Skeleton className="h-10 w-1/2" />
        <Skeleton className="h-24 w-full rounded-2xl" />
        <Skeleton className="h-40 w-full rounded-2xl" />
      </div>
    );
  }

  if (order.error || !order.data) {
    return (
      <div className="container-hub py-16">
        <ErrorState
          message={order.error ?? 'This order could not be found.'}
          onRetry={order.reload}
        />
        <div className="mt-6 text-center">
          <ButtonLink href="/my-orders/" variant="secondary">
            Back to my orders
          </ButtonLink>
        </div>
      </div>
    );
  }

  const data = order.data;

  async function cancelOrder() {
    setCancelling(true);
    try {
      await api(`/orders/${data.id}/cancel`, { method: 'POST' });
      toast.success('Order cancelled. Reserved stock was released.');
      setCancelOpen(false);
      order.reload();
    } catch (cause) {
      toast.error(errorMessage(cause));
    } finally {
      setCancelling(false);
    }
  }

  const reviewable = data.sellerOrders
    .flatMap((sellerOrder) => sellerOrder.items)
    .filter((item) => item.canReview && !item.myReview);

  return (
    <div className="container-hub py-8">
      <nav className="mb-4 flex items-center gap-1.5 text-xs text-slate-500" aria-label="Breadcrumb">
        <Link href="/my-orders/" className="hover:text-indigo-700">
          My orders
        </Link>
        <span aria-hidden>/</span>
        <span className="font-semibold text-slate-700">{data.orderNumber}</span>
      </nav>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <OrderHeader order={data} />
        <div className="flex flex-wrap gap-2">
          {data.canCancel ? (
            <Button
              variant="secondary"
              size="sm"
              className="border-rose-200 text-rose-700 hover:bg-rose-50"
              onClick={() => setCancelOpen(true)}
            >
              Cancel order
            </Button>
          ) : null}
          <ButtonLink href={`/order-tracking/?id=${data.id}`} size="sm" variant="secondary">
            Track order
          </ButtonLink>
          {data.payment ? (
            <ButtonLink href={`/payment/?id=${data.payment.id}`} size="sm">
              Payment
            </ButtonLink>
          ) : null}
        </div>
      </div>

      <div className="mt-5">
        <OrderMeta order={data} />
      </div>

      {data.orderStatus === 'PENDING_PAYMENT' ? (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <p>
            This order is awaiting demo payment. Reserved stock expires{' '}
            {data.reservationExpiresAt ? formatDateTime(data.reservationExpiresAt) : 'soon'}.
          </p>
          {data.payment ? (
            <ButtonLink href={`/payment/?id=${data.payment.id}`} size="sm">
              Complete payment
            </ButtonLink>
          ) : null}
        </div>
      ) : null}

      {data.orderStatus === 'CANCELLED' ? (
        <div className="mt-4 flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
          <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" aria-hidden />
          <div>
            <p className="font-semibold">
              Cancelled {data.cancelledAt ? formatDateTime(data.cancelledAt) : ''}
            </p>
            {data.cancellationReason ? (
              <p className="mt-0.5 text-xs text-slate-600">{data.cancellationReason}</p>
            ) : null}
            <p className="mt-1 text-xs text-slate-500">
              Any reserved stock was released and a simulated refund recorded if payment had
              succeeded.
            </p>
          </div>
        </div>
      ) : null}

      <div className="mt-6 grid gap-5 lg:grid-cols-[1.5fr_1fr] lg:items-start">
        <div className="space-y-4">
          {data.sellerOrders.map((sellerOrder) => (
            <SellerOrderSection key={sellerOrder.id} sellerOrder={sellerOrder} />
          ))}

          {reviewable.length > 0 ? (
            <section className="card p-5">
              <h2 className="flex items-center gap-2 text-base font-bold text-navy">
                <MessageSquarePlus className="h-4 w-4 text-indigo-600" aria-hidden />
                Review your delivered items
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                Verified reviews can only be left once per delivered item.
              </p>
              <ul className="mt-3 divide-y divide-slate-100">
                {reviewable.map((item) => (
                  <li key={item.id} className="flex items-center justify-between gap-3 py-2.5">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-800">{item.name}</p>
                      <p className="text-[11px] text-slate-500">SKU {item.sku}</p>
                    </div>
                    <Button size="sm" variant="secondary" onClick={() => setReviewItem(item)}>
                      Write review
                    </Button>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>

        <div className="space-y-4">
          <div className="card p-5">
            <h2 className="text-sm font-bold text-navy">Order total</h2>
            <div className="mt-3">
              <OrderTotals order={data} />
            </div>
          </div>

          <div className="card p-5">
            <AddressBlock address={data.shippingAddress} title="Delivery address" />
            <div className="mt-4 border-t border-slate-100 pt-4">
              <AddressBlock address={data.billingAddress} title="Billing address" />
            </div>
          </div>

          <div className="card p-5">
            <h2 className="mb-3 text-sm font-bold text-navy">Timeline</h2>
            <OrderTimeline items={data.timeline} />
          </div>

          {data.payment ? (
            <div className="card p-5">
              <h2 className="text-sm font-bold text-navy">Payment events</h2>
              <p className="mt-1 text-[11px] text-slate-500">
                Immutable simulated event log for {data.payment.paymentReference}.
              </p>
              <ul className="mt-3 space-y-2">
                {data.payment.events.map((event) => (
                  <li
                    key={event.id}
                    className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2 text-xs"
                  >
                    <span className="font-semibold text-slate-700">
                      {event.eventType.replace(/_/g, ' ')}
                    </span>
                    <span className="text-slate-400">{formatDateTime(event.createdAt)}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </div>

      <ConfirmDialog
        open={cancelOpen}
        title="Cancel this order?"
        description="Every seller group that has not shipped will be cancelled, reserved stock released, and any captured demo payment refunded. This cannot be undone."
        confirmLabel="Cancel order"
        loading={cancelling}
        onConfirm={cancelOrder}
        onClose={() => setCancelOpen(false)}
      />

      {reviewItem ? (
        <ReviewModal
          item={reviewItem}
          productId={reviewItem.productId}
          onClose={() => setReviewItem(null)}
          onDone={() => {
            setReviewItem(null);
            order.reload();
          }}
        />
      ) : null}
    </div>
  );
}

function ReviewModal({
  item,
  productId,
  onClose,
  onDone,
}: {
  item: OrderItem;
  productId: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const toast = useToast();
  const [rating, setRating] = useState(5);
  const [title, setTitle] = useState('');
  const [comment, setComment] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await api(`/products/${productId}/reviews`, {
        method: 'POST',
        body: {
          orderItemId: item.id,
          rating,
          title: title.trim() || undefined,
          comment: comment.trim() || undefined,
        },
      });
      toast.success('Thanks — your verified review is live.');
      onDone();
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Write a verified review"
      description={item.name}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={() => undefined} className="hidden" aria-hidden />
          <Button
            loading={saving}
            onClick={() => {
              const form = document.getElementById('review-form') as HTMLFormElement | null;
              form?.requestSubmit();
            }}
          >
            Publish review
          </Button>
        </>
      }
    >
      <form id="review-form" onSubmit={submit} className="space-y-4">
        <div>
          <p className="label">Rating</p>
          <div className="flex items-center gap-1.5">
            {Array.from({ length: 5 }).map((_, index) => {
              const value = index + 1;
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => setRating(value)}
                  className="rounded-md p-0.5"
                  aria-label={`${value} star${value === 1 ? '' : 's'}`}
                  aria-pressed={rating === value}
                >
                  <Star
                    className={
                      value <= rating
                        ? 'h-7 w-7 fill-amber-400 text-amber-400'
                        : 'h-7 w-7 text-slate-300'
                    }
                    aria-hidden
                  />
                </button>
              );
            })}
            <span className="ml-2 text-sm font-bold text-navy">{rating}/5</span>
          </div>
        </div>
        <Field label="Title" hint="Optional, up to 120 characters">
          <Input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            maxLength={120}
            placeholder="Excellent build quality"
          />
        </Field>
        <Field label="Comment" hint="Optional, up to 2000 characters">
          <Textarea
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            maxLength={2000}
            placeholder="Share how the product performed for you."
          />
        </Field>
        {error ? (
          <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">
            {error}
          </p>
        ) : null}
      </form>
    </Modal>
  );
}

export default function OrderPage() {
  return (
    <Suspense
      fallback={
        <div className="container-hub py-10">
          <Skeleton className="h-40 w-full rounded-2xl" />
        </div>
      }
    >
      <OrderView />
    </Suspense>
  );
}
