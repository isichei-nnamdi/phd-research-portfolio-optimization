import clsx from 'clsx';

/** Nairafolio mark: a single-stroke "N" whose final stroke rises to a node -
 *  a growth line and a graph node in one. Keep in sync with public/favicon.svg. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={clsx('shrink-0', className)} aria-hidden="true">
      <rect width="32" height="32" rx="8" fill="#047857" />
      <path d="M10 22.5V10l11 11.5v-8" fill="none" stroke="#fff" strokeWidth="2.6"
            strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="21" cy="9.4" r="2.3" fill="#fff" />
    </svg>
  );
}

export function Logo({ subtitle = true, className }: { subtitle?: boolean; className?: string }) {
  return (
    <span className={clsx('flex items-center gap-2.5', className)}>
      <LogoMark className="h-8 w-8" />
      <span className="leading-tight">
        <span className="block text-[15px] font-bold tracking-tight text-ink">Nairafolio</span>
        {subtitle && <span className="hidden text-[11px] text-ink-3 sm:block">PhD Research · NSUK</span>}
      </span>
    </span>
  );
}
