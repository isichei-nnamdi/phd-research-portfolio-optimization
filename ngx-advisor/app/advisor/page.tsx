'use client';
import { useState } from 'react';
import { Brain, TrendingUp, Shield, Zap, ArrowRight, Info, CheckCircle2,
         BarChart2, RefreshCw, AlertCircle } from 'lucide-react';
import { PORTFOLIO_PROFILES, NGX_STOCKS, type Allocation } from '@/lib/data';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import clsx from 'clsx';

type Profile = 'conservative' | 'moderate' | 'aggressive';
type Step = 'profile' | 'capital' | 'result';

const PROFILE_CONFIG = {
  conservative: {
    icon: Shield, color: 'border-blue-500', bg: 'bg-blue-500/10',
    iconColor: 'text-blue-400', label: 'Conservative',
    tagline: 'Stable returns with downside protection',
  },
  moderate: {
    icon: TrendingUp, color: 'border-ngx', bg: 'bg-ngx/10',
    iconColor: 'text-ngx-light', label: 'Moderate',
    tagline: 'Balanced risk-return with diversification',
  },
  aggressive: {
    icon: Zap, color: 'border-gold', bg: 'bg-gold/10',
    iconColor: 'text-gold', label: 'Aggressive',
    tagline: 'High-momentum top-quintile GAT selections',
  },
};

const SLICE_COLORS = ['#007B3E','#3b82f6','#f59e0b','#8b5cf6','#ef4444','#06b6d4'];

