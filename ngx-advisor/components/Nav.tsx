'use client';
import Link       from 'next/link';
import { usePathname } from 'next/navigation';
import { Brain, Menu, X } from 'lucide-react';
import { useState } from 'react';
import { ThemeToggle } from './ThemeToggle';
import clsx from 'clsx';

const LINKS = [
  { href: '/',         label: 'Overview'  },
  { href: '/advisor',  label: 'Advisor'   },
  { href: '/research', label: 'Research'  },
];

export function Nav() {
  const path = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-theme backdrop-blur-md"
            style={{ background: 'var(--card)' }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">

          {/* Brand */}
          <Link href="/" className="flex items-center gap-2.5 group">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/favicon.svg" alt="Nairafolio logo" className="w-8 h-8 rounded-lg" />
            <div>
              <div className="text-sm font-bold" style={{ color: 'var(--t1)' }}>Nairafolio</div>
              <div className="text-[10px] hidden sm:block" style={{ color: 'var(--t3)' }}>PhD Research - NSUK</div>
            </div>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-1">
            {LINKS.map(l => (
              <Link key={l.href} href={l.href}
                className={clsx('px-4 py-2 rounded-lg text-sm font-medium transition-all',
                  path === l.href
                    ? 'badge-ngx border'
                    : 'hover:bg-hover'
                )}
                style={{ color: path === l.href ? 'var(--ngxl)' : 'var(--t2)' }}>
                {l.label}
              </Link>
            ))}
          </nav>

          {/* Right side */}
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Link href="/advisor"
              className="hidden sm:inline-flex btn-primary text-sm py-2 px-4">
              <Brain className="w-4 h-4" /> Get Recommendation
            </Link>
            <button onClick={() => setOpen(o => !o)}
              className="md:hidden p-2 rounded-lg transition-colors"
              style={{ color: 'var(--t2)' }}>
              {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {open && (
          <nav className="md:hidden pb-4 pt-2 border-t border-theme mt-2 space-y-1">
            {LINKS.map(l => (
              <Link key={l.href} href={l.href} onClick={() => setOpen(false)}
                className={clsx('block px-4 py-2.5 rounded-lg text-sm font-medium transition-colors',
                  path === l.href ? 'badge-ngx border' : '')}
                style={{ color: path === l.href ? 'var(--ngxl)' : 'var(--t2)' }}>
                {l.label}
              </Link>
            ))}
            <Link href="/advisor" onClick={() => setOpen(false)}
              className="mt-2 btn-primary w-full justify-center text-sm">
              <Brain className="w-4 h-4" /> Get Recommendation
            </Link>
          </nav>
        )}
      </div>
    </header>
  );
}
