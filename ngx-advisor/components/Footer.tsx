import Link from 'next/link';
import { TrendingUp, ExternalLink } from 'lucide-react';

export function Footer() {
  return (
    <footer className="border-t border-slate-border mt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">

          {/* Brand */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 rounded-lg bg-ngx flex items-center justify-center">
                <TrendingUp className="w-3.5 h-3.5 text-white" />
              </div>
              <span className="font-bold text-white text-sm">NGX Robo-Advisor</span>
            </div>
            <p className="text-slate-400 text-sm leading-relaxed">
              A two-stage machine learning framework for portfolio optimisation
              on the Nigerian Exchange. PhD Research prototype.
            </p>
          </div>

          {/* Research */}
          <div>
            <h4 className="text-white font-semibold text-sm mb-3">Research</h4>
            <ul className="space-y-2 text-sm text-slate-400">
              <li><Link href="/research#rq4" className="hover:text-ngx-light transition-colors">Market Characterisation (RQ4)</Link></li>
              <li><Link href="/research#rq1" className="hover:text-ngx-light transition-colors">GAT Pre-Selection (RQ1)</Link></li>
              <li><Link href="/research#rq2" className="hover:text-ngx-light transition-colors">PPO Allocation (RQ2)</Link></li>
              <li><Link href="/research#rq3" className="hover:text-ngx-light transition-colors">Sentiment Analysis (RQ3)</Link></li>
            </ul>
          </div>

          {/* Affiliation */}
          <div>
            <h4 className="text-white font-semibold text-sm mb-3">Affiliation</h4>
            <ul className="space-y-2 text-sm text-slate-400">
              <li className="flex items-center gap-1.5">
                <span>NSUK · Centre for Cyberspace Studies</span>
              </li>
              <li>Supervisor: Prof. H. K. Oduwole</li>
              <li>Student ID: PHD25DTS0002</li>
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
        <div className="pt-6 flex flex-col sm:flex-row items-center justify-between gap-3
                        text-xs text-slate-500">
          <span>Austin Nnamdi Augustus Isichei · Nasarawa State University Keffi · 2025</span>
          <span className="flex items-center gap-1.5">
            Published in{' '}
            <span className="text-gold font-medium">PMLR Vol. 319</span>
            · IndabaX Nigeria 2026
          </span>
        </div>
      </div>
    </footer>
  );
}
