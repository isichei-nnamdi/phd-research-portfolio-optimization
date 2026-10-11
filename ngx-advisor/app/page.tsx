'use client';
import Link from 'next/link';
import { ArrowRight, TrendingUp, Brain, BarChart2, BookOpen, Award, CheckCircle2, ChevronRight } from 'lucide-react';
import { RESEARCH_METRICS } from '@/lib/data';

const METRICS = [
  { label: 'Pooled Sharpe Ratio',    value: '1.077',   sub: 'PPO agent, 68 months'     },
  { label: 'GAT Quintile Spread',    value: '2.22%',   sub: 'Mean monthly, 7 folds'    },
  { label: 'PPO Monthly Turnover',   value: '15.2%',   sub: 'vs MVO at 39.8%'          },
  { label: 'Annual CAGR',            value: '25.6%',   sub: 'Net of 10 bps cost'       },
  { label: 'NGX Equities Studied',   value: '39',      sub: '2012 to 2025, 14 years'   },
  { label: 'Walk-Forward Folds',     value: '7',       sub: '68 usable test months'    },
];

const RQS = [
  { id: 'RQ1', label: 'GAT Pre-Selection', status: 'Prototype', icon: Brain,
    desc: 'GAT delivers the widest top-minus-bottom quintile spread (2.22% a month vs 0.93% momentum, 0.82% Random Forest); Random Forest has the higher mean IC (0.061 vs 0.054).' },
  { id: 'RQ2', label: 'PPO Allocation',    status: 'Prototype', icon: TrendingUp,
    desc: 'PPO reaches a Sharpe of 1.077 (MVO 1.024, equal weight 1.072) at 15.2% monthly turnover vs 39.8% for MVO, and loses less Sharpe as trading costs rise.' },
  { id: 'RQ3', label: 'Sentiment Signal',  status: 'Complete',  icon: BarChart2,
    desc: 'VADER-scored news sentiment adds no significant incremental value (HAC t = −0.820, p ≈ 0.41). First test for an African exchange.' },
  { id: 'RQ4', label: 'NGX Microstructure',status: 'Published', icon: BookOpen,
    desc: 'All 39 equities reject normality; volatility clustering (GARCH) in every stock; trading concentrated in Financial stocks (53% of value traded). Published PMLR 2026.' },
];

const STAGES = [
  { step: '01', title: 'Data Pipeline',
    items: ['39-stock point-in-time panel (2012 to 2025)', 'Former NGX-30 members included', '6 lagged price and volume features', 'VADER-scored news sentiment (RQ3)'] },
  { step: '02', title: 'GAT Pre-Selection',
    items: ['60-day rolling correlation graph', '2-layer graph attention network', 'Next-month return-rank target', 'Scored by IC and quintile spread'] },
  { step: '03', title: 'PPO Allocation',
    items: ['Continuous weight action space', '20% per-asset cap', 'Reward net of 10 bps turnover cost', 'Long-only portfolio weights'] },
  { step: '04', title: 'Walk-Forward Validation',
    items: ['7 annual folds (2019 to 2025)', '68 out-of-sample months', 'No look-ahead bias', 'Cost sensitivity at 5 to 50 bps'] },
];