const CAPITALS = ['100,000','500,000','1,000,000','5,000,000','10,000,000'];
const HORIZONS = ['Less than 1 year','1 to 3 years','3 to 5 years','5 or more years'];

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
  const [profile, setProfile]     = useState<Profile | null>(null);
  const [capital, setCapital]     = useState('1,000,000');
  const [horizon, setHorizon]     = useState('3 to 5 years');
  const [loading, setLoading]     = useState(false);
  const [showResult, setShowResult] = useState(false);

  const amount = parseInt(capital.replace(/,/g, ''), 10) || 1_000_000;

  function handleOptimise() {
    setLoading(true);
    setTimeout(() => { setLoading(false); setShowResult(true); setStep('result'); }, 2200);
  }

  const portfolio = profile ? PORTFOLIO_PROFILES[profile] : null;

  const pieData = portfolio?.allocations.map((a, i) => ({
    name: a.symbol, value: Math.round(a.weight * 100),
    fill: SLICE_COLORS[i % SLICE_COLORS.length],
  })) ?? [];

  const expectedFV = portfolio ? amount * Math.pow(1 + portfolio.expectedReturn / 100, 3) : 0;

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
          The two-stage GAT and PPO framework selects from the NGX-30 universe
          and allocates weights optimised for your risk profile.
        </p>
      </div>

      {/* Disclaimer */}
      <div className="card p-4 mb-8 flex gap-3">
        <AlertCircle className="w-4 h-4 text-gold mt-0.5 flex-shrink-0" />
        <p className="text-xs text-slate-400 leading-relaxed">
          <span className="text-gold font-medium">Research prototype.</span>{' '}
          Recommendations are generated from prototype walk-forward results (2019–2025).
          This tool is for academic demonstration only and does not constitute financial advice.
        </p>
      </div>

      {/* ── Step 1: Profile ────────────────────────────────────────────── */}
      {step === 'profile' && (
        <div className="animate-in">
          <h2 className="text-lg font-semibold text-white mb-5">Step 1 — Select Your Risk Profile</h2>
          <div className="grid sm:grid-cols-3 gap-4 mb-8">
            {(Object.entries(PROFILE_CONFIG) as [Profile, typeof PROFILE_CONFIG['conservative']][]).map(([key, cfg]) => (
              <button key={key} onClick={() => setProfile(key)}
                className={clsx(
                  'card-glow p-5 text-left transition-all duration-200 cursor-pointer',
                  profile === key ? `${cfg.color} border-2` : 'border border-slate-border'
                )}>
                <div className={`w-10 h-10 rounded-xl ${cfg.bg} flex items-center justify-center mb-4`}>
                  <cfg.icon className={`w-5 h-5 ${cfg.iconColor}`} />
                </div>
                <div className="font-bold text-white mb-1">{cfg.label}</div>
                <div className="text-slate-400 text-xs leading-relaxed">{cfg.tagline}</div>
                {profile === key && (
                  <div className="mt-3 flex items-center gap-1.5 text-ngx-light text-xs font-medium">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Selected
                  </div>
                )}
              </button>
            ))}
          </div>
          <button onClick={() => profile && setStep('capital')} disabled={!profile}
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
            ← Back to risk profile
          </button>
          <h2 className="text-lg font-semibold text-white mb-5">Step 2 — Investment Details</h2>
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

            {/* Horizon */}
            <div className="card p-5">
              <label className="text-sm font-medium text-white mb-3 block">
                Investment Horizon
              </label>
              <div className="grid grid-cols-1 gap-2">
                {HORIZONS.map(h => (
                  <button key={h} onClick={() => setHorizon(h)}
                    className={clsx(
                      'py-2.5 px-3 rounded-xl text-sm text-left font-medium border transition-all',
                      horizon === h
                        ? 'bg-ngx/20 border-ngx text-ngx-light'
                        : 'border-slate-border text-slate-400 hover:border-ngx/50 hover:text-white'
                    )}>
                    {h}
                  </button>
                ))}
              </div>
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
        </div>
      )}

      {/* ── Step 3: Results ───────────────────────────────────────────── */}
      {step === 'result' && portfolio && showResult && (
        <div className="animate-in space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">Your Portfolio Recommendation</h2>
            <button onClick={() => { setStep('profile'); setProfile(null); setShowResult(false); }}
              className="btn-secondary text-sm py-2 px-4">
              <RefreshCw className="w-4 h-4" /> Reset
            </button>
          </div>

          {/* Summary cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Expected Return', value: `${portfolio.expectedReturn.toFixed(1)}%`, sub: 'Annualised', color: 'text-ngx-light' },
              { label: 'Expected Vol.',   value: `${portfolio.expectedVol.toFixed(1)}%`,    sub: 'Annualised', color: 'text-blue-400' },
              { label: 'Sharpe Ratio',    value: portfolio.sharpe.toFixed(2),               sub: 'Risk-adjusted', color: 'text-gold' },
              { label: 'Max Drawdown',    value: `${portfolio.maxDD.toFixed(1)}%`,          sub: 'Worst peak-to-trough', color: 'text-red-400' },
            ].map((m, i) => (
              <div key={i} className="metric-card">
                <div className={`metric-value text-2xl ${m.color}`}>{m.value}</div>
                <div className="text-white text-xs font-medium">{m.label}</div>
                <div className="text-slate-500 text-[10px]">{m.sub}</div>
              </div>
            ))}
          </div>

          {/* Projected value */}
          <div className="card p-5 border-ngx/30 border">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="w-4 h-4 text-ngx-light" />
              <span className="text-white font-semibold text-sm">Projected 3-Year Value</span>
            </div>
            <div className="text-3xl font-extrabold text-ngx-light">{formatNGN(expectedFV)}</div>
            <div className="text-slate-400 text-xs mt-1">
              From initial investment of {formatNGN(amount)}, assuming {portfolio.expectedReturn.toFixed(1)}% annual return.
              Research prototype — not a guarantee.
            </div>
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
              {portfolio.allocations.map((a, i) => (
                <AllocationBar key={i} alloc={a} amount={amount} idx={i} />
              ))}
            </div>
          </div>

          {/* Methodology note */}
          <div className="card p-4 flex gap-3">
            <Info className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" />
            <div className="text-xs text-slate-400 leading-relaxed">
              <span className="text-blue-300 font-medium">How this works: </span>
              The GAT scans the NGX-30 universe using a rolling 60-day correlation graph and selects
              the top-quintile stocks by predicted next-month rank. The PPO agent allocates weights
              to minimise turnover and maximise risk-adjusted return. Results shown are based on
              prototype walk-forward evaluation across 7 annual folds (2019 to 2025), 68 out-of-sample months.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
