'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense, useMemo, useState } from 'react';
import {
  RefreshCw,
  Search,
  ShieldCheck,
  ShieldOff,
  UserCheck,
  Users,
} from 'lucide-react';
import { useApiData } from '../../../lib/useApi';
import { useAuth } from '../../../lib/auth';
import { api, errorMessage } from '../../../lib/api';
import type { AdminUser, Paginated } from '../../../lib/types';
import { formatDate, initials, statusLabel } from '../../../lib/format';
import {
  Badge,
  Button,
  EmptyState,
  ErrorState,
  Field,
  Input,
  Modal,
  Pagination,
  Select,
  Skeleton,
  StatusBadge,
  Textarea,
} from '../../../components/ui';
import { useToast } from '../../../components/ui/toast';

const ROLES = [
  { value: '', label: 'All roles' },
  { value: 'CUSTOMER', label: 'Customers' },
  { value: 'SELLER', label: 'Sellers' },
  { value: 'ADMIN', label: 'Administrators' },
];

const STATUSES = [
  { value: '', label: 'All account states' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'SUSPENDED', label: 'Suspended' },
];

function UsersView() {
  const params = useSearchParams();
  const toast = useToast();
  const { user: me } = useAuth();
  const q = params.get('q') ?? '';
  const role = params.get('role') ?? '';
  const status = params.get('status') ?? '';
  const page = Math.max(1, Number(params.get('page') ?? '1') || 1);
  const [search, setSearch] = useState(q);
  const [target, setTarget] = useState<{ user: AdminUser; next: 'ACTIVE' | 'SUSPENDED' } | null>(
    null,
  );
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const path = useMemo(() => {
    const searchParams = new URLSearchParams();
    searchParams.set('page', String(page));
    searchParams.set('pageSize', '15');
    if (q) searchParams.set('q', q);
    if (role) searchParams.set('role', role);
    if (status) searchParams.set('status', status);
    return `/admin/users?${searchParams.toString()}`;
  }, [page, q, role, status]);

  const users = useApiData<Paginated<AdminUser>>(path);

  function navigate(next: Record<string, string | null>, resetPage = true) {
    const searchParams = new URLSearchParams(params.toString());
    if (resetPage) searchParams.delete('page');
    for (const [key, value] of Object.entries(next)) {
      if (!value) searchParams.delete(key);
      else searchParams.set(key, value);
    }
    const query = searchParams.toString();
    window.location.href = query ? `/admin/users/?${query}` : '/admin/users/';
  }

  async function setStatus() {
    if (!target) return;
    setBusy(true);
    setError(null);
    try {
      await api(`/admin/users/${target.user.id}/status`, {
        method: 'PATCH',
        body: { status: target.next, reason: reason.trim() || undefined },
      });
      toast.success(
        target.next === 'SUSPENDED'
          ? `${target.user.name} suspended and sessions revoked.`
          : `${target.user.name} reactivated.`,
      );
      setTarget(null);
      setReason('');
      users.reload();
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-violet-700">Access</p>
          <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-navy">Users</h1>
          <p className="mt-1 text-sm text-slate-500">
            Suspend or reactivate customer and seller accounts. Administrator accounts are protected.
          </p>
        </div>
        <Button
          size="sm"
          variant="ghost"
          icon={<RefreshCw className="h-4 w-4" />}
          onClick={() => users.reload()}
        >
          Refresh
        </Button>
      </div>

      <div className="card flex flex-col gap-2 p-3.5 sm:flex-row sm:items-center">
        <form
          className="relative flex-1"
          onSubmit={(event) => {
            event.preventDefault();
            navigate({ q: search.trim() || null });
          }}
          role="search"
        >
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search name or email"
            className="pl-9"
            aria-label="Search users"
          />
        </form>
        <Select
          value={role}
          onChange={(event) => navigate({ role: event.target.value || null })}
          className="sm:w-40"
          aria-label="Filter by role"
        >
          {ROLES.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
        <Select
          value={status}
          onChange={(event) => navigate({ status: event.target.value || null })}
          className="sm:w-44"
          aria-label="Filter by account status"
        >
          {STATUSES.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
      </div>

      {users.error ? (
        <ErrorState message={users.error} onRetry={users.reload} />
      ) : users.loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, index) => (
            <Skeleton key={index} className="h-16 w-full rounded-2xl" />
          ))}
        </div>
      ) : (users.data?.items.length ?? 0) === 0 ? (
        <EmptyState
          icon={<Users className="h-5 w-5" />}
          title={q || role || status ? 'No users match these filters' : 'No users yet'}
          description="Customer and seller accounts appear here as soon as they register."
          action={
            q || role || status ? (
              <Button variant="secondary" onClick={() => navigate({ q: null, role: null, status: null })}>
                Clear filters
              </Button>
            ) : null
          }
        />
      ) : (
        <>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Role</th>
                  <th>Account</th>
                  <th>Activity</th>
                  <th>Joined</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.data?.items.map((user) => {
                  const isSelf = me?.id === user.id;
                  const protectedAccount = user.role === 'ADMIN' || isSelf;
                  return (
                    <tr key={user.id}>
                      <td>
                        <div className="flex items-center gap-3">
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-navy text-[11px] font-bold text-white">
                            {initials(user.name)}
                          </span>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-bold text-navy">
                              {user.name}
                              {isSelf ? (
                                <span className="ml-1 text-[10px] font-bold text-indigo-500">
                                  (you)
                                </span>
                              ) : null}
                            </p>
                            <p className="truncate text-[11px] text-slate-500">{user.email}</p>
                            {user.phone ? (
                              <p className="text-[10px] text-slate-400">{user.phone}</p>
                            ) : null}
                          </div>
                        </div>
                      </td>
                      <td>
                        <Badge
                          tone={
                            user.role === 'ADMIN'
                              ? 'violet'
                              : user.role === 'SELLER'
                                ? 'teal'
                                : 'indigo'
                          }
                        >
                          {user.role === 'ADMIN' ? (
                            <ShieldCheck className="h-3 w-3" aria-hidden />
                          ) : null}
                          {statusLabel(user.role)}
                        </Badge>
                        {user.sellerProfile ? (
                          <p className="mt-1 text-[11px] text-slate-500">
                            {user.sellerProfile.storeName}
                          </p>
                        ) : null}
                      </td>
                      <td>
                        <StatusBadge status={user.status} />
                      </td>
                      <td>
                        <p className="text-xs text-slate-700">
                          {user.orderCount} order{user.orderCount === 1 ? '' : 's'}
                        </p>
                        {user.sellerProfile ? (
                          <p className="text-[10px] text-slate-400">
                            Store {statusLabel(user.sellerProfile.approvalStatus)}
                          </p>
                        ) : null}
                      </td>
                      <td>
                        <p className="text-xs text-slate-600">{formatDate(user.createdAt)}</p>
                      </td>
                      <td className="text-right">
                        {protectedAccount ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-400">
                            <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
                            Protected
                          </span>
                        ) : user.status === 'ACTIVE' ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-rose-600 hover:bg-rose-50"
                            icon={<ShieldOff className="h-3.5 w-3.5" />}
                            onClick={() => {
                              setTarget({ user, next: 'SUSPENDED' });
                              setReason('');
                              setError(null);
                            }}
                          >
                            Suspend
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-teal-700 hover:bg-teal-50"
                            icon={<UserCheck className="h-3.5 w-3.5" />}
                            onClick={() => {
                              setTarget({ user, next: 'ACTIVE' });
                              setReason('');
                              setError(null);
                            }}
                          >
                            Reactivate
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <Pagination
            page={users.data?.meta.page ?? page}
            totalPages={users.data?.meta.totalPages ?? 1}
            total={users.data?.meta.total}
            onChange={(next) => navigate({ page: String(next) }, false)}
          />
        </>
      )}

      <Modal
        open={target !== null}
        onClose={() => {
          if (busy) return;
          setTarget(null);
          setReason('');
          setError(null);
        }}
        title={
          target?.next === 'SUSPENDED'
            ? 'Suspend this account?'
            : 'Reactivate this account?'
        }
        description={target?.user.email}
        footer={
          <>
            <Button
              variant="secondary"
              disabled={busy}
              onClick={() => {
                setTarget(null);
                setReason('');
                setError(null);
              }}
            >
              Cancel
            </Button>
            <Button
              variant={target?.next === 'SUSPENDED' ? 'danger' : 'teal'}
              loading={busy}
              onClick={setStatus}
            >
              {target?.next === 'SUSPENDED' ? 'Suspend account' : 'Reactivate account'}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <p className="text-sm leading-6 text-slate-600">
            {target?.next === 'SUSPENDED'
              ? 'The user is signed out immediately: every active session is revoked. They cannot sign in again until reactivated. Existing order history is preserved.'
              : 'The account can sign in again. No products, stores or orders are modified by reactivation.'}
          </p>
          {target?.next === 'SUSPENDED' ? (
            <Field label="Reason (optional)" hint="For your operational record.">
              <Textarea
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                maxLength={500}
                placeholder="Policy violation under investigation"
              />
            </Field>
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

export default function AdminUsersPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-3">
          <Skeleton className="h-16 w-full rounded-2xl" />
          <Skeleton className="h-64 w-full rounded-2xl" />
        </div>
      }
    >
      <UsersView />
    </Suspense>
  );
}
