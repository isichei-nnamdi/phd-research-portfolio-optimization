import Link from 'next/link';
import { ExternalLink } from 'lucide-react';
import { Logo } from './Logo';

const linkCls = 'hover:text-accent transition-colors';

export function Footer() {
  return (
    <footer className="border-t border-line mt-20 bg-surface">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div>
            <Logo subtitle={false} className="mb-3" />
            <p className="text-sm leading-relaxed text-ink-2">
              A two-stage ML framework for portfolio optimisation on the NGX. PhD Research prototype.
            </p>
          </div>
          <div>
            <h4 className="font-semibold text-sm mb-3 text-ink">Research</h4>
            <ul className="space-y-2 text-sm text-ink-2">
              <li><Link href="/research#rq4" className={linkCls}>Market Characterisation (RQ4)</Link></li>
              <li><Link href="/research#rq1" className={linkCls}>GAT Pre-Selection (RQ1)</Link></li>
              <li><Link href="/research#rq2" className={linkCls}>PPO Allocation (RQ2)</Link></li>
              <li><Link href="/research#rq3" className={linkCls}>Sentiment Analysis (RQ3)</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold text-sm mb-3 text-ink">Affiliation</h4>
            <ul className="space-y-1.5 text-sm text-ink-2">
              <li>NSUK - Centre for Cyberspace Studies</li>
              <li>Supervisor: Prof. H. K. Oduwole</li>
              <li>PHD25DTS0002</li>
              <li>
                <a href="https://datafiedtech.com" target="_blank" rel="noopener noreferrer"
                   className={`${linkCls} inline-flex items-center gap-1`}>
                  datafiedtech.com <ExternalLink className="w-3 h-3" />
                </a>
              </li>
            </ul>
          </div>
        </div>
        <div className="border-t border-line mt-8 pt-5 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-ink-3">
          <span>Austin Nnamdi Augustus Isichei - Nasarawa State University Keffi - 2025</span>
          <span>Published in <span className="font-medium text-accent">PMLR Vol. 319</span> - IndabaX Nigeria 2026</span>
        </div>
      </div>
    </footer>
  );
}
