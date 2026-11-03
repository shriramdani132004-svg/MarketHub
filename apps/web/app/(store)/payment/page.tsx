'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  CreditCard,
  RefreshCw,
  XCircle,
} from 'lucide-react';
import { useApiData } from '../../../lib/useApi';
import { useAuth } from '../../../lib/auth';
import { api, errorMessage } from '../../../lib/api';
import type { PaymentDetail } from '../../../lib/types';
import { countdown, formatMoney, statusLabel } from '../../../lib/format';
import {
  Button,
  ButtonLink,
  ConfirmDialog,
  DemoPaymentNotice,
  EmptyState,
  Skeleton,
  StatusBadge,
} from '../../../components/ui';
import { useToast } from '../../../components/ui/toast';

function PaymentView() {
  const params = useSearchParams();
  const id = params.get('id');
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const toast = useToast();
  const payment = useApiData<PaymentDetail>(id ? `/payments/${id}` : null);
  const [confirm, setConfirm] = useState<'SUCCESS' | 'FAILURE' | null>(null);
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<'SUCCESS' | 'FAILURE' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState('');

  const expiresAt = payment.data?.order.reservationExpiresAt ?? null;

  useEffect(() => {
    if (!expiresAt) {
      setTimeLeft('');
      return;
    }
    const tick = () => setTimeLeft(countdown(expiresAt));
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [expiresAt]);

  if (authLoading) {
    return (
      <div className="container-hub py-16">
        <Skeleton className="mx-auto h-64 w-full max-w-xl rounded-2xl" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="container-hub py-16">
        <EmptyState
          icon={<CreditCard className="h-5 w-5" />}
          title="Sign in to complete payment"
          description="Payments are tied to the customer who placed the order."
          action={<ButtonLink href={`/login/?next=${encodeURIComponent(`/payment/?id=${id ?? ''}`)}`}>Sign in</ButtonLink>}
        />
      </div>
    );
  }

  if (!id) {
    return (
      <div className="container-hub py-16">
        <EmptyState icon={<CreditCard className="h-5 w-5" />} title="No payment selected" description="Open a pending payment from checkout." action={<ButtonLink href="/products/">Browse products</ButtonLink>} />
      </div>
    );
  }

  if (payment.loading) {
    return (
      <div className="container-hub py-16">
        <div className="mx-auto max-w-xl space-y-3">
          <Skeleton className="h-8 w-1/2" />
          <Skeleton className="h-40 w-full rounded-2xl" />
          <Skeleton className="h-12 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  if (payment.error || !payment.data) {
    return (
      <div className="container-hub py-16">
        <EmptyState
          icon={<AlertTriangle className="h-5 w-5" />}
          title="Payment not available"
          description={payment.error ?? 'This payment could not be found for your account.'}
          action={<ButtonLink href="/my-orders/">View my orders</ButtonLink>}
        />
      </div>
    );
  }

  const data = payment.data;
  const settled = data.status === 'SUCCEEDED';
  const failed = ['FAILED', 'CANCELLED'].includes(data.status);
  const expired = timeLeft === 'expired';
  const disabled = processing || settled || failed || expired;

  async function simulate(outcome: 'SUCCESS' | 'FAILURE') {
    if (!id) return;
    setProcessing(true);
    setError(null);
    try {
      await api(`/payments/${id}/simulate`, {
        method: 'POST',
        body: { outcome, idempotencyKey: `${id}-${outcome.toLowerCase()}` },
      });
      setResult(outcome);
      setConfirm(null);
      payment.reload();
      if (outcome === 'SUCCESS') {
        toast.success('Demo payment succeeded.');
        router.push(`/order-confirmation/?id=${data.order.id}`);
      } else {
        toast.error('Demo payment failed. Reserved stock was released.');
      }
    } catch (cause) {
      setError(errorMessage(cause));
      setConfirm(null);
    } finally {
      setProcessing(false);
    }
  }

  return (
    <div className="container-hub py-10">
      <div className="mx-auto max-w-3xl">
        <div className="text-center">
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
            <CreditCard className="h-6 w-6" aria-hidden />
          </span>
          <h1 className="mt-3 text-2xl font-extrabold tracking-tight text-navy sm:text-3xl">
            Complete your demo payment
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Order {data.order.orderNumber} · {data.order.sellerOrders.length} seller group
            {data.order.sellerOrders.length === 1 ? '' : 's'}
          </p>
        </div>

        <div className="mt-6 card overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-slate-50/70 px-5 py-4">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-slate-500">Amount due</p>
              <p className="mt-1 text-3xl font-extrabold tracking-tight text-navy">{formatMoney(data.amount)}</p>
              <p className="mt-0.5 text-xs text-slate-500">Reference {data.paymentReference}</p>
            </div>
            <div className="text-right">
              <StatusBadge status={data.status} type="payment" />
              {!settled && !failed ? (
                <p className={`mt-2 inline-flex items-center gap-1 text-xs font-bold ${expired ? 'text-rose-600' : 'text-amber-600'}`}>
                  <Clock className="h-3.5 w-3.5" aria-hidden />
                  {expired ? 'Reservation expired' : `Reserved for ${timeLeft}`}
                </p>
              ) : null}
            </div>
          </div>

          <div className="p-5">
            <DemoPaymentNotice />

            <div className="mt-5 space-y-2.5">
              {data.order.sellerOrders.map((group) => (
                <div key={group.id} className="rounded-xl border border-slate-200">
                  <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/60 px-3 py-2">
                    <p className="text-xs font-bold text-navy">{group.sellerName}</p>
                    <p className="text-xs font-semibold text-slate-600">{formatMoney(group.subtotal)}</p>
                  </div>
                  <ul className="divide-y divide-slate-100">
                    {group.items.map((item) => (
                      <li key={item.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                        <span className="truncate text-slate-700">
                          {item.name} <span className="text-slate-400">× {item.quantity}</span>
                        </span>
                        <span className="font-semibold text-slate-800">{formatMoney(item.lineTotal)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>

            {settled ? (
              <div className="mt-5 rounded-xl border border-teal-200 bg-teal-50 p-4 text-center">
                <CheckCircle2 className="mx-auto h-6 w-6 text-teal-600" aria-hidden />
                <p className="mt-2 text-sm font-bold text-teal-900">Demo payment succeeded</p>
                <p className="mt-1 text-xs text-teal-800">Stock has been deducted and the seller can now fulfil your order.</p>
                <ButtonLink href={`/order/?id=${data.order.id}`} className="mt-3" size="sm">
                  View order
                </ButtonLink>
              </div>
            ) : failed || result === 'FAILURE' ? (
              <div className="mt-5 rounded-xl border border-rose-200 bg-rose-50 p-4 text-center">
                <XCircle className="mx-auto h-6 w-6 text-rose-600" aria-hidden />
                <p className="mt-2 text-sm font-bold text-rose-900">Demo payment failed</p>
                <p className="mt-1 text-xs text-rose-800">
                  Reserved stock was released and the order was cancelled. Nothing was charged.
                </p>
                <div className="mt-3 flex justify-center gap-2">
                  <ButtonLink href="/products/" size="sm">
                    Shop again
                  </ButtonLink>
                  <ButtonLink href={`/order/?id=${data.order.id}`} size="sm" variant="secondary">
                    View order
                  </ButtonLink>
                </div>
              </div>
            ) : expired ? (
              <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-center">
                <Clock className="mx-auto h-6 w-6 text-amber-600" aria-hidden />
                <p className="mt-2 text-sm font-bold text-amber-900">Reservation expired</p>
                <p className="mt-1 text-xs text-amber-800">The hold on stock was released. Place a new order to try again.</p>
                <ButtonLink href="/cart/" size="sm" className="mt-3">
                  Return to cart
                </ButtonLink>
              </div>
            ) : (
              <>
                {error ? (
                  <p className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">
                    {error}
                  </p>
                ) : null}
                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  <Button
                    variant="teal"
                    size="lg"
                    disabled={disabled}
                    onClick={() => setConfirm('SUCCESS')}
                    icon={<CheckCircle2 className="h-4 w-4" />}
                  >
                    Simulate success
                  </Button>
                  <Button
                    variant="secondary"
                    size="lg"
                    disabled={disabled}
                    className="border-rose-200 text-rose-700 hover:bg-rose-50"
                    onClick={() => setConfirm('FAILURE')}
                    icon={<XCircle className="h-4 w-4" />}
                  >
                    Simulate failure
                  </Button>
                </div>
                <p className="mt-3 flex items-center justify-center gap-1.5 text-center text-[11px] text-slate-500">
                  <RefreshCw className="h-3 w-3" aria-hidden />
                  Choose either outcome — you can explore both flows safely.
                </p>
              </>
            )}

            <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4 text-xs text-slate-500">
              <Link href="/my-orders/" className="font-semibold text-indigo-600 hover:text-indigo-800">
                My orders
              </Link>
              <Link href="/cart/" className="font-semibold text-slate-500 hover:text-slate-800">
                Back to cart
              </Link>
            </div>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={confirm !== null}
        title={confirm === 'SUCCESS' ? 'Confirm demo success' : 'Confirm demo failure'}
        description={
          confirm === 'SUCCESS'
            ? 'This simulates a successful payment. Reserved stock will be deducted and the seller can start fulfilment. No real money moves.'
            : 'This simulates a failed payment. The order will be cancelled and every reserved unit released back to the seller.'
        }
        confirmLabel={confirm === 'SUCCESS' ? 'Succeed payment' : 'Fail payment'}
        tone={confirm === 'SUCCESS' ? 'primary' : 'danger'}
        loading={processing}
        onConfirm={() => confirm && simulate(confirm)}
        onClose={() => setConfirm(null)}
      />
    </div>
  );
}

export default function PaymentPage() {
  return (
    <Suspense
      fallback={
        <div className="container-hub py-16">
          <Skeleton className="mx-auto h-64 w-full max-w-xl rounded-2xl" />
        </div>
      }
    >
      <PaymentView />
    </Suspense>
  );
}