export default function HomePage() {
  const m = RESEARCH_METRICS;

  return (
    <div>

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-16 text-center">
        <div className="tag tag-brand mb-8 animate-in">
          <Award className="w-3.5 h-3.5" />
          Published · {m.publication.venue} · {m.publication.event}
        </div>

        <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight leading-[1.08] mb-6 animate-in text-ink"
            style={{ animationDelay: '0.05s' }}>
          NGX Robo-Advisor
          <span className="block text-accent">ML-Enhanced Portfolio Optimisation</span>
        </h1>

        <p className="text-lg text-ink-2 max-w-2xl mx-auto mb-10 animate-in leading-relaxed"
           style={{ animationDelay: '0.1s' }}>
          A two-stage{' '}
          <span className="text-ink font-medium">Graph Attention Network</span> and{' '}
          <span className="text-ink font-medium">Proximal Policy Optimisation</span> framework
          validated on {m.panel.stocks}&nbsp;NGX equities across {m.panel.years}&nbsp;years
          ({m.panel.startYear} to {m.panel.endYear}).
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center items-center animate-in"
             style={{ animationDelay: '0.15s' }}>
          <Link href="/advisor" className="btn-primary text-base px-7 py-3.5 w-full sm:w-auto">
            Try the Robo-Advisor <ArrowRight className="w-4 h-4" />
          </Link>
          <Link href="/research" className="btn-secondary text-base px-7 py-3.5 w-full sm:w-auto">
            View Research Results <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      {/* ── Key Metrics ──────────────────────────────────────────────────── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-20">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {METRICS.map((x, i) => (
            <div key={i} className="card p-4 text-center">
              <div className="text-2xl font-bold text-ink">{x.value}</div>
              <div className="text-ink-2 text-xs font-medium mt-1">{x.label}</div>
              <div className="text-ink-3 text-[11px] mt-0.5">{x.sub}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Research Questions ───────────────────────────────────────────── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-20">
        <div className="text-center mb-10">
          <h2 className="section-title">Four Research Questions</h2>
          <p className="section-sub mx-auto">
            Each question is independently addressed through a seven-fold
            walk-forward validation protocol with 68 out-of-sample monthly observations.
          </p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {RQS.map(rq => (
            <div key={rq.id} className="card card-hover p-5 flex flex-col gap-3">
              <div className="flex items-start justify-between">
                <div className="w-9 h-9 rounded-xl bg-brand/10 flex items-center justify-center">
                  <rq.icon className="w-[18px] h-[18px] text-accent" />
                </div>
                <span className={`tag text-[10px] ${rq.status === 'Published' ? 'tag-brand' : 'tag-neutral'}`}>
                  {rq.status}
                </span>
              </div>
              <div>
                <div className="eyebrow mb-1">{rq.id}</div>
                <h3 className="font-semibold text-ink text-sm">{rq.label}</h3>
              </div>
              <p className="text-ink-2 text-xs leading-relaxed">{rq.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Framework Architecture ───────────────────────────────────────── */}
      <section className="bg-surface border-y border-line py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="section-title">Two-Stage Framework</h2>
            <p className="section-sub mx-auto">
              GAT ranks the stock universe (RQ1) and PPO learns portfolio weights (RQ2); each stage is
              evaluated separately on strictly held-out annual folds. The robo-advisor combines them,
              using GAT rankings to choose stocks and PPO weights to size them.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {STAGES.map((s, i) => (
              <div key={i} className="rounded-2xl border border-line bg-canvas p-5">
                <div className="flex items-center gap-2 mb-3">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand text-xs font-bold text-white">{s.step}</span>
                  <h3 className="font-semibold text-ink">{s.title}</h3>
                </div>
                <ul className="space-y-1.5">
                  {s.items.map((item, j) => (
                    <li key={j} className="flex items-start gap-2 text-xs text-ink-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-accent mt-0.5 flex-shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div className="mt-10 flex justify-center">
            <Link href="/advisor" className="btn-primary px-8 py-3.5 text-base">
              Try the Advisor <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* ── Paper highlight ──────────────────────────────────────────────── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="card p-8 md:p-10 border-l-4 border-l-brand">
          <div className="flex items-center gap-2 mb-4">
            <span className="tag tag-brand">Published</span>
            <span className="tag tag-neutral">PMLR 2026</span>
          </div>
          <blockquote className="text-xl md:text-2xl font-semibold text-ink leading-snug mb-4 max-w-3xl">
            &ldquo;Empirical Characterisation of the Nigerian Stock Exchange: Implications
            for Graph Neural Network Portfolio Optimisation&rdquo;
          </blockquote>
          <p className="text-ink-2 text-sm mb-2">
            Nnamdi Augustus Isichei &amp; Prof. H. K. Oduwole
          </p>
          <p className="text-accent text-sm font-medium">
            Proceedings of Machine Learning Research, Vol. 319 · IndabaX Nigeria 2026
          </p>
        </div>
      </section>

    </div>
  );
}
