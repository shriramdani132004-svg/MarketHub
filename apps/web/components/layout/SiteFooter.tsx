import Link from 'next/link';
import { Logo } from '../brand/Logo';

const GROUPS = [
  {
    title: 'Marketplace',
    links: [
      { href: '/products/', label: 'All products' },
      { href: '/sellers/', label: 'Stores' },
      { href: '/search/', label: 'Search' },
      { href: '/cart/', label: 'Your cart' },
    ],
  },
  {
    title: 'Your account',
    links: [
      { href: '/login/', label: 'Sign in' },
      { href: '/register/', label: 'Create an account' },
      { href: '/my-orders/', label: 'My orders' },
      { href: '/addresses/', label: 'Saved addresses' },
    ],
  },
  {
    title: 'Sell with us',
    links: [
      { href: '/seller-apply/', label: 'Apply as a seller' },
      { href: '/seller/', label: 'Seller dashboard' },
      { href: '/seller/analytics/', label: 'Store analytics' },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-slate-200 bg-white">
      <div className="container-hub py-12">
        <div className="grid gap-10 md:grid-cols-[1.4fr_repeat(3,1fr)]">
          <div>
            <Logo subtitle="Multi-vendor marketplace" />
            <p className="mt-4 max-w-xs text-sm leading-6 text-slate-500">
              A portfolio-grade marketplace demonstrating transactional inventory, seller-wise order
              splitting and end-to-end commerce workflows.
            </p>
            <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium leading-5 text-amber-800">
              Demo environment. Payments are simulated and no real money is processed.
            </p>
          </div>
          {GROUPS.map((group) => (
            <div key={group.title}>
              <h3 className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">
                {group.title}
              </h3>
              <ul className="mt-3 space-y-2">
                {group.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-sm text-slate-600 transition hover:text-indigo-700"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-10 flex flex-col gap-2 border-t border-slate-100 pt-6 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} MarketHub. Built with Next.js, NestJS and PostgreSQL.</p>
          <p>INR pricing · Simulated payments · Render + Neon deployment</p>
        </div>
      </div>
    </footer>
  );
}
