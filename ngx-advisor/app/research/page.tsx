'use client';
import { RESEARCH_METRICS, WALK_FORWARD_ANNUAL, COST_SENSITIVITY,
         generateWealthPath, MONTH_LABELS } from '@/lib/data';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  LineChart, Line, Area, AreaChart, ReferenceLine,
} from 'recharts';
import { Award, BookOpen, TrendingUp, Brain, BarChart2, AlertTriangle } from 'lucide-react';

const TOOLTIP_STYLE = {
  contentStyle: { background: '#111e35', border: '1px solid #1e3054', borderRadius: 8, fontSize: 12 },
  labelStyle: { color: '#94a3b8' },
};

const wealthPPO = generateWealthPath(RESEARCH_METRICS.ppo.cagr, 23.98).map((v, i) => ({
  month: MONTH_LABELS[i] ?? '', ppo: +v.toFixed(3),
  mvo:   +generateWealthPath(RESEARCH_METRICS.mvo.cagr, 26.27)[i]?.toFixed(3),
  ew:    +generateWealthPath(RESEARCH_METRICS.ew.cagr,  23.95)[i]?.toFixed(3),
}));

function SectionHeader({ id, label, badge, badgeColor }: {
  id: string; label: string; badge: string; badgeColor: string;
}) {
  return (
    <div id={id} className="mb-8 pt-6">
      <div className={`inline-flex items-center gap-1.5 tag border mb-3 ${badgeColor}`}>{badge}</div>
      <h2 className="text-2xl md:text-3xl font-bold text-white">{label}</h2>
    </div>
  );
}

