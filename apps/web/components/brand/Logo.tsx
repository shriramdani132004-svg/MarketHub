import Link from 'next/link';
import { cn } from '../../lib/utils';

export function LogoMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'relative inline-flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-navy shadow-sm',
        className,
      )}
      aria-hidden
    >
      <span className="absolute left-1.5 top-1.5 h-2.5 w-2.5 rounded-[3px] bg-indigo-400" />
      <span className="absolute right-1.5 top-1.5 h-2.5 w-2.5 rounded-[3px] bg-teal-400" />
      <span className="absolute bottom-1.5 left-1.5 h-2.5 w-2.5 rounded-[3px] bg-amber-400" />
      <span className="absolute bottom-1.5 right-1.5 h-2.5 w-2.5 rounded-[3px] bg-orange-400" />
      <span className="h-1.5 w-1.5 rounded-full bg-white" />
    </span>
  );
}

export function Logo({
  href = '/',
  subtitle,
  className,
}: {
  href?: string;
  subtitle?: string;
  className?: string;
}) {
  return (
    <Link href={href} className={cn('group inline-flex items-center gap-2.5', className)}>
      <LogoMark className="transition group-hover:scale-105" />
      <span className="leading-tight">
        <span className="block text-[17px] font-extrabold tracking-tight text-navy">
          Market<span className="text-indigo-600">Hub</span>
        </span>
        {subtitle ? (
          <span className="block text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
            {subtitle}
          </span>
        ) : null}
      </span>
    </Link>
  );
}
