'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { CheckCircle2, Clock, FileText } from 'lucide-react';
import { useApiData } from '../../../lib/useApi';
import { useAuth } from '../../../lib/auth';
import type { Order } from '../../../lib/types';
import {
  ButtonLink,
  EmptyState,
  Skeleton,
} from '../../../components/ui';
import {
  AddressBlock,
  OrderHeader,
  OrderMeta,
  OrderTimeline,
  OrderTotals,
  SellerOrderSection,
} from '../../../components/store/OrderParts';

function ConfirmationView() {
  const params = useSearchParams();
  const id = params.get('id');
  const { user, loading } = useAuth();
  const order = useApiData<Order>(user && id ? `/orders/${id}` : null);

  if (loading) {
    return (
      <div className="container-hub py-12">
        <Skeleton className="h-8 w-1/2" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="container-hub py-16">
        <EmptyState
          icon={<FileText className="h-5 w-5" />}
          title="Sign in to view this confirmation"
          action={<ButtonLink href={`/login/?next=${encodeURIComponent(`/order-confirmation/?id=${id ?? ''}`)}`}>Sign in</ButtonLink>}
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
          action={<ButtonLink href="/my-orders/">View my orders</ButtonLink>}
        />
      </div>
    );
  }

  if (order.loading) {
    return (
      <div className="container-hub space-y-4 py-12">
        <Skeleton className="h-10 w-2/3" />
        <Skeleton className="h-32 w-full rounded-2xl" />
        <Skeleton className="h-32 w-full rounded-2xl" />
      </div>
    );
  }

  if (order.error || !order.data) {
    return (
      <div className="container-hub py-16">
        <EmptyState
          icon={<FileText className="h-5 w-5" />}
          title="Order not found"
          description={order.error ?? 'We could not load this order for your account.'}
          action={<ButtonLink href="/my-orders/">My orders</ButtonLink>}
        />
      </div>
    );
  }

  const data = order.data;
  const paid = data.paymentStatus === 'SUCCEEDED';

  return (
    <div className="container-hub py-10">
      <div className="mx-auto max-w-4xl">
        <div className="rounded-2xl border border-teal-200 bg-gradient-to-br from-teal-50 to-white p-6 text-center">
          {paid ? (
            <>
              <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-teal-100">
                <CheckCircle2 className="h-7 w-7 text-teal-600" aria-hidden />
              </span>
              <h1 className="mt-3 text-2xl font-extrabold tracking-tight text-navy">
                Thank you — your demo payment succeeded
              </h1>
              <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-slate-600">
                This was a simulated transaction. No real money was charged. Your sellers have been
                notified and can now prepare their parcels.
              </p>
            </>
          ) : data.paymentStatus === 'PENDING' ? (
            <>
              <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-amber-100">
                <Clock className="h-7 w-7 text-amber-600" aria-hidden />
              </span>
              <h1 className="mt-3 text-2xl font-extrabold tracking-tight text-navy">Order created</h1>
              <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-slate-600">
                Stock is reserved but the demo payment is still pending. Complete it before the
                reservation expires.
              </p>
              {data.payment ? (
                <ButtonLink href={`/payment/?id=${data.payment.id}`} className="mt-4">
                  Complete demo payment
                </ButtonLink>
              ) : null}
            </>
          ) : (
            <>
              <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-slate-100">
                <FileText className="h-7 w-7 text-slate-600" aria-hidden />
              </span>
              <h1 className="mt-3 text-2xl font-extrabold tracking-tight text-navy">Order confirmed</h1>
              <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-slate-600">
                This order is {data.orderStatus.toLowerCase().replace(/_/g, ' ')}.
              </p>
            </>
          )}
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <ButtonLink href={`/order/?id=${data.id}`}>Track this order</ButtonLink>
            <ButtonLink href="/products/" variant="secondary">
              Continue shopping
            </ButtonLink>
          </div>
        </div>

        <div className="mt-6 space-y-4">
          <div className="card p-5">
            <OrderHeader order={data} />
            <div className="mt-4">
              <OrderMeta order={data} />
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
            <div className="space-y-3">
              {data.sellerOrders.map((sellerOrder) => (
                <SellerOrderSection key={sellerOrder.id} sellerOrder={sellerOrder} />
              ))}
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
              </div>
              <div className="card p-5">
                <h2 className="mb-3 text-sm font-bold text-navy">Timeline</h2>
                <OrderTimeline items={data.timeline} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function OrderConfirmationPage() {
  return (
    <Suspense
      fallback={
        <div className="container-hub py-12">
          <Skeleton className="h-40 w-full rounded-2xl" />
        </div>
      }
    >
      <ConfirmationView />
    </Suspense>
  );
}
