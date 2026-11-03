'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  Bell,
  ChevronRight,
  LayoutDashboard,
  MapPin,
  Package,
  Settings,
  ShieldCheck,
  Store,
  User as UserIcon,
} from 'lucide-react';
import { useAuth } from '../../../lib/auth';
import { useApiData } from '../../../lib/useApi';
import { api, errorMessage } from '../../../lib/api';
import type { Notification, Paginated, User } from '../../../lib/types';
import { formatDate, initials, relativeTime, statusLabel } from '../../../lib/format';
import {
  Badge,
  Button,
  ButtonLink,
  EmptyState,
  Field,
  Input,
  Skeleton,
} from '../../../components/ui';
import { useToast } from '../../../components/ui/toast';

interface NotificationsResponse extends Paginated<Notification> {
  unread: number;
}

export default function AccountPage() {
  const { user, loading: authLoading, setUser } = useAuth();
  const toast = useToast();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<NotificationsResponse | null>(null);
  const [loadingNotifications, setLoadingNotifications] = useState(false);

  const analytics = useApiData<{
    orderCount: number;
    delivered: number;
    pendingPayment: number;
  }>(user?.role === 'CUSTOMER' ? '/analytics/customer' : null);

  useEffect(() => {
    if (!user) return;
    setName(user.name);
    setPhone(user.phone ?? '');
  }, [user]);

  useEffect(() => {
    if (!user) return;
    let active = true;
    setLoadingNotifications(true);
    api<NotificationsResponse>('/notifications?pageSize=8')
      .then((result) => {
        if (active) setNotifications(result);
      })
      .catch(() => undefined)
      .finally(() => {
        if (active) setLoadingNotifications(false);
      });
    return () => {
      active = false;
    };
  }, [user]);

  if (authLoading) {
    return (
      <div className="container-hub space-y-4 py-10">
        <Skeleton className="h-10 w-60" />
        <Skeleton className="h-40 w-full rounded-2xl" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="container-hub py-16">
        <EmptyState
          icon={<UserIcon className="h-5 w-5" />}
          title="Sign in to view your account"
          description="Manage your profile, addresses and notifications in one place."
          action={<ButtonLink href="/login/?next=%2Faccount%2F">Sign in</ButtonLink>}
        />
      </div>
    );
  }

  async function saveProfile(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const result = await api<{ user: User }>('/users/me', {
        method: 'PATCH',
        body: { name: name.trim(), phone: phone.trim() },
      });
      setUser({
        ...user!,
        ...result.user,
        sellerProfile: result.user.sellerProfile ?? user!.sellerProfile,
      });
      toast.success('Profile updated.');
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setSaving(false);
    }
  }

  async function markAllRead() {
    try {
      await api('/notifications/read-all', { method: 'PATCH' });
      setNotifications((current) =>
        current
          ? {
              ...current,
              unread: 0,
              items: current.items.map((item) => ({ ...item, readAt: item.readAt ?? new Date().toISOString() })),
            }
          : current,
      );
      toast.success('All notifications marked as read.');
    } catch (cause) {
      toast.error(errorMessage(cause));
    }
  }

  const dashboardHref =
    user.role === 'ADMIN' ? '/admin/' : user.role === 'SELLER' ? '/seller/' : '/my-orders/';

  return (
    <div className="container-hub py-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-indigo-600">
            Account
          </p>
          <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-navy sm:text-3xl">
            {user.name}
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            {user.email} · joined {formatDate(user.createdAt)}
          </p>
        </div>
        <ButtonLink href={dashboardHref} variant="secondary" icon={<LayoutDashboard className="h-4 w-4" />}>
          {user.role === 'CUSTOMER' ? 'My orders' : 'Dashboard'}
        </ButtonLink>
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-[1fr_1.3fr] lg:items-start">
        <div className="space-y-4">
          <section className="card p-5">
            <div className="flex items-center gap-3">
              <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-navy text-lg font-extrabold text-white">
                {initials(user.name)}
              </span>
              <div className="min-w-0">
                <p className="truncate text-base font-bold text-navy">{user.name}</p>
                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                  <Badge tone={user.role === 'ADMIN' ? 'violet' : user.role === 'SELLER' ? 'teal' : 'indigo'}>
                    {statusLabel(user.role)}
                  </Badge>
                  <Badge tone={user.status === 'ACTIVE' ? 'teal' : 'rose'}>
                    {statusLabel(user.status)}
                  </Badge>
                </div>
              </div>
            </div>

            {user.sellerProfile ? (
              <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50/70 p-3">
                <p className="flex items-center gap-1.5 text-xs font-bold text-navy">
                  <Store className="h-3.5 w-3.5 text-teal-600" aria-hidden />
                  {user.sellerProfile.storeName}
                </p>
                <p className="mt-1 text-[11px] text-slate-500">
                  Store status: {statusLabel(user.sellerProfile.approvalStatus ?? 'PENDING')}
                </p>
                {user.sellerProfile.approvalStatus === 'APPROVED' ? (
                  <Link
                    href={`/search/?seller=${user.sellerProfile.storeSlug}`}
                    className="mt-2 inline-flex items-center gap-1 text-[11px] font-bold text-indigo-600 hover:text-indigo-800"
                  >
                    View public store <ChevronRight className="h-3 w-3" aria-hidden />
                  </Link>
                ) : null}
              </div>
            ) : null}

            <div className="mt-4 grid gap-2">
              {user.role === 'CUSTOMER' ? (
                <>
                  <AccountLink href="/my-orders/" icon={<Package className="h-4 w-4" />} label="My orders" />
                  <AccountLink href="/addresses/" icon={<MapPin className="h-4 w-4" />} label="Saved addresses" />
                </>
              ) : null}
              {user.role === 'SELLER' ? (
                <AccountLink href="/seller/settings/" icon={<Settings className="h-4 w-4" />} label="Store settings" />
              ) : null}
              {user.role === 'ADMIN' ? (
                <AccountLink href="/admin/" icon={<ShieldCheck className="h-4 w-4" />} label="Admin console" />
              ) : null}
              <AccountLink href="/products/" icon={<Store className="h-4 w-4" />} label="Browse marketplace" />
            </div>
          </section>

          <section className="card p-5">
            <h2 className="text-base font-bold text-navy">Profile details</h2>
            <form onSubmit={saveProfile} className="mt-4 space-y-3">
              <Field label="Full name" required>
                <Input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  required
                  minLength={2}
                  maxLength={80}
                />
              </Field>
              <Field label="Email" hint="Email addresses cannot be changed here.">
                <Input value={user.email} disabled readOnly />
              </Field>
              <Field label="Phone" hint="Used on delivery addresses and seller contact.">
                <Input
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  maxLength={24}
                  placeholder="+91 98765 43210"
                />
              </Field>
              {error ? (
                <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">
                  {error}
                </p>
              ) : null}
              <Button type="submit" loading={saving}>
                Save changes
              </Button>
            </form>
          </section>
        </div>

        <div className="space-y-4">
          {user.role === 'CUSTOMER' ? (
            <section className="grid gap-3 sm:grid-cols-3">
              <Metric label="Orders" value={analytics.data?.orderCount ?? '—'} />
              <Metric label="Delivered" value={analytics.data?.delivered ?? '—'} />
              <Metric label="Unpaid" value={analytics.data?.pendingPayment ?? '—'} />
            </section>
          ) : null}

          <section className="card overflow-hidden">
            <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-5 py-4">
              <h2 className="flex items-center gap-2 text-base font-bold text-navy">
                <Bell className="h-4 w-4 text-indigo-600" aria-hidden />
                Notifications
                {notifications && notifications.unread > 0 ? (
                  <span className="rounded-full bg-orange-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
                    {notifications.unread}
                  </span>
                ) : null}
              </h2>
              {notifications && notifications.unread > 0 ? (
                <Button variant="ghost" size="sm" onClick={markAllRead}>
                  Mark all read
                </Button>
              ) : null}
            </div>

            {loadingNotifications ? (
              <div className="space-y-2 p-4">
                {Array.from({ length: 4 }).map((_, index) => (
                  <Skeleton key={index} className="h-14 w-full" />
                ))}
              </div>
            ) : (notifications?.items.length ?? 0) === 0 ? (
              <div className="px-5 py-10 text-center">
                <p className="text-sm font-semibold text-navy">No notifications yet</p>
                <p className="mt-1 text-xs text-slate-500">
                  Order updates, seller decisions and marketplace announcements will appear here.
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {notifications?.items.map((notification) => (
                  <li key={notification.id} className="flex items-start gap-3 px-5 py-3.5">
                    <span
                      className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                        notification.readAt ? 'bg-slate-200' : 'bg-indigo-500'
                      }`}
                      aria-hidden
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-slate-800">{notification.title}</p>
                      <p className="mt-0.5 text-xs leading-5 text-slate-500">{notification.message}</p>
                      <div className="mt-1 flex items-center gap-2">
                        <p className="text-[10px] text-slate-400">{relativeTime(notification.createdAt)}</p>
                        {notification.link ? (
                          <Link
                            href={notification.link}
                            className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800"
                          >
                            Open
                          </Link>
                        ) : null}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

function AccountLink({
  href,
  icon,
  label,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-indigo-200 hover:bg-indigo-50/50 hover:text-indigo-800"
    >
      <span className="flex items-center gap-2.5">
        <span className="text-indigo-600">{icon}</span>
        {label}
      </span>
      <ChevronRight className="h-4 w-4 text-slate-400" aria-hidden />
    </Link>
  );
}

function Metric({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="card p-4">
      <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-extrabold text-navy">{value}</p>
    </div>
  );
}
