'use client';
import Link from 'next/link';
import { ArrowRight, TrendingUp, Brain, BarChart2, BookOpen, Award, CheckCircle2, ChevronRight } from 'lucide-react';
import { RESEARCH_METRICS } from '@/lib/data';

const METRICS = [
  { label: 'Pooled Sharpe Ratio',    value: '1.077',   sub: 'PPO agent, 68 months',       color: 'text-ngx-light' },
  { label: 'GAT Quintile Spread',    value: '2.22%',   sub: 'Mean monthly, 7 folds',       color: 'text-gold' },
  { label: 'PPO Monthly Turnover',   value: '15.2%',   sub: 'vs MVO at 39.8%',             color: 'text-blue-400' },
  { label: 'Annual CAGR',            value: '29.1%',   sub: 'Net of 10 bps cost',          color: 'text-purple-400' },
  { label: 'NGX Equities Studied',   value: '39',      sub: '2012 to 2025, 14 years',      color: 'text-ngx-light' },
  { label: 'Walk-Forward Folds',     value: '7',       sub: '68 usable test months',        color: 'text-gold' },
];

const RQS = [
  { id: 'RQ1', label: 'GAT Pre-Selection', status: 'Prototype', icon: Brain,
    desc: 'Graph Attention Network outperforms momentum (IC 0.054, spread 2.22%) and Random Forest baselines on the NGX.' },
  { id: 'RQ2', label: 'PPO Allocation',    status: 'Prototype', icon: TrendingUp,
    desc: 'PPO agent achieves Sharpe 1.077 at 15.2% monthly turnover, demonstrating cost robustness over MVO at 39.8%.' },
  { id: 'RQ3', label: 'Sentiment Signal',  status: 'Complete',  icon: BarChart2,
    desc: 'VADER-scored news sentiment adds no significant incremental value (HAC t = −0.820, p = 0.41). First test for an African exchange.' },
  { id: 'RQ4', label: 'NGX Microstructure',status: 'Published', icon: BookOpen,
    desc: 'All 39 equities reject normality; ARCH clustering confirmed; liquidity concentrated in Financial and ICT sectors. Published PMLR 2026.' },
];

const STATUS_STYLE: Record<string, string> = {
  Published: 'bg-ngx/20 text-ngx-light border-ngx/40',
  Complete:  'bg-blue-500/20 text-blue-300 border-blue-500/40',
  Prototype: 'bg-gold/20 text-gold border-gold/40',
};

const STAGES = [
  {
    step: '01', title: 'Data Pipeline', color: 'border-ngx',
    items: ['39-stock PIT panel (2012 to 2025)', 'Survivorship-bias corrected', '6 macroeconomic variables', 'VADER-scored sentiment'],
  },
  {
    step: '02', title: 'GAT Pre-Selection', color: 'border-blue-500',
    items: ['60-day rolling correlation graph', '2-layer attention network', 'Cross-sectional rank target', 'Top-quintile stock selection'],
  },
  {
    step: '03', title: 'PPO Allocation', color: 'border-gold',
    items: ['Continuous weight action space', '20% per-asset cap', 'Turnover-penalised reward', 'Long-only portfolio weights'],
  },
  {
    step: '04', title: 'Walk-Forward Validation', color: 'border-purple-500',
    items: ['7 annual folds (2019 to 2025)', '68 out-of-sample months', 'No look-ahead bias', 'Cost sensitivity at 5 to 50 bps'],
  },
];

