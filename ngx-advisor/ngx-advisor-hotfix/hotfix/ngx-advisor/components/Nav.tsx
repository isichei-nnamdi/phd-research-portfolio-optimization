'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BarChart2, Brain, Menu, X } from 'lucide-react';
import { useState } from 'react';
import clsx from 'clsx';
import { ThemeToggle } from './ThemeToggle';

const links = [
  { href: '/',          label: 'Overview'   },
  { href: '/advisor',   label: 'Advisor' },
  { href: '/research',  label: 'Research'   },
];

export function Nav() {
  const path = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 bg-navy/90 backdrop-blur-md border-b border-slate-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">

          {/* Brand */}
          <Link href="/" className="flex items-center gap-3 group">
            <img src="/favicon.svg" alt="NGX Advisor logo" className="w-8 h-8 rounded-lg" />
            <div className="leading-tight">
              <div className="text-sm font-bold text-white tracking-tight">NGX Robo-Advisor</div>
              <div className="text-[10px] text-slate-400 hidden sm:block">PhD Research Demo - NSUK</div>
            </div>
          </Link>

          {/* Desktop links */}
          <nav className="hidden md:flex items-center gap-1">
            {links.map(l => (
              <Link key={l.href} href={l.href}
                className={clsx(
                  'px-4 py-2 rounded-lg text-sm font-medium transition-all duration-150',
                  path === l.href
                    ? 'bg-ngx/20 text-ngx-light border border-ngx/30'
                    : 'text-slate-400 hover:text-white hover:bg-slate-card'
                )}>
                {l.label}
              </Link>
            ))}
          </nav>

          {/* CTA + mobile toggle */}
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Link href="/advisor"
              className="hidden sm:inline-flex btn-primary text-sm py-2 px-4">
              <Brain className="w-4 h-4" />
              Get Recommendation
            </Link>
            <button onClick={() => setOpen(!open)}
              className="md:hidden p-2 rounded-lg text-slate-400 hover:text-white
                         hover:bg-slate-card transition-colors">
              {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {open && (
          <nav className="md:hidden pb-4 pt-2 border-t border-slate-border mt-2">
            {links.map(l => (
              <Link key={l.href} href={l.href} onClick={() => setOpen(false)}
                className={clsx(
                  'block px-4 py-2.5 rounded-lg text-sm font-medium transition-colors',
                  path === l.href
                    ? 'bg-ngx/20 text-ngx-light'
                    : 'text-slate-400 hover:text-white'
                )}>
                {l.label}
              </Link>
            ))}
            <Link href="/advisor" onClick={() => setOpen(false)}
              className="mt-3 btn-primary w-full justify-center text-sm">
              <Brain className="w-4 h-4" />
              Get Recommendation
            </Link>
          </nav>
        )}
      </div>
    </header>
  );
}
