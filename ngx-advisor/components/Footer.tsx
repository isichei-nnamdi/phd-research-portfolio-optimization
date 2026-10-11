import Link from 'next/link';
import { ExternalLink } from 'lucide-react';

export function Footer() {
  return (
    <footer className="border-t border-theme mt-20" style={{ background: 'var(--card)' }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div>
            <div className="flex items-center gap-2 mb-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/favicon.svg" alt="Nairafolio" className="w-7 h-7 rounded-lg" />
              <span className="font-bold text-sm" style={{ color: 'var(--t1)' }}>Nairafolio</span>
            </div>
            <p className="text-sm leading-relaxed" style={{ color: 'var(--t2)' }}>
              A two-stage ML framework for portfolio optimisation on the NGX. PhD Research prototype.
            </p>
          </div>
          <div>
            <h4 className="font-semibold text-sm mb-3" style={{ color: 'var(--t1)' }}>Research</h4>
            <ul className="space-y-2 text-sm" style={{ color: 'var(--t2)' }}>
              <li><Link href="/research#rq4" className="hover:text-ngx-light transition-colors">Market Characterisation (RQ4)</Link></li>
              <li><Link href="/research#rq1" className="hover:text-ngx-light transition-colors">GAT Pre-Selection (RQ1)</Link></li>
              <li><Link href="/research#rq2" className="hover:text-ngx-light transition-colors">PPO Allocation (RQ2)</Link></li>
              <li><Link href="/research#rq3" className="hover:text-ngx-light transition-colors">Sentiment Analysis (RQ3)</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold text-sm mb-3" style={{ color: 'var(--t1)' }}>Affiliation</h4>
            <ul className="space-y-1.5 text-sm" style={{ color: 'var(--t2)' }}>
              <li>NSUK - Centre for Cyberspace Studies</li>
              <li>Supervisor: Prof. H. K. Oduwole</li>
              <li>PHD25DTS0002</li>
              <li>
                <a href="https://datafiedtech.com" target="_blank" rel="noopener noreferrer"
                   className="hover:text-ngx-light transition-colors flex items-center gap-1">
                  datafiedtech.com <ExternalLink className="w-3 h-3" />
                </a>
              </li>
            </ul>
          </div>
        </div>
        <div className="divider mt-8 mb-0" />
        <div className="pt-5 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs" style={{ color: 'var(--t3)' }}>
          <span>Austin Nnamdi Augustus Isichei - Nasarawa State University Keffi - 2025</span>
          <span>Published in <span style={{ color: 'var(--goldl)' }} className="font-medium">PMLR Vol. 319</span> - IndabaX Nigeria 2026</span>
        </div>
      </div>
    </footer>
  );
}