export default function HomePage() {
  const m = RESEARCH_METRICS;

  return (
    <div>

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden">
        {/* Background grid */}
        <div className="absolute inset-0 pointer-events-none"
          style={{ backgroundImage: 'radial-gradient(circle at 25% 40%, #007B3E12 0%, transparent 60%), radial-gradient(circle at 75% 70%, #C49A0010 0%, transparent 50%)' }} />
        <div className="absolute inset-0 pointer-events-none"
          style={{ backgroundImage: 'linear-gradient(#1e305418 1px, transparent 1px), linear-gradient(90deg, #1e305418 1px, transparent 1px)', backgroundSize: '48px 48px' }} />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-16 text-center">

          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-ngx/40
                          bg-ngx/10 text-ngx-light text-xs font-medium mb-8 animate-in">
            <Award className="w-3.5 h-3.5" />
            Published · PMLR Vol. {m.publication.venue.split(' ').pop()} · {m.publication.event}
          </div>

          <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight leading-[1.1] mb-6 animate-in"
              style={{ animationDelay: '0.1s' }}>
            <span className="text-white">NGX Robo-Advisor</span>
            <br />
            <span className="gradient-text">ML-Enhanced Portfolio</span>
            <br />
            <span className="gradient-text">Optimisation</span>
          </h1>

          <p className="text-lg text-slate-400 max-w-2xl mx-auto mb-10 animate-in leading-relaxed"
             style={{ animationDelay: '0.2s' }}>
            A two-stage{' '}
            <span className="text-white font-medium">Graph Attention Network</span> and{' '}
            <span className="text-white font-medium">Proximal Policy Optimisation</span> framework
            validated on {m.panel.stocks}&nbsp;NGX equities across {m.panel.years}&nbsp;years
            ({m.panel.startYear}–{m.panel.endYear}).
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center animate-in"
               style={{ animationDelay: '0.3s' }}>
            <Link href="/advisor" className="btn-primary text-base px-8 py-3.5 shadow-lg shadow-ngx/20">
              Try the Robo-Advisor <ArrowRight className="w-4 h-4" />
            </Link>
            <Link href="/research" className="btn-secondary text-base px-8 py-3.5">
              View Research Results <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* ── Key Metrics ──────────────────────────────────────────────────── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {METRICS.map((m, i) => (
            <div key={i} className="card-glow p-4 text-center">
              <div className={`text-2xl font-extrabold ${m.color}`}>{m.value}</div>
              <div className="text-white text-xs font-semibold mt-1">{m.label}</div>
              <div className="text-slate-500 text-[10px] mt-0.5">{m.sub}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Research Questions ───────────────────────────────────────────── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-20">
        <div className="text-center mb-10">
          <h2 className="section-title">Four Research Questions</h2>
          <p className="section-sub mx-auto text-center">
            Each question is independently addressed through a seven-fold
            walk-forward validation protocol with 68 out-of-sample monthly observations.
          </p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {RQS.map(rq => (
            <div key={rq.id} className="card-glow p-5 flex flex-col gap-3">
              <div className="flex items-start justify-between">
                <div className="w-9 h-9 rounded-xl bg-ngx/15 flex items-center justify-center">
                  <rq.icon className="w-4.5 h-4.5 text-ngx-light" />
                </div>
                <span className={`tag text-[10px] border ${STATUS_STYLE[rq.status]}`}>
                  {rq.status}
                </span>
              </div>
              <div>
                <div className="text-[10px] font-mono text-slate-500 mb-1">{rq.id}</div>
                <h3 className="font-semibold text-white text-sm">{rq.label}</h3>
              </div>
              <p className="text-slate-400 text-xs leading-relaxed">{rq.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Framework Architecture ───────────────────────────────────────── */}
      <section className="bg-slate-card border-y border-slate-border py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="section-title">Two-Stage Framework</h2>
            <p className="section-sub mx-auto text-center">
              GAT pre-selection filters the investable universe; PPO allocation
              determines portfolio weights. Both stages are validated on strictly held-out data.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {STAGES.map((s, i) => (
              <div key={i} className={`card p-5 border-t-2 ${s.color}`}>
                <div className="text-[10px] font-mono text-slate-500 mb-1">Stage {s.step}</div>
                <h3 className="font-semibold text-white mb-3">{s.title}</h3>
                <ul className="space-y-1.5">
                  {s.items.map((item, j) => (
                    <li key={j} className="flex items-start gap-2 text-xs text-slate-400">
                      <CheckCircle2 className="w-3.5 h-3.5 text-ngx-light mt-0.5 flex-shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div className="mt-10 flex justify-center">
            <Link href="/advisor" className="btn-primary px-10 py-3.5 text-base shadow-lg shadow-ngx/20">
              Try the Advisor <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* ── Paper highlight ──────────────────────────────────────────────── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="card p-8 md:p-10 border-ngx/30 border relative overflow-hidden">
          <div className="absolute top-0 right-0 w-48 h-48 rounded-full bg-ngx/5 blur-3xl -translate-y-1/2 translate-x-1/2" />
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-4">
              <div className="tag badge-ngx">Published</div>
              <div className="tag badge-gold">PMLR 2026</div>
            </div>
            <blockquote className="text-xl md:text-2xl font-semibold text-white leading-snug mb-4 max-w-3xl">
              "Empirical Characterisation of the Nigerian Stock Exchange: Implications
              for Graph Neural Network Portfolio Optimisation"
            </blockquote>
            <p className="text-slate-400 text-sm mb-2">
              Austin Nnamdi Augustus Isichei &amp; Prof. H. K. Oduwole
            </p>
            <p className="text-ngx-light text-sm font-medium">
              Proceedings of Machine Learning Research, Vol. 319 · IndabaX Nigeria 2026
            </p>
          </div>
        </div>
      </section>

    </div>
  );
}
