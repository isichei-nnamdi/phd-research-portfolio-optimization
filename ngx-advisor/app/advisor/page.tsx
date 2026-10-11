'use client';
import { useState } from 'react';
import { Brain, TrendingUp, ArrowRight, Info, RefreshCw, AlertCircle } from 'lucide-react';
import { NGX_STOCKS, type Allocation } from '@/lib/data';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';
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

const SLICE_COLORS = ['#007B3E','#3b82f6','#f59e0b','#8b5cf6','#ef4444','#06b6d4'];

const CAPITALS = ['100,000','500,000','1,000,000','5,000,000','10,000,000'];
function formatNGN(val: number) {
  if (val >= 1_000_000) return `₦${(val / 1_000_000).toFixed(2)}M`;
  if (val >= 1_000)     return `₦${(val / 1_000).toFixed(0)}K`;
  return `₦${val}`;
}

function StockBadge({ symbol }: { symbol: string }) {
  const stock = NGX_STOCKS.find(s => s.symbol === symbol);
  return (
    <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full
                    bg-slate-card border border-slate-border text-xs text-white">
      <span className="w-1.5 h-1.5 rounded-full bg-ngx-light" />
      {symbol}
    </div>
  );
}

function AllocationBar({ alloc, amount, idx }: { alloc: Allocation; amount: number; idx: number }) {
  const stock = NGX_STOCKS.find(s => s.symbol === alloc.symbol);
  const pct   = Math.round(alloc.weight * 100);
  const naira = formatNGN(amount * alloc.weight);

  return (
    <div className="p-4 card">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full" style={{ background: SLICE_COLORS[idx % SLICE_COLORS.length] }} />
          <span className="font-semibold text-white text-sm">{alloc.symbol}</span>
          <span className="text-slate-400 text-xs hidden sm:block">{stock?.name}</span>
        </div>
        <div className="text-right">
          <div className="text-white font-bold text-sm">{pct}%</div>
          <div className="text-slate-400 text-xs">{naira}</div>
        </div>
      </div>
      {/* Weight bar */}
      <div className="h-1.5 bg-slate-border rounded-full overflow-hidden mb-2">
        <div className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, background: SLICE_COLORS[idx % SLICE_COLORS.length] }} />
      </div>
      {/* Rationale */}
      <p className="text-slate-400 text-xs leading-relaxed">{alloc.rationale}</p>
      {/* Mini stats */}
      {stock && (
        <div className="flex gap-3 mt-2">
          <div className="text-[10px] text-slate-500">Ann. Return <span className="text-white">{stock.annReturn.toFixed(1)}%</span></div>
          <div className="text-[10px] text-slate-500">Vol <span className="text-white">{stock.annVol.toFixed(1)}%</span></div>
          <div className="text-[10px] text-slate-500">Sharpe <span className="text-white">{stock.sharpe.toFixed(2)}</span></div>
          <div className="text-[10px] text-slate-500">Beta <span className="text-white">{stock.beta.toFixed(2)}</span></div>
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

  const pieData = result?.allocations.map((a, i) => ({
    name: a.symbol, value: Math.round(a.weight * 100),
    fill: SLICE_COLORS[i % SLICE_COLORS.length],
  })) ?? [];

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">

      {/* Header */}
      <div className="text-center mb-10">
        <div className="inline-flex items-center gap-2 tag badge-ngx mb-4">
          <Brain className="w-3.5 h-3.5" /> GAT + PPO Engine
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-white mb-3">
          Portfolio Recommendation
        </h1>
        <p className="text-slate-400 max-w-xl mx-auto">
          Run a saved annual GAT ranking and PPO allocation policy against the latest prepared repository snapshot.
        </p>
      </div>

      {/* Disclaimer */}
      <div className="card p-4 mb-8 flex gap-3">
        <AlertCircle className="w-4 h-4 text-gold mt-0.5 flex-shrink-0" />
        <p className="text-xs text-slate-400 leading-relaxed">
          <span className="text-gold font-medium">Research prototype.</span>{' '}
          Recommendations are generated from prototype walk-forward results (2019 to 2025).
          This tool is for academic demonstration only and does not constitute financial advice.
        </p>
      </div>

      {/* ── Step 1: Model fold ─────────────────────────────────────────── */}
      {step === 'profile' && (
        <div className="animate-in">
          <h2 className="text-lg font-semibold text-white mb-2">Step 1: Select a saved annual model fold</h2>
          <p className="text-sm text-slate-400 mb-5">Each fold was trained only on data available before its held-out year. Choose the policy vintage to apply to the current prepared snapshot.</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 mb-8">
            {Array.from({ length: 7 }, (_, index) => 2019 + index).map(year => (
              <button key={year} onClick={() => setModelYear(year)}
                className={clsx('card p-4 text-left transition-colors', modelYear === year ? 'border-2 border-ngx bg-ngx/10' : 'border border-slate-border hover:border-ngx/50')}>
                <div className="text-lg font-bold text-white">{year}</div>
                <div className="text-[11px] text-slate-400">{year === 2025 ? 'Latest fold' : `Test fold ${year}`}</div>
                {modelYear === year && <div className="mt-2 text-[10px] text-ngx-light">Selected</div>}
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
            className="text-sm text-slate-400 hover:text-white mb-6 flex items-center gap-1.5 transition-colors">
            ← Back to model fold
          </button>
          <h2 className="text-lg font-semibold text-white mb-5">Step 2 - Investment Details</h2>
          <div className="grid sm:grid-cols-2 gap-6 mb-8">
            {/* Capital */}
            <div className="card p-5">
              <label className="text-sm font-medium text-white mb-3 block">
                Investment Amount (NGN)
              </label>
              <div className="grid grid-cols-2 gap-2">
                {CAPITALS.map(c => (
                  <button key={c} onClick={() => setCapital(c)}
                    className={clsx(
                      'py-2.5 px-3 rounded-xl text-sm font-medium border transition-all',
                      capital === c
                        ? 'bg-ngx/20 border-ngx text-ngx-light'
                        : 'border-slate-border text-slate-400 hover:border-ngx/50 hover:text-white'
                    )}>
                    ₦{c}
                  </button>
                ))}
              </div>
            </div>

            <div className="card p-5">
              <div className="text-sm font-medium text-white mb-3">Inference details</div>
              <div className="text-sm text-slate-400">GAT + PPO saved fold: <span className="text-white">{modelYear}</span></div>
              <div className="text-xs text-slate-500 mt-2">The API uses the most recent point-in-time feature snapshot bundled with the repository.</div>
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
                <div key={i} className="flex items-center gap-3 text-xs text-slate-400">
                  <div className="w-3 h-3 rounded-full border-2 border-ngx border-t-transparent animate-spin" style={{ animationDelay: `${i * 0.2}s` }} />
                  {s}
                </div>
              ))}
            </div>
          )}
          {error && <div role="alert" className="mt-4 card border border-red-500/50 p-4 text-sm text-red-300">{error}</div>}
        </div>
      )}

      {/* ── Step 3: Results ───────────────────────────────────────────── */}
      {step === 'result' && result && showResult && (
        <div className="animate-in space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">Your Portfolio Recommendation</h2>
            <button onClick={() => { setStep('profile'); setResult(null); setShowResult(false); }}
              className="btn-secondary text-sm py-2 px-4">
              <RefreshCw className="w-4 h-4" /> Reset
            </button>
          </div>

          {/* Summary cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Signal date', value: result.signal_date, sub: 'Prepared data', color: 'text-ngx-light' },
              { label: 'Eligible assets', value: `${result.eligible_assets}`, sub: 'Point-in-time active', color: 'text-blue-400' },
              { label: 'Saved fold', value: `${result.model_year}`, sub: 'Annual policy', color: 'text-gold' },
              { label: 'Snapshot age', value: `${result.stale_days} days`, sub: 'Check before use', color: 'text-red-400' },
            ].map((m, i) => (
              <div key={i} className="metric-card">
                <div className={`metric-value text-lg ${m.color}`}>{m.value}</div>
                <div className="text-white text-xs font-medium">{m.label}</div>
                <div className="text-slate-500 text-[10px]">{m.sub}</div>
              </div>
            ))}
          </div>

          {/* Inference provenance */}
          <div className="card p-5 border-ngx/30 border">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="w-4 h-4 text-ngx-light" />
              <span className="text-white font-semibold text-sm">Model inference</span>
            </div>
            <div className="text-slate-300 text-sm mt-2">Weights are model outputs, not expected returns or guarantees. Input snapshot date: {result.signal_date}.</div>
            <div className="text-slate-500 text-xs mt-2">GAT validation epoch: {result.meta.gat_validation_epoch ?? 'n/a'} · PPO training timesteps: {result.meta.ppo_training_timesteps ?? 'n/a'}</div>
          </div>

          {/* Chart + allocations */}
          <div className="grid lg:grid-cols-5 gap-4">
            {/* Pie chart */}
            <div className="lg:col-span-2 card p-5 flex flex-col items-center">
              <div className="text-sm font-medium text-white mb-3">Portfolio Weights</div>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={55} outerRadius={90}
                       dataKey="value" paddingAngle={2} stroke="none">
                    {pieData.map((entry, i) => (
                      <Cell key={i} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ background: '#111e35', border: '1px solid #1e3054', borderRadius: 8 }}
                    formatter={(v: number) => [`${v}%`, 'Weight']}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-wrap gap-2 justify-center mt-2">
                {pieData.map((d, i) => (
                  <div key={i} className="flex items-center gap-1.5 text-xs text-slate-400">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ background: d.fill }} />
                    {d.name}
                  </div>
                ))}
              </div>
            </div>

            {/* Allocation list */}
            <div className="lg:col-span-3 space-y-2.5">
              <div className="text-sm font-medium text-white">Stock Allocations</div>
              {result.allocations.map((a, i) => (
                <AllocationBar key={i} alloc={a} amount={amount} idx={i} />
              ))}
            </div>
          </div>

          <div className="card p-5">
            <div className="text-sm font-medium text-white mb-3">GAT stock ranking</div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {result.gat_rankings.slice(0, 10).map(item => (
                <div key={item.ticker} className="flex items-center justify-between rounded bg-slate-card px-3 py-2 text-sm">
                  <span className="text-white">{item.rank}. {item.ticker}</span>
                  <span className="text-slate-400">{item.score.toFixed(3)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Methodology note */}
          <div className="card p-4 flex gap-3">
            <Info className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" />
            <div className="text-xs text-slate-400 leading-relaxed">
              <span className="text-blue-300 font-medium">How this works: </span>
              The API loads the selected saved annual GAT/PPO fold and runs it on the most recent prepared repository snapshot. GAT ranks stocks using the training-time rolling correlation graph; PPO returns long-only weights with a 20% cap. This repository snapshot ends in 2025, so the signal is historical and must not be treated as live market advice.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
