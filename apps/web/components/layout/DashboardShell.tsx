'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import {
  BarChart3,
  Boxes,
  ChevronLeft,
  ClipboardList,
  CreditCard,
  FolderTree,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  PlusCircle,
  Settings,
  ShieldCheck,
  ShoppingBag,
  Store,
  Users,
  Warehouse,
  X,
} from 'lucide-react';
import { useAuth } from '../../lib/auth';
import { cn } from '../../lib/utils';
import { Logo } from '../brand/Logo';
import { Spinner } from '../ui';
import { useToast } from '../ui/toast';

type NavItem = { href: string; label: string; icon: ReactNode; exact?: boolean };

const SELLER_NAV: NavItem[] = [
  { href: '/seller/', label: 'Overview', icon: <LayoutDashboard className="h-[18px] w-[18px]" />, exact: true },
  { href: '/seller/products/', label: 'Products', icon: <Package className="h-[18px] w-[18px]" /> },
  { href: '/seller/products/new/', label: 'New product', icon: <PlusCircle className="h-[18px] w-[18px]" /> },
  { href: '/seller/inventory/', label: 'Inventory', icon: <Boxes className="h-[18px] w-[18px]" /> },
  { href: '/seller/orders/', label: 'Orders', icon: <ClipboardList className="h-[18px] w-[18px]" /> },
  { href: '/seller/analytics/', label: 'Analytics', icon: <BarChart3 className="h-[18px] w-[18px]" /> },
  { href: '/seller/settings/', label: 'Store settings', icon: <Settings className="h-[18px] w-[18px]" /> },
];

const ADMIN_NAV: NavItem[] = [
  { href: '/admin/', label: 'Overview', icon: <LayoutDashboard className="h-[18px] w-[18px]" />, exact: true },
  { href: '/admin/sellers/', label: 'Sellers', icon: <Store className="h-[18px] w-[18px]" /> },
  { href: '/admin/products/', label: 'Products', icon: <Package className="h-[18px] w-[18px]" /> },
  { href: '/admin/categories/', label: 'Categories', icon: <FolderTree className="h-[18px] w-[18px]" /> },
  { href: '/admin/orders/', label: 'Orders', icon: <ClipboardList className="h-[18px] w-[18px]" /> },
  { href: '/admin/payments/', label: 'Payments', icon: <CreditCard className="h-[18px] w-[18px]" /> },
  { href: '/admin/inventory/', label: 'Inventory', icon: <Warehouse className="h-[18px] w-[18px]" /> },
  { href: '/admin/users/', label: 'Users', icon: <Users className="h-[18px] w-[18px]" /> },
];

