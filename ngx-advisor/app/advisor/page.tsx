'use client';
import { useState } from 'react';
import { Brain, TrendingUp, ArrowRight, Info, RefreshCw, AlertCircle } from 'lucide-react';
import { NGX_STOCKS, type Allocation } from '@/lib/data';
import { BarList } from '@/components/charts/BarList';
import { C } from '@/components/charts/core';
import clsx from 'clsx';

type Step = 'profile' | 'capital' | 'result';

type InferenceResult = {
  signal_date: string;
  model_year: number;
  stale_days: number;
  eligible_assets: number;
  gat_rankings: { ticker: string; score: number; rank: number }[];
  allocations: Allocation[];
  capital: number;
  meta: { gat_validation_epoch?: number; ppo_training_timesteps?: number; research_prototype: boolean; disclaimer: string };
};

const CAPITALS = ['100,000','500,000','1,000,000','5,000,000','10,000,000'];
function formatNGN(val: number) {
  if (val >= 1_000_000) return `₦${(val / 1_000_000).toFixed(2)}M`;
  if (val >= 1_000)     return `₦${(val / 1_000).toFixed(0)}K`;
  return `₦${val}`;
}

function AllocationBar({ alloc, amount }: { alloc: Allocation; amount: number }) {
  const stock = NGX_STOCKS.find(s => s.symbol === alloc.symbol);
  const pct   = Math.round(alloc.weight * 100);
  const naira = formatNGN(amount * alloc.weight);

  return (
    <div className="p-4 card">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-ink text-sm">{alloc.symbol}</span>
          <span className="text-ink-2 text-xs hidden sm:block">{stock?.name}</span>
        </div>
        <div className="text-right">
          <div className="text-ink font-bold text-sm">{pct}%</div>
          <div className="text-ink-2 text-xs">{naira}</div>
        </div>
      </div>
      {/* Weight bar */}
      <div className="h-1.5 bg-subtle rounded-full overflow-hidden mb-2">
        <div className="h-full rounded-full bg-brand transition-all duration-500"
          style={{ width: `${pct}%` }} />
      </div>
      {/* Rationale */}
      <p className="text-ink-2 text-xs leading-relaxed">{alloc.rationale}</p>
      {/* Mini stats */}
      {stock && (
        <div className="flex gap-3 mt-2">
          <div className="text-[10px] text-ink-3">Ann. Return <span className="text-ink">{stock.annReturn.toFixed(1)}%</span></div>
          <div className="text-[10px] text-ink-3">Vol <span className="text-ink">{stock.annVol.toFixed(1)}%</span></div>
          <div className="text-[10px] text-ink-3">Sharpe <span className="text-ink">{stock.sharpe.toFixed(2)}</span></div>
          <div className="text-[10px] text-ink-3">Beta <span className="text-ink">{stock.beta.toFixed(2)}</span></div>
        </div>
      )}
    </div>
  );
}