export default function ResearchPage() {
  const m = RESEARCH_METRICS;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">

      {/* Header */}
      <div className="text-center mb-14">
        <div className="inline-flex items-center gap-2 tag badge-ngx mb-4">
          <Award className="w-3.5 h-3.5" /> Research Results
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-white mb-3">
          Empirical Findings — Progress Report
        </h1>
        <p className="text-slate-400 max-w-2xl mx-auto">
          {m.panel.stocks} NGX equities · {m.panel.years} years ({m.panel.startYear}–{m.panel.endYear}) ·
          {' '}{m.panel.tradingDays.toLocaleString()} trading days · Seven-fold walk-forward validation
        </p>
        <div className="mt-4 flex justify-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 card text-sm text-slate-400">
            <AlertTriangle className="w-4 h-4 text-gold" />
            RQ1 and RQ2 are prototype results (single seed per fold). Final multi-seed evaluation pending.
          </div>
        </div>
      </div>

      {/* ── RQ4 ──────────────────────────────────────────────────────────── */}
      <SectionHeader id="rq4" label="RQ4 — NGX Market Characterisation"
        badge="RQ4 · Complete · Published" badgeColor="badge-ngx" />

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
        {[
          { label: 'Equities Reject Normality', value: '39 / 39', sub: 'JB p < 0.001 for all',     color: 'text-red-400' },
          { label: 'ARCH Volatility Clustering', value: 'Confirmed', sub: 'All stocks, all lags',    color: 'text-gold' },
          { label: 'Illiquid Stocks',            value: '27%',      sub: 'Above 75th pctl Amihud', color: 'text-blue-400' },
          { label: 'Intra-sector Correlation',   value: '0.39',     sub: 'vs 0.16 cross-sector',    color: 'text-ngx-light' },
        ].map((s, i) => (
          <div key={i} className="metric-card">
            <div className={`text-2xl font-extrabold ${s.color}`}>{s.value}</div>
            <div className="text-white text-xs font-semibold mt-1">{s.label}</div>
            <div className="text-slate-500 text-[10px] mt-0.5">{s.sub}</div>
          </div>
        ))}
      </div>

      <div className="card p-5 mb-4 border-ngx/30 border flex gap-4">
        <BookOpen className="w-5 h-5 text-ngx-light mt-0.5 flex-shrink-0" />
        <div>
          <div className="text-white font-semibold text-sm mb-1">
            Published — PMLR Vol. 319 · IndabaX Nigeria 2026
          </div>
          <p className="text-slate-400 text-xs leading-relaxed">
            All five structural NGX properties (non-normality, ARCH clustering, concentrated illiquidity,
            sector block correlation, macro-regime breaks) are confirmed and published.
            These findings motivate every architecture decision in the two-stage framework.
          </p>
        </div>
      </div>

      <div className="divider" />

      {/* ── RQ1 ──────────────────────────────────────────────────────────── */}
      <SectionHeader id="rq1" label="RQ1 — GAT Pre-Selection Performance"
        badge="RQ1 · Prototype · 7 Folds" badgeColor="badge-gold" />

      <div className="grid sm:grid-cols-3 gap-3 mb-6">
        {[
          { model: 'GAT (proposed)',    ic:  0.054, spread: 2.22, color: 'text-ngx-light', bold: true },
          { model: 'Random Forest',     ic:  0.061, spread: 0.82, color: 'text-blue-400',  bold: false },
          { model: 'Momentum baseline', ic: -0.023, spread: 0.93, color: 'text-slate-400', bold: false },
        ].map((r, i) => (
          <div key={i} className={`card p-4 ${r.bold ? 'border-ngx/40 border' : ''}`}>
            <div className="text-xs text-slate-500 mb-2">{r.model}</div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className={`text-xl font-bold ${r.color}`}>{r.ic >= 0 ? '+' : ''}{r.ic.toFixed(3)}</div>
                <div className="text-slate-500 text-[10px]">Mean IC</div>
              </div>
              <div>
                <div className={`text-xl font-bold ${r.color}`}>+{r.spread}%</div>
                <div className="text-slate-500 text-[10px]">Q5 Spread</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* IC chart */}
      <div className="card p-5 mb-4">
        <div className="text-sm font-medium text-white mb-4">Annual IC by Walk-Forward Fold</div>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={WALK_FORWARD_ANNUAL} barSize={18}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e3054" />
            <XAxis dataKey="year" tick={{ fill: '#64748b', fontSize: 11 }} />
            <YAxis tick={{ fill: '#64748b', fontSize: 11 }} tickFormatter={v => v.toFixed(2)} />
            <Tooltip {...TOOLTIP_STYLE} formatter={(v: number) => [v.toFixed(3), 'Spearman IC']} />
            <ReferenceLine y={0} stroke="#64748b" strokeDasharray="4 4" />
          </BarChart>
        </ResponsiveContainer>
        <p className="text-slate-500 text-xs mt-2">
          GAT mean IC = 0.054 across seven folds. Positive average IC with substantial cross-fold variance
          (std ≈ 0.21) confirms need for multi-seed averaging in final evaluation.
        </p>
      </div>

      <div className="divider" />

      {/* ── RQ2 ──────────────────────────────────────────────────────────── */}
      <SectionHeader id="rq2" label="RQ2 — PPO Portfolio Allocation"
        badge="RQ2 · Prototype · 68 Months" badgeColor="badge-gold" />

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {[
          { label: 'PPO Sharpe',    value: m.ppo.sharpe.toFixed(3), sub: '10 bps cost',         color: 'text-ngx-light', note: 'vs MVO 1.024' },
          { label: 'PPO CAGR',      value: `${m.ppo.cagr}%`,        sub: 'Annualised 68 months', color: 'text-gold',       note: 'vs EW 28.9%' },
          { label: 'PPO Turnover',  value: `${m.ppo.turnover}%`,    sub: 'Monthly average',      color: 'text-blue-400',   note: 'vs MVO 39.8%' },
          { label: 'Max Drawdown',  value: `${m.ppo.maxDD}%`,       sub: 'Peak to trough',       color: 'text-red-400',    note: 'vs MVO −20.0%' },
        ].map((s, i) => (
          <div key={i} className="metric-card">
            <div className={`text-2xl font-extrabold ${s.color}`}>{s.value}</div>
            <div className="text-white text-xs font-semibold mt-1">{s.label}</div>
            <div className="text-slate-500 text-[10px]">{s.sub}</div>
            <div className="text-slate-400 text-[10px] mt-0.5 font-medium">{s.note}</div>
          </div>
        ))}
      </div>

      {/* Wealth chart */}
      <div className="card p-5 mb-4">
        <div className="text-sm font-medium text-white mb-4">
          Growth of ₦1 — Pooled 68 Months (10 bps cost)
        </div>
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={wealthPPO}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e3054" />
            <XAxis dataKey="month" tick={{ fill: '#64748b', fontSize: 10 }}
              interval={11} />
            <YAxis tick={{ fill: '#64748b', fontSize: 11 }}
              tickFormatter={v => `${v.toFixed(1)}×`} />
            <Tooltip {...TOOLTIP_STYLE}
              formatter={(v: number) => [`${v.toFixed(2)}×`, '']} />
            <Legend wrapperStyle={{ fontSize: 12, color: '#94a3b8' }} />
            <ReferenceLine y={1} stroke="#1e3054" strokeDasharray="4 4" />
            <Line type="monotone" dataKey="ppo" name="PPO Agent"    stroke="#007B3E" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="mvo" name="Min-Var MVO"  stroke="#ef4444" strokeWidth={1.5} dot={false} strokeDasharray="5 3" />
            <Line type="monotone" dataKey="ew"  name="Equal Weight" stroke="#3b82f6" strokeWidth={1.5} dot={false} strokeDasharray="3 3" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Annual Sharpe chart */}
      <div className="card p-5 mb-4">
        <div className="text-sm font-medium text-white mb-4">Annual Sharpe Ratio by Test Year</div>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={WALK_FORWARD_ANNUAL} barSize={14} barCategoryGap="30%">
            <CartesianGrid strokeDasharray="3 3" stroke="#1e3054" />
            <XAxis dataKey="year" tick={{ fill: '#64748b', fontSize: 11 }} />
            <YAxis tick={{ fill: '#64748b', fontSize: 11 }} />
            <Tooltip {...TOOLTIP_STYLE} formatter={(v: number) => [v.toFixed(2), 'Sharpe']} />
            <Legend wrapperStyle={{ fontSize: 12, color: '#94a3b8' }} />
            <ReferenceLine y={0} stroke="#64748b" />
            <Bar dataKey="ppoSharpe" name="PPO"       fill="#007B3E" radius={[3,3,0,0]} />
            <Bar dataKey="mvoSharpe" name="MVO"       fill="#ef4444" radius={[3,3,0,0]} />
            <Bar dataKey="ewSharpe"  name="EW"        fill="#3b82f6" radius={[3,3,0,0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Cost sensitivity */}
      <div className="card p-5 mb-4">
        <div className="text-sm font-medium text-white mb-1">Transaction Cost Sensitivity</div>
        <p className="text-slate-400 text-xs mb-4">
          PPO Sharpe degrades 2.9 bps per 10-bps cost increment vs MVO at 7.8 bps — reflecting lower turnover.
        </p>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={COST_SENSITIVITY}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e3054" />
            <XAxis dataKey="cost" tick={{ fill: '#64748b', fontSize: 11 }}
              tickFormatter={v => `${v} bps`} />
            <YAxis tick={{ fill: '#64748b', fontSize: 11 }} domain={[0.9, 1.1]}
              tickFormatter={v => v.toFixed(3)} />
            <Tooltip {...TOOLTIP_STYLE} formatter={(v: number) => [v.toFixed(3), 'Sharpe']}
              labelFormatter={(v) => `Cost: ${v} bps`} />
            <Legend wrapperStyle={{ fontSize: 12, color: '#94a3b8' }} />
            <Line type="monotone" dataKey="ppoSharpe" name="PPO"  stroke="#007B3E" strokeWidth={2.5} dot={{ r: 4, fill: '#007B3E' }} />
            <Line type="monotone" dataKey="mvoSharpe" name="MVO"  stroke="#ef4444" strokeWidth={2} dot={{ r: 4, fill: '#ef4444' }} strokeDasharray="5 3" />
            <Line type="monotone" dataKey="ewSharpe"  name="EW"   stroke="#3b82f6" strokeWidth={2} dot={{ r: 4, fill: '#3b82f6' }} strokeDasharray="3 3" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="divider" />

      {/* ── RQ3 ──────────────────────────────────────────────────────────── */}
      <SectionHeader id="rq3" label="RQ3 — Sentiment Analysis (Complete)"
        badge="RQ3 · Complete · Final Finding" badgeColor="badge-blue" />

      <div className="grid sm:grid-cols-3 gap-3 mb-6">
        {[
          { label: 'HAC t-statistic',  value: m.sentiment.tStat.toFixed(3), sub: 'Newey-West estimator', color: 'text-slate-300' },
          { label: 'p-value',          value: `≈ ${m.sentiment.pValue}`,     sub: 'Not significant at 5%', color: 'text-slate-300' },
          { label: '95% CI (annual)',  value: `[−11.7%, +4.8%]`,             sub: 'Spans zero',             color: 'text-slate-300' },
        ].map((s, i) => (
          <div key={i} className="metric-card border-blue-500/30 border">
            <div className={`text-2xl font-extrabold ${s.color}`}>{s.value}</div>
            <div className="text-white text-xs font-semibold mt-1">{s.label}</div>
            <div className="text-slate-500 text-[10px]">{s.sub}</div>
          </div>
        ))}
      </div>

      <div className="card p-5 mb-4">
        <div className="text-sm font-medium text-white mb-2">Sentiment Ablation — 2021 to 2025</div>
        <div className="grid sm:grid-cols-3 gap-4">
          {[
            { label: 'Equal Weight',          cagr: 37.22, sharpe: 1.639, color: '#3b82f6' },
            { label: 'Price-only Momentum',   cagr: 54.02, sharpe: 1.460, color: '#007B3E' },
            { label: 'Momentum + Sentiment',  cagr: 49.01, sharpe: 1.369, color: '#f59e0b' },
          ].map((s, i) => (
            <div key={i} className="card p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-3 h-3 rounded-full" style={{ background: s.color }} />
                <span className="text-white text-xs font-medium">{s.label}</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <div className="text-lg font-bold text-white">{s.cagr.toFixed(1)}%</div>
                  <div className="text-slate-500 text-[10px]">CAGR</div>
                </div>
                <div>
                  <div className="text-lg font-bold text-white">{s.sharpe.toFixed(3)}</div>
                  <div className="text-slate-500 text-[10px]">Sharpe</div>
                </div>
              </div>
            </div>
          ))}
        </div>
        <p className="text-slate-400 text-xs mt-4 leading-relaxed">
          Adding VADER-scored headline sentiment reduces CAGR by 5.0 percentage points and increases
          portfolio turnover (0.493 vs 0.431 monthly). This is the first systematic empirical test
          of news sentiment predictability for an African frontier equity market.
        </p>
      </div>
    </div>
  );
}
