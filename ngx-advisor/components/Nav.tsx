'use client';
import Link       from 'next/link';
import { usePathname } from 'next/navigation';
import { Brain, Menu, X } from 'lucide-react';
import { useState } from 'react';
import { ThemeToggle } from './ThemeToggle';
import { Logo } from './Logo';
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
    <header className="sticky top-0 z-50 border-b border-line bg-surface/90 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">

          <Link href="/" aria-label="Nairafolio home">
            <Logo />
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-1">
            {LINKS.map(l => (
              <Link key={l.href} href={l.href}
                aria-current={path === l.href ? 'page' : undefined}
                className={clsx('px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                  path === l.href ? 'bg-brand/10 text-accent' : 'text-ink-2 hover:bg-subtle hover:text-ink')}>
                {l.label}
              </Link>
            ))}
          </nav>

          {/* Right side */}
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Link href="/advisor" className="hidden sm:inline-flex btn-primary text-sm py-2 px-4">
              <Brain className="w-4 h-4" /> Get Recommendation
            </Link>
            <button onClick={() => setOpen(o => !o)} aria-label="Toggle menu"
              className="md:hidden p-2 rounded-lg text-ink-2 hover:bg-subtle transition-colors">
              {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {open && (
          <nav className="md:hidden pb-4 pt-2 border-t border-line mt-2 space-y-1">
            {LINKS.map(l => (
              <Link key={l.href} href={l.href} onClick={() => setOpen(false)}
                className={clsx('block px-4 py-2.5 rounded-lg text-sm font-medium transition-colors',
                  path === l.href ? 'bg-brand/10 text-accent' : 'text-ink-2 hover:bg-subtle')}>
                {l.label}
              </Link>
            ))}
            <Link href="/advisor" onClick={() => setOpen(false)}
              className="mt-2 btn-primary w-full text-sm">
              <Brain className="w-4 h-4" /> Get Recommendation
            </Link>
          </nav>
        )}
      </div>
    </header>
  );
}