export default function AdvisorPage() {
  const [step, setStep]           = useState<Step>('profile');
  const [modelYear, setModelYear] = useState(2025);
  const [capital, setCapital]     = useState('1,000,000');
  const [loading, setLoading]     = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [result, setResult] = useState<InferenceResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const amount = parseInt(capital.replace(/,/g, ''), 10) || 1_000_000;

  async function handleOptimise() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/portfolio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ capital: amount, modelYear }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? 'Inference request failed.');
      setResult(payload as InferenceResult);
      setShowResult(true);
      setStep('result');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to get an inference response.');
    } finally {
      setLoading(false);
    }
  }

  const weightItems = [...(result?.allocations ?? [])]
    .sort((a, b) => b.weight - a.weight)
    .map(a => ({ label: a.symbol, value: +(a.weight * 100).toFixed(1), color: C.s1, group: 'Portfolio weight' }));

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">

      {/* Header */}
      <div className="text-center mb-10">
        <div className="tag tag-brand mb-4">
          <Brain className="w-3.5 h-3.5" /> GAT + PPO Engine
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-ink mb-3">
          Portfolio Recommendation
        </h1>
        <p className="text-ink-2 max-w-xl mx-auto">
          Run a saved annual GAT ranking and PPO allocation policy against the latest prepared repository snapshot.
        </p>
      </div>

      {/* Disclaimer */}
      <div className="card p-4 mb-8 flex gap-3">
        <AlertCircle className="w-4 h-4 text-ink-3 mt-0.5 flex-shrink-0" />
        <p className="text-xs text-ink-2 leading-relaxed">
          <span className="text-ink font-medium">Research prototype.</span>{' '}
          Recommendations are generated from prototype walk-forward results (2019 to 2025).
          This tool is for academic demonstration only and does not constitute financial advice.
        </p>
      </div>

      {/* ── Step 1: Model fold ─────────────────────────────────────────── */}
      {step === 'profile' && (
        <div className="animate-in">
          <h2 className="text-lg font-semibold text-ink mb-2">Step 1: Select a saved annual model fold</h2>
          <p className="text-sm text-ink-2 mb-5">Each fold was trained only on data available before its held-out year. Choose the policy vintage to apply to the current prepared snapshot.</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 mb-8">
            {Array.from({ length: 7 }, (_, index) => 2019 + index).map(year => (
              <button key={year} onClick={() => setModelYear(year)}
                className={clsx('card p-4 text-left transition-colors', modelYear === year ? 'border-2 border-brand bg-brand/10' : 'border border-line hover:border-brand/50')}>
                <div className="text-lg font-bold text-ink">{year}</div>
                <div className="text-[11px] text-ink-2">{year === 2025 ? 'Latest fold' : `Test fold ${year}`}</div>
                {modelYear === year && <div className="mt-2 text-[10px] text-accent">Selected</div>}
              </button>
            ))}
          </div>
          <button onClick={() => setStep('capital')}
            className="btn-primary">
            Continue <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ── Step 2: Capital & Horizon ─────────────────────────────────── */}
      {step === 'capital' && (
        <div className="animate-in">
          <button onClick={() => setStep('profile')}
            className="text-sm text-ink-2 hover:text-ink mb-6 flex items-center gap-1.5 transition-colors">
            ← Back to model fold
          </button>
          <h2 className="text-lg font-semibold text-ink mb-5">Step 2 - Investment Details</h2>
          <div className="grid sm:grid-cols-2 gap-6 mb-8">
            {/* Capital */}
            <div className="card p-5">
              <label className="text-sm font-medium text-ink mb-3 block">
                Investment Amount (NGN)
              </label>
              <div className="grid grid-cols-2 gap-2">
                {CAPITALS.map(c => (
                  <button key={c} onClick={() => setCapital(c)}
                    className={clsx(
                      'py-2.5 px-3 rounded-xl text-sm font-medium border transition-all',
                      capital === c
                        ? 'bg-brand/10 border-brand text-accent'
                        : 'border-line text-ink-2 hover:border-brand/50 hover:text-ink'
                    )}>
                    ₦{c}
                  </button>
                ))}
              </div>
            </div>

            <div className="card p-5">
              <div className="text-sm font-medium text-ink mb-3">Inference details</div>
              <div className="text-sm text-ink-2">GAT + PPO saved fold: <span className="text-ink">{modelYear}</span></div>
              <div className="text-xs text-ink-3 mt-2">The API uses the most recent point-in-time feature snapshot bundled with the repository.</div>
            </div>
          </div>

          <button onClick={handleOptimise} disabled={loading}
            className="btn-primary px-8 py-3.5">
            {loading ? (
              <><RefreshCw className="w-4 h-4 animate-spin" /> Running GAT + PPO…</>
            ) : (
              <><Brain className="w-4 h-4" /> Optimise Portfolio</>
            )}
          </button>

          {/* Loading bar */}
          {loading && (
            <div className="mt-6 card p-4 space-y-2">
              {['Graph construction (60-day Pearson)', 'GAT attention forward pass', 'PPO weight allocation', 'Risk metrics computation'].map((s, i) => (
                <div key={i} className="flex items-center gap-3 text-xs text-ink-2">
                  <div className="w-3 h-3 rounded-full border-2 border-brand border-t-transparent animate-spin" style={{ animationDelay: `${i * 0.2}s` }} />
                  {s}
                </div>
              ))}
            </div>
          )}
          {error && <div role="alert" className="mt-4 card border border-negative/50 p-4 text-sm text-negative">{error}</div>}
        </div>
      )}

      {/* ── Step 3: Results ───────────────────────────────────────────── */}
      {step === 'result' && result && showResult && (
        <div className="animate-in space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-ink">Your Portfolio Recommendation</h2>
            <button onClick={() => { setStep('profile'); setResult(null); setShowResult(false); }}
              className="btn-ghost text-sm py-2 px-4">
              <RefreshCw className="w-4 h-4" /> Reset
            </button>
          </div>

          {/* Summary cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Signal date', value: result.signal_date, sub: 'Prepared data' },
              { label: 'Eligible assets', value: `${result.eligible_assets}`, sub: 'Point-in-time active' },
              { label: 'Saved fold', value: `${result.model_year}`, sub: 'Annual policy' },
              { label: 'Snapshot age', value: `${result.stale_days} days`, sub: 'Check before use' },
            ].map((m, i) => (
              <div key={i} className="metric-card">
                <div className="text-lg font-bold text-ink">{m.value}</div>
                <div className="text-ink-2 text-xs font-medium">{m.label}</div>
                <div className="text-ink-3 text-[10px]">{m.sub}</div>
              </div>
            ))}
          </div>

          {/* Inference provenance */}
          <div className="card p-5 border-brand/30 border">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="w-4 h-4 text-accent" />
              <span className="text-ink font-semibold text-sm">Model inference</span>
            </div>
            <div className="text-ink-2 text-sm mt-2">Weights are model outputs, not expected returns or guarantees. Input snapshot date: {result.signal_date}.</div>
            <div className="text-ink-3 text-xs mt-2">GAT validation epoch: {result.meta.gat_validation_epoch ?? 'n/a'} · PPO training timesteps: {result.meta.ppo_training_timesteps ?? 'n/a'}</div>
          </div>

          {/* Chart + allocations */}
          <div className="grid lg:grid-cols-5 gap-4">
            {/* Weights */}
            <div className="lg:col-span-2 card p-5">
              <div className="text-sm font-semibold text-ink">Portfolio weights</div>
              <div className="text-xs text-ink-2 mb-3">Share of capital per stock, largest first</div>
              <BarList items={weightItems} rowHeight={26} tipValues xFormat={v => `${v}%`} valueFormat={v => `${v.toFixed(1)}%`}
                tipRows={it => [
                  { color: C.s1, kind: 'rect', label: 'Weight', value: `${it.value.toFixed(1)}%` },
                  { label: 'Amount', value: formatNGN(amount * it.value / 100) },
                ]}
                ariaLabel="Recommended portfolio weights by stock" />
            </div>

            {/* Allocation list */}
            <div className="lg:col-span-3 space-y-2.5">
              <div className="text-sm font-medium text-ink">Stock Allocations</div>
              {result.allocations.map((a, i) => (
                <AllocationBar key={i} alloc={a} amount={amount} />
              ))}
            </div>
          </div>

          <div className="card p-5">
            <div className="text-sm font-medium text-ink mb-3">GAT stock ranking</div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {result.gat_rankings.slice(0, 10).map(item => (
                <div key={item.ticker} className="flex items-center justify-between rounded bg-subtle px-3 py-2 text-sm">
                  <span className="text-ink">{item.rank}. {item.ticker}</span>
                  <span className="text-ink-2">{item.score.toFixed(3)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Methodology note */}
          <div className="card p-4 flex gap-3">
            <Info className="w-4 h-4 text-ink-3 mt-0.5 flex-shrink-0" />
            <div className="text-xs text-ink-2 leading-relaxed">
              <span className="text-ink font-medium">How this works: </span>
              The API loads the selected saved annual GAT/PPO fold and runs it on the most recent prepared repository snapshot. GAT ranks stocks using the training-time rolling correlation graph; PPO returns long-only weights with a 20% cap. This repository snapshot ends in 2025, so the signal is historical and must not be treated as live market advice.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
