'use client';

import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import {
  ChevronDown,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  Search,
  ShoppingBag,
  Store,
  User as UserIcon,
  X,
} from 'lucide-react';
import { useAuth } from '../../lib/auth';
import { useCart } from '../../lib/cart';
import { initials } from '../../lib/format';
import { cn } from '../../lib/utils';
import { Logo } from '../brand/Logo';
import { useToast } from '../ui/toast';

const NAV_LINKS = [
  { href: '/products/', label: 'Shop all' },
  { href: '/category/?slug=electronics', label: 'Electronics' },
  { href: '/category/?slug=home-living', label: 'Home & Living' },
  { href: '/category/?slug=fashion', label: 'Fashion' },
];

export function SiteHeader() {
  const router = useRouter();
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const { cart } = useCart();
  const toast = useToast();
  const [query, setQuery] = useState('');
  const [mobileOpen, setMobileOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMobileOpen(false);
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!menuOpen) return;
    const onClick = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [menuOpen]);

  const submitSearch = (event: React.FormEvent) => {
    event.preventDefault();
    const term = query.trim();
    router.push(term ? `/search/?q=${encodeURIComponent(term)}` : '/products/');
  };

  const dashboardHref =
    user?.role === 'ADMIN' ? '/admin/' : user?.role === 'SELLER' ? '/seller/' : '/account/';

  async function handleLogout() {
    await logout();
    setMenuOpen(false);
    toast.success('You have been signed out.');
    router.push('/');
  }

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/95 backdrop-blur">
      <div className="bg-navy text-white">
        <div className="container-hub flex h-9 items-center justify-between text-[11px] font-medium tracking-wide">
          <p className="truncate">
            Free delivery over ₹999 · Every payment is a <span className="text-amber-300">secure demo</span>
          </p>
          <p className="hidden sm:block">Multi-vendor marketplace · Simulated transactions only</p>
        </div>
      </div>

      <div className="container-hub flex h-16 items-center gap-3 sm:gap-5">
        <button
          type="button"
          className="-ml-1 rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden"
          onClick={() => setMobileOpen((open) => !open)}
          aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={mobileOpen}
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>

        <Logo />

        <form onSubmit={submitSearch} className="hidden flex-1 md:block" role="search">
          <div className="relative mx-auto max-w-xl">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search products, brands and stores"
              className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50/70 pl-10 pr-24 text-sm text-slate-900 placeholder:text-slate-400 transition focus:border-indigo-300 focus:bg-white focus:outline-none focus:ring-4 focus:ring-indigo-100"
              aria-label="Search products"
            />
            <button
              type="submit"
              className="absolute right-1 top-1 h-8 rounded-lg bg-indigo-600 px-3 text-xs font-bold text-white transition hover:bg-indigo-700"
            >
              Search
            </button>
          </div>
        </form>

        <div className="ml-auto flex items-center gap-1 sm:gap-2">
          {user?.role === 'CUSTOMER' || !user ? (
            <Link
              href="/cart/"
              className="relative inline-flex h-10 w-10 items-center justify-center rounded-xl text-slate-600 transition hover:bg-indigo-50 hover:text-indigo-700"
              aria-label={`Cart${cart.itemCount ? `, ${cart.itemCount} items` : ''}`}
            >
              <ShoppingBag className="h-5 w-5" aria-hidden />
              {cart.itemCount > 0 ? (
                <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-orange-500 px-1 text-[10px] font-bold text-white ring-2 ring-white">
                  {cart.itemCount > 99 ? '99+' : cart.itemCount}
                </span>
              ) : null}
            </Link>
          ) : null}

          {user ? (
            <div className="relative" ref={menuRef}>
              <button
                type="button"
                onClick={() => setMenuOpen((open) => !open)}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-2 py-1.5 text-sm font-semibold text-slate-700 transition hover:border-indigo-200 hover:bg-indigo-50/50"
                aria-haspopup="menu"
                aria-expanded={menuOpen}
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-navy text-[11px] font-bold text-white">
                  {initials(user.name)}
                </span>
                <span className="hidden max-w-[110px] truncate sm:block">{user.name.split(' ')[0]}</span>
                <ChevronDown className="h-3.5 w-3.5 text-slate-400" aria-hidden />
              </button>
              {menuOpen ? (
                <div
                  className="absolute right-0 mt-2 w-60 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-lift animate-fade-up"
                  role="menu"
                >
                  <div className="border-b border-slate-100 px-3 py-2.5">
                    <p className="truncate text-sm font-bold text-navy">{user.name}</p>
                    <p className="truncate text-xs text-slate-500">{user.email}</p>
                    <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.12em] text-indigo-600">
                      {user.role}
                    </p>
                  </div>
                  <MenuLink href={dashboardHref} icon={<LayoutDashboard className="h-4 w-4" />}>
                    {user.role === 'CUSTOMER' ? 'My account' : 'Dashboard'}
                  </MenuLink>
                  {user.role === 'CUSTOMER' ? (
                    <>
                      <MenuLink href="/my-orders/" icon={<Package className="h-4 w-4" />}>
                        My orders
                      </MenuLink>
                      <MenuLink href="/addresses/" icon={<UserIcon className="h-4 w-4" />}>
                        Addresses
                      </MenuLink>
                    </>
                  ) : null}
                  {user.role === 'SELLER' ? (
                    <MenuLink href="/seller/products/" icon={<Store className="h-4 w-4" />}>
                      Manage products
                    </MenuLink>
                  ) : null}
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="flex w-full items-center gap-2.5 px-3 py-2 text-sm font-medium text-rose-600 transition hover:bg-rose-50"
                    role="menuitem"
                  >
                    <LogOut className="h-4 w-4" aria-hidden />
                    Sign out
                  </button>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              <Link
                href="/login/"
                className="hidden rounded-xl px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 sm:block"
              >
                Sign in
              </Link>
              <Link
                href="/register/"
                className="rounded-xl bg-indigo-600 px-3.5 py-2 text-sm font-bold text-white transition hover:bg-indigo-700"
              >
                Join
              </Link>
            </div>
          )}
        </div>
      </div>

      <nav className="hidden border-t border-slate-100 lg:block" aria-label="Categories">
        <div className="container-hub flex h-10 items-center gap-6 text-[13px] font-semibold text-slate-600">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="transition hover:text-indigo-700"
            >
              {link.label}
            </Link>
          ))}
          <Link href="/sellers/" className="transition hover:text-indigo-700">
            Stores
          </Link>
          {user?.role === 'CUSTOMER' ? (
            <Link href="/my-orders/" className="ml-auto text-indigo-600 transition hover:text-indigo-800">
              Track my orders
            </Link>
          ) : (
            <Link href="/seller-apply/" className="ml-auto text-indigo-600 transition hover:text-indigo-800">
              Sell on MarketHub
            </Link>
          )}
        </div>
      </nav>

      {mobileOpen ? (
        <div className="border-t border-slate-200 bg-white px-4 py-4 lg:hidden">
          <form onSubmit={submitSearch} className="mb-3" role="search">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search MarketHub"
                className="input pl-10"
                aria-label="Search products"
              />
            </div>
          </form>
          <div className="grid gap-1">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                {link.label}
              </Link>
            ))}
            <Link href="/sellers/" className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
              Stores
            </Link>
            <Link href="/seller-apply/" className="rounded-lg px-3 py-2 text-sm font-semibold text-indigo-700 hover:bg-indigo-50">
              Sell on MarketHub
            </Link>
            {!user ? (
              <Link href="/login/" className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                Sign in
              </Link>
            ) : null}
          </div>
        </div>
      ) : null}
    </header>
  );
}

function MenuLink({
  href,
  icon,
  children,
}: {
  href: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      role="menuitem"
      className={cn(
        'flex items-center gap-2.5 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-indigo-50 hover:text-indigo-800',
      )}
    >
      {icon}
      {children}
    </Link>
  );
}