export function DashboardShell({
  role,
  children,
}: {
  role: 'SELLER' | 'ADMIN';
  children: ReactNode;
}) {
  const { user, loading, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      const next = typeof window !== 'undefined' ? window.location.pathname : '';
      router.replace(`/login/?next=${encodeURIComponent(next)}`);
      return;
    }
    if (user.role !== role && user.role !== 'ADMIN') {
      router.replace('/account/');
    }
  }, [loading, user, role, router]);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-page">
        <Spinner />
      </div>
    );
  }

  if (!user) return null;

  const isAdmin = role === 'ADMIN';
  const nav = isAdmin ? ADMIN_NAV : SELLER_NAV;
  const sellerApproval = user.sellerProfile?.approvalStatus;

  async function handleLogout() {
    await logout();
    toast.success('Signed out.');
    router.push('/');
  }

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="flex h-16 items-center justify-between border-b border-white/10 px-4">
        <Logo
          href={isAdmin ? '/admin/' : '/seller/'}
          subtitle={isAdmin ? 'Operations console' : 'Seller workspace'}
        />
        <button
          type="button"
          className="rounded-lg p-1.5 text-slate-300 hover:bg-white/10 lg:hidden"
          onClick={() => setOpen(false)}
          aria-label="Close navigation"
        >
          <X className="h-5 w-5" aria-hidden />
        </button>
      </div>

      <div className="px-4 pt-5">
        <div className="rounded-xl border border-white/10 bg-white/5 p-3">
          <div className="flex items-center gap-2.5">
            <span
              className={cn(
                'flex h-9 w-9 items-center justify-center rounded-lg text-white',
                isAdmin ? 'bg-violet-600' : 'bg-teal-600',
              )}
            >
              {isAdmin ? <ShieldCheck className="h-4 w-4" /> : <Store className="h-4 w-4" />}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-white">
                {isAdmin ? 'Marketplace admin' : user.sellerProfile?.storeName ?? 'Your store'}
              </p>
              <p className="truncate text-[11px] text-slate-400">{user.email}</p>
            </div>
          </div>
          {!isAdmin && sellerApproval ? (
            <p
              className={cn(
                'mt-2 rounded-md px-2 py-1 text-[10px] font-bold uppercase tracking-wide',
                sellerApproval === 'APPROVED'
                  ? 'bg-teal-500/15 text-teal-300'
                  : sellerApproval === 'PENDING'
                    ? 'bg-amber-500/15 text-amber-300'
                    : 'bg-rose-500/15 text-rose-300',
              )}
            >
              {sellerApproval === 'APPROVED'
                ? 'Store approved'
                : sellerApproval === 'PENDING'
                  ? 'Awaiting approval'
                  : sellerApproval.toLowerCase()}
            </p>
          ) : null}
        </div>
      </div>

      <nav className="mt-5 flex-1 space-y-1 overflow-y-auto px-3 pb-4" aria-label="Dashboard">
        {nav.map((item) => {
          const active = item.exact
            ? pathname === item.href
            : pathname === item.href || pathname?.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold transition',
                active
                  ? 'bg-white/10 text-white shadow-inner'
                  : 'text-slate-300 hover:bg-white/5 hover:text-white',
              )}
              aria-current={active ? 'page' : undefined}
            >
              <span className={active ? 'text-indigo-300' : 'text-slate-400'}>{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-white/10 p-3">
        <Link
          href="/"
          className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-semibold text-slate-300 transition hover:bg-white/5 hover:text-white"
        >
          <ShoppingBag className="h-[18px] w-[18px] text-slate-400" aria-hidden />
          View storefront
        </Link>
        <button
          type="button"
          onClick={handleLogout}
          className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-semibold text-rose-300 transition hover:bg-rose-500/10"
        >
          <LogOut className="h-[18px] w-[18px]" aria-hidden />
          Sign out
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-page">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 bg-navy lg:block">{sidebar}</aside>

      {open ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-navy/50 backdrop-blur-sm"
            onClick={() => setOpen(false)}
            role="presentation"
          />
          <aside className="relative h-full w-72 max-w-[85%] bg-navy shadow-lift">{sidebar}</aside>
        </div>
      ) : null}

      <div className="lg:pl-64">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-slate-200 bg-white/95 px-4 backdrop-blur sm:px-6">
          <button
            type="button"
            className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden"
            onClick={() => setOpen(true)}
            aria-label="Open navigation"
          >
            <Menu className="h-5 w-5" aria-hidden />
          </button>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-navy">
              {isAdmin ? 'Marketplace operations' : user.sellerProfile?.storeName ?? 'Seller workspace'}
            </p>
            <p className="text-[11px] text-slate-500">
              {isAdmin ? 'Centralised marketplace control' : 'Manage products, inventory and orders'}
            </p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Link
              href="/"
              className="hidden items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 transition hover:bg-slate-50 sm:inline-flex"
            >
              <ChevronLeft className="h-3.5 w-3.5" aria-hidden />
              Storefront
            </Link>
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-navy text-xs font-bold text-white">
              {isAdmin ? 'AD' : (user.sellerProfile?.storeName?.[0] ?? user.name[0] ?? 'S').toUpperCase()}
            </span>
          </div>
        </header>
        <main className="px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
