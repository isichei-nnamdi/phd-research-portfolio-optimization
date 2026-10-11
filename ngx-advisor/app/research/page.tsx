'use client';
import { useMemo, useState } from 'react';
import { Award, BookOpen, AlertTriangle } from 'lucide-react';
import { RESEARCH_METRICS } from '@/lib/data';
import { RESEARCH } from '@/lib/researchData';
import { C, ChartCard, FigureHeader, Legend, Series, fmt } from '@/components/charts/core';
import { LineChart } from '@/components/charts/LineChart';
import { ColumnChart } from '@/components/charts/ColumnChart';
import { BarList } from '@/components/charts/BarList';
import { Histogram } from '@/components/charts/Histogram';
import { Heatmap, DivergingLegend } from '@/components/charts/Heatmap';

/* ── Helpers ─────────────────────────────────────────────────────────────── */
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const monthLabel = (ym: string) => `${MONTHS[+ym.slice(5, 7) - 1]} ${ym.slice(0, 4)}`;
const dateLabel = (d: string) => `${+d.slice(8, 10)} ${MONTHS[+d.slice(5, 7) - 1]} ${d.slice(0, 4)}`;
const fracYear = (d: string) => {
  const y = +d.slice(0, 4);
  return y + (Date.UTC(y, +d.slice(5, 7) - 1, +d.slice(8, 10)) - Date.UTC(y, 0, 1)) / (365.25 * 864e5);
};
/** Adds a numeric time coordinate (end of month, in years) so gaps between folds stay true to time. */
const withT = <T extends { month: string }>(rows: T[]) =>
  rows.map(r => ({ ...r, t: +r.month.slice(0, 4) + +r.month.slice(5, 7) / 12 }));
const yearTicks = (from: number, to: number) =>
  Array.from({ length: to - from + 1 }, (_, i) => ({ value: from + i, label: String(from + i) }));
const naira = (v: number) => `₦${v.toLocaleString('en', { maximumFractionDigits: 0 })}`;

/* Series identities - fixed across the page so each strategy keeps its colour. */
const PPO_SERIES: Series[] = [
  { key: 'ppo', label: 'PPO agent', color: C.s1 },
  { key: 'mvo', label: 'Min-variance MVO', color: C.s2 },
  { key: 'ew',  label: 'Equal weight', color: C.s3 },
];
const MODEL_SERIES: Series[] = [
  { key: 'gat', label: 'GAT (proposed)', color: C.s1 },
  { key: 'rf',  label: 'Random Forest', color: C.s2 },
  { key: 'mom', label: 'Momentum', color: C.s3 },
];
const SENT_SERIES: Series[] = [
  { key: 'mom',  label: 'Price-only momentum', color: C.s1 },
  { key: 'sent', label: 'Momentum + sentiment', color: C.s3 },
  { key: 'ew',   label: 'Equal weight', color: C.s2 },
];
const legendOf = (s: Series[], kind: 'line' | 'rect' = 'line') => <Legend items={s.map(x => ({ label: x.label, color: x.color, kind }))} />;

/* ── Layout pieces ───────────────────────────────────────────────────────── */
function SectionHeader({ id, rq, title, status, children }: {
  id: string; rq: string; title: string; status: string; children?: React.ReactNode;
}) {
  return (
    <div id={id} className="scroll-mt-24 pt-4 mb-6">
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <span className="tag tag-brand">{rq}</span>
        <span className="tag tag-neutral">{status}</span>
      </div>
      <h2 className="section-title">{title}</h2>
      {children && <p className="section-sub">{children}</p>}
    </div>
  );
}

function StatGrid({ items }: { items: { label: string; value: string; sub: string; note?: string }[] }) {
  return (
    <div className={`grid gap-3 mb-2 sm:grid-cols-2 ${items.length === 3 ? 'lg:grid-cols-3' : 'lg:grid-cols-4'}`}>
      {items.map(s => (
        <div key={s.label} className="metric-card">
          <div className="text-xs font-medium text-ink-2">{s.label}</div>
          <div className="text-2xl font-bold text-ink mt-1">{s.value}</div>
          <div className="text-[11px] text-ink-3">{s.sub}</div>
          {s.note && <div className="text-[11px] font-medium text-ink-2 mt-0.5">{s.note}</div>}
        </div>
      ))}
    </div>
  );
}

/* ── Figure 4.3: three stacked panels sharing one crosshair ──────────────── */
function MacroPanels() {
  const { series, regimes, top5 } = RESEARCH.macro;
  const [hover, setHover] = useState<number | null>(null);
  const rows = useMemo(() => series.map(r => ({ ...r, t: fracYear(r.date) })), [series]);
  const xTicks = [2012, 2014, 2016, 2018, 2020, 2022, 2024, 2026].map(v => ({ value: v, label: String(v) }));
  const bands = regimes.map(r => ({ x0: fracYear(r.start), x1: fracYear(r.end), label: r.label }));
  const plain = bands.map(b => ({ ...b, label: undefined }));
  const common = { data: rows, xKey: 't', xTicks, xDomain: [2012, 2026] as [number, number], hover, onHover: setHover, tipTitle: (d: Record<string, unknown>) => `Week ending ${dateLabel(String(d.date))}` };
  const fmtAll = (d: Record<string, unknown>) =>
    `Vol ${d.vol == null ? 'n/a' : `${d.vol}%`} · Brent $${Number(d.brent).toFixed(0)} · ${naira(Number(d.ngn))}/USD`;

  return (
    <ChartCard eyebrow="Figure 4.3"
      title="NGX volatility clustering against macroeconomic regimes, 2012 to 2025"
      subtitle="Three panels share one time axis; hover any panel to read all three series for that week. Shaded spans mark stress regimes."
      legend={<Legend items={[{ label: 'Stress regime', color: 'color-mix(in oklab, var(--mark-neg) 28%, rgb(var(--surface)))', kind: 'rect' }]} />}
      table={{
        columns: ['Week ending', 'NGX 60-day vol (%)', 'Brent (USD/bbl)', 'NGN per USD'],
        rows: series.filter((_, i) => i % 4 === 0).map(r => [r.date, r.vol ?? 'n/a', r.brent?.toFixed(2) ?? 'n/a', r.ngn?.toFixed(1) ?? 'n/a']),
      }}
      caption={`Panel (a) averages the 60-day annualised volatility of the five most liquid equities (${top5.join(', ')}). Volatility spikes coincide with the oil-price collapse (2015 to 2016), the COVID-19 shock (2020) and the Naira unification crisis (2022 to 2024). Table shows every fourth week.`}>
      <div className="space-y-4">
        <div>
          <div className="mb-1 text-xs font-semibold text-ink-2">(a) NGX average rolling volatility, annualised %</div>
          <LineChart {...common} series={[{ key: 'vol', label: 'NGX 60-day volatility', color: C.s2 }]} area bands={bands}
            height={210} showXAxis={false} yFormat={v => `${v}%`} valueFormat={fmt.pct(1)} tipNote={d => fmtAll(d)}
            ariaLabel="Average 60-day rolling volatility of the five most liquid NGX equities, 2012 to 2025" />
        </div>
        <div>
          <div className="mb-1 text-xs font-semibold text-ink-2">(b) Brent crude oil price, USD per barrel</div>
          <LineChart {...common} series={[{ key: 'brent', label: 'Brent crude', color: C.s3 }]} area bands={plain}
            height={170} showXAxis={false} yFormat={v => `$${v}`} valueFormat={v => `$${v.toFixed(2)}`} tipNote={d => fmtAll(d)}
            ariaLabel="Brent crude oil price in US dollars, 2012 to 2025" />
        </div>
        <div>
          <div className="mb-1 text-xs font-semibold text-ink-2">(c) NGN/USD official exchange rate, naira per dollar</div>
          <LineChart {...common} series={[{ key: 'ngn', label: 'NGN per USD', color: C.s1 }]} area bands={plain}
            height={190} yFormat={v => fmt.compact(v)} valueFormat={naira} tipNote={d => fmtAll(d)}
            ariaLabel="Official naira to US dollar exchange rate, 2012 to 2025" />
        </div>
      </div>
    </ChartCard>
  );
}

/* ── Page ────────────────────────────────────────────────────────────────── */
export default function ResearchPage() {
  const m = RESEARCH_METRICS;
  const R = RESEARCH;
  const markets = R.returns.markets;
  const gatSum = R.gat.summary;
  const models = MODEL_SERIES.map(s => ({ ...s, ...gatSum[s.key as keyof typeof gatSum] }));
  const liq = R.liquidity;
  const jbOutliers = R.returns.jarqueBera.filter(d => d.jb > 1000);
  const jbShown = R.returns.jarqueBera.filter(d => d.jb <= 1000);
  const zeroTop = liq.zeroVolume.slice(0, 20);
  const ppoWealth = withT(R.ppo.wealth);
  const sentWealth = withT(R.sentiment.wealth);
  const covTier = (c: number) => (c >= 42 ? 'Adequate (≥42%)' : c >= 20 ? 'Moderate (20 to 42%)' : 'Sparse (<20%)');
  const tierColor: Record<string, string> = {
    'Sparse (<20%)': 'color-mix(in oklab, var(--s1) 45%, var(--mark-muted))',
    'Moderate (20 to 42%)': 'color-mix(in oklab, var(--s1) 72%, var(--mark-muted))',
    'Adequate (≥42%)': 'var(--s1)',
  };
  const ablation = R.sentiment.ablation;
  const ablColor: Record<string, string> = { price_only_momentum: C.s1, momentum_plus_sentiment: C.s3, equal_weight: C.s2 };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">

      {/* Header */}
      <div className="text-center mb-10">
        <div className="tag tag-brand mb-4"><Award className="w-3.5 h-3.5" /> Research Results</div>
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-ink mb-3">
          Empirical Findings
        </h1>
        <p className="text-ink-2 max-w-2xl mx-auto">
          {m.panel.stocks} NGX equities · {m.panel.years} years ({m.panel.startYear} to {m.panel.endYear}) ·{' '}
          {m.panel.tradingDays.toLocaleString()} trading days · Seven-fold walk-forward validation
        </p>
        <div className="mt-5 inline-flex items-start gap-2 rounded-xl border border-line bg-surface px-4 py-2.5 text-left text-sm text-ink-2">
          <AlertTriangle className="w-4 h-4 text-ink-3 mt-0.5 shrink-0" />
          RQ1 and RQ2 are prototype results (single seed per fold). Final multi-seed evaluation pending.
        </div>
      </div>

      {/* In-page navigation */}
      <nav className="sticky top-16 z-30 -mx-4 mb-8 flex gap-2 overflow-x-auto border-b border-line bg-canvas/90 px-4 py-3 backdrop-blur-md sm:mx-0 sm:justify-center sm:rounded-xl sm:border">
        {[['rq4', 'RQ4 · Market'], ['rq1', 'RQ1 · GAT'], ['rq2', 'RQ2 · PPO'], ['rq3', 'RQ3 · Sentiment']].map(([id, label]) => (
          <a key={id} href={`#${id}`} className="whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium text-ink-2 hover:bg-subtle hover:text-ink">{label}</a>
        ))}
      </nav>

      {/* ── RQ4 ──────────────────────────────────────────────────────────── */}
      <SectionHeader id="rq4" rq="RQ4" status="Complete · Published" title="NGX Market Characterisation">
        Five structural properties of the Nigerian market motivate every design decision in the two-stage framework.
      </SectionHeader>

      <StatGrid items={[
        { label: 'Equities rejecting normality', value: '39 / 39', sub: 'Jarque-Bera p < 0.001 for all' },
        { label: 'ARCH volatility clustering',   value: 'Confirmed', sub: 'All stocks, all lags' },
        { label: 'Illiquid stocks',              value: '27%', sub: 'Above 75th percentile volume CoV' },
        { label: 'Intra-sector correlation',     value: '0.39', sub: 'vs 0.16 cross-sector' },
      ]} />

      <div className="card p-5 mt-4 flex gap-4 border-l-4 border-l-brand">
        <BookOpen className="w-5 h-5 text-accent mt-0.5 shrink-0" />
        <div>
          <div className="text-ink font-semibold text-sm mb-1">Published - PMLR Vol. 319 · IndabaX Nigeria 2026</div>
          <p className="text-ink-2 text-xs leading-relaxed">
            All five structural NGX properties (non-normality, ARCH clustering, concentrated illiquidity,
            sector block correlation, macro-regime breaks) are confirmed and published.
          </p>
        </div>
      </div>

      <FigureHeader num="4.1" title="Return distribution analysis">
        NGX daily returns are fat-tailed and non-normal, yet the market delivered a far higher risk-adjusted return than global benchmarks.
      </FigureHeader>
      <div className="grid gap-4 lg:grid-cols-5">
        <ChartCard className="lg:col-span-3" eyebrow="Figure 4.1a"
          title="Pooled daily returns vs a normal fit"
          subtitle={`${m.panel.stocks} stocks, 2012 to 2025 · skewness ${R.returns.pooledStats.skew} · excess kurtosis ${R.returns.pooledStats.kurt}`}
          legend={<Legend items={[{ label: 'Empirical density', color: C.s2, kind: 'rect' }, { label: 'Normal fit', color: C.s1 }]} />}
          table={{ columns: ['Bin (%)', 'Density', 'Normal fit', 'Observations'], rows: R.returns.histogram.filter(b => b.count > 0).map(b => [`${b.x0} to ${b.x1}`, b.density.toFixed(4), b.normal.toFixed(4), b.count]) }}
          caption="The spike at 0% reflects frequent zero-return (no-trade) days, a liquidity signature of the NGX. Bins are 0.25 percentage points wide.">
          <Histogram bins={R.returns.histogram} xTicks={[-15, -10, -5, 0, 5, 10, 15]} height={280}
            ariaLabel="Histogram of pooled daily NGX returns with a fitted normal curve" />
        </ChartCard>
        <ChartCard className="lg:col-span-2" eyebrow="Figure 4.1c"
          title="NGX vs global benchmarks"
          subtitle="Annualised Sharpe ratio, zero risk-free rate, 2012 to 2025"
          table={{ columns: ['Market', 'Sharpe', 'Ann. return (%)', 'Ann. volatility (%)'], rows: markets.map(x => [x.market, x.sharpe.toFixed(2), x.ret, x.vol]) }}>
          <ColumnChart height={280} maxBar={40}
            categories={markets.map(x => ({ key: x.market, label: x.market.replace(' (Composite)', '') }))}
            series={[{ key: 'sharpe', label: 'Sharpe ratio', color: C.muted }]}
            value={i => markets[i].sharpe}
            colorFor={i => (i === 0 ? C.s1 : C.muted)}
            capLabel={i => markets[i].sharpe.toFixed(2)}
            yFormat={fmt.n(1)} valueFormat={fmt.n(3)}
            tipNote={i => `Return ${markets[i].ret}% · Volatility ${markets[i].vol}%`}
            ariaLabel="Sharpe ratio: NGX 1.57, S&P 500 0.80, MSCI EM 0.33" />
        </ChartCard>
      </div>
      <ChartCard className="mt-4" eyebrow="Figure 4.1b"
        title="Jarque-Bera normality test by stock"
        subtitle={`JB statistic in thousands. All 39 equities reject normality at the 1% level. As in the thesis figure, the two extreme outliers ${jbOutliers.map(d => `${d.symbol} (JB ≈ ${fmt.compact(d.jb * 1000)})`).join(' and ')} are left out of the plot; the table view lists all 39.`}
        table={{ columns: ['Stock', 'JB (×1000)', 'Skewness', 'Excess kurtosis'], rows: R.returns.jarqueBera.map(d => [d.symbol, d.jb, d.skew, d.kurt]) }}
        caption="Among the plotted stocks, ETI and AIRTELAFRI show the most extreme departures from normality, driven by large single-day price moves.">
        <BarList rowHeight={15} xLabel="Jarque-Bera statistic (×1000)" xFormat={v => `${v}`} valueFormat={fmt.n(2)}
          items={jbShown.map(d => ({ label: d.symbol, value: d.jb, color: C.s2 }))}
          tipRows={it => {
            const d = R.returns.jarqueBera.find(j => j.symbol === it.label)!;
            return [
              { color: C.s2, kind: 'rect', label: 'JB statistic (×1000)', value: d.jb.toFixed(2) },
              { label: 'Skewness', value: d.skew.toFixed(3) },
              { label: 'Excess kurtosis', value: d.kurt.toFixed(2) },
            ];
          }}
          ariaLabel="Horizontal bar chart of Jarque-Bera statistics for 39 NGX equities" />
      </ChartCard>

      <FigureHeader num="4.2" title="Return correlation matrix with sector blocks">
        Stocks correlate more strongly within their own sector, which is why the GAT builds its graph from rolling correlations.
      </FigureHeader>
      <ChartCard eyebrow="Figure 4.2"
        title="Pearson correlation of daily returns, 39 NGX equities, 2012 to 2025"
        subtitle="Outlined squares mark sector blocks. Hover a cell to read the pair and its correlation."
        legend={<DivergingLegend />}
        table={{ columns: ['Stock', ...R.correlation.symbols], rows: R.correlation.matrix.map((row, i) => [R.correlation.symbols[i], ...row.map(v => (v == null ? '' : v.toFixed(2)))]) }}
        caption="Intra-sector mean ρ = 0.39; cross-sector mean ρ = 0.16 (as published). The Financial block shows the strongest co-movement.">
        <Heatmap symbols={R.correlation.symbols} matrix={R.correlation.matrix} sectors={R.correlation.sectors}
          ariaLabel="Correlation heatmap of 39 NGX equities grouped by sector" />
      </ChartCard>

      <FigureHeader num="4.3" title="Macroeconomic regimes and volatility clustering" />
      <MacroPanels />

      <FigureHeader num="4.4" title="Liquidity profile: volume and illiquidity indicators">
        {liq.illiquidCount} of 39 equities sit above the 75th-percentile volume variability threshold, and several stocks record long runs of zero-volume days.
      </FigureHeader>
      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard eyebrow="Figure 4.4a"
          title="Volume coefficient of variation by stock"
          subtitle="Higher values mean more erratic, episodic trading"
          legend={<Legend items={[{ label: 'Above 75th percentile (illiquid)', color: C.neg, kind: 'rect' }, { label: 'At or below threshold', color: C.s2, kind: 'rect' }]} />}
          table={{ columns: ['Stock', 'Volume CoV', 'Avg daily volume', 'Zero-volume days'], rows: liq.cov.map(d => [d.symbol, d.cov.toFixed(2), d.avgVolume.toLocaleString(), d.zeroDays]) }}>
          <BarList rowHeight={15} xFormat={v => `${v}`} valueFormat={fmt.n(2)} xLabel="Volume coefficient of variation"
            threshold={{ value: liq.threshold, label: `75th pctl ${liq.threshold.toFixed(2)}` }}
            items={liq.cov.map(d => ({ label: d.symbol, value: d.cov, color: d.cov > liq.threshold ? C.neg : C.s2 }))}
            tipRows={it => {
              const d = liq.cov.find(c => c.symbol === it.label)!;
              return [
                { color: it.color, kind: 'rect', label: 'Volume CoV', value: d.cov.toFixed(2) },
                { label: 'Avg daily volume', value: fmt.compact(d.avgVolume) },
                { label: 'Zero-volume days', value: String(d.zeroDays) },
              ];
            }}
            ariaLabel="Volume coefficient of variation for 39 NGX equities with 75th percentile threshold" />
        </ChartCard>
        <ChartCard eyebrow="Figure 4.4b"
          title="Zero-volume trading days per stock"
          subtitle={`Top 20 of the ${liq.zeroVolume.length} stocks with at least one no-trade day, 2012 to 2025`}
          table={{ columns: ['Stock', 'Zero-volume days'], rows: liq.zeroVolume.map(d => [d.symbol, d.zeroDays]) }}
          caption="CONOIL, JBERGER and INTBREW account for most no-trade days, consistent with thin free float.">
          <BarList rowHeight={22} tipValues xFormat={v => `${v}`} valueFormat={v => `${v}`} xLabel="Number of zero-volume trading days"
            items={zeroTop.map(d => ({ label: d.symbol, value: d.zeroDays, color: C.neg, group: 'Zero-volume days' }))}
            ariaLabel="Zero-volume trading days per NGX stock" />
        </ChartCard>
      </div>

      <div className="divider" />

      {/* ── RQ1 ──────────────────────────────────────────────────────────── */}
      <SectionHeader id="rq1" rq="RQ1" status="Prototype · 7 folds" title="GAT Pre-Selection Performance">
        Does a Graph Attention Network rank NGX stocks better than momentum and Random Forest baselines?
      </SectionHeader>

      <div className="grid sm:grid-cols-3 gap-3">
        {models.map((r, i) => (
          <div key={r.key} className={`card p-4 ${i === 0 ? 'border-brand/50' : ''}`}>
            <div className="flex items-center gap-2 text-xs font-medium text-ink-2 mb-2">
              <span className="h-2.5 w-2.5 rounded-sm" style={{ background: r.color }} />{r.label}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="text-xl font-bold text-ink">{fmt.signed(3)(r.ic)}</div>
                <div className="text-ink-3 text-[11px]">Mean IC</div>
              </div>
              <div>
                <div className="text-xl font-bold text-ink">{fmt.signedPct(2)(r.spread)}</div>
                <div className="text-ink-3 text-[11px]">Q5 − Q1 spread</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <FigureHeader num="4.5" title="GAT pre-selection vs baselines, seven walk-forward folds (2019 to 2025)">
        Random Forest edges GAT on rank correlation, but GAT's top-quintile picks deliver more than twice the return spread.
      </FigureHeader>
      <div className="grid gap-4 md:grid-cols-2">
        <ChartCard eyebrow="Figure 4.5a" title="Mean monthly information coefficient"
          subtitle="Spearman rank correlation between predicted and realised next-month returns"
          table={{ columns: ['Model', 'Mean IC'], rows: models.map(x => [x.label, x.ic.toFixed(3)]) }}>
          <ColumnChart height={270} maxBar={44}
            categories={models.map(x => ({ key: x.key, label: x.label }))}
            series={[{ key: 'ic', label: 'Mean IC', color: C.s1 }]}
            value={i => models[i].ic} colorFor={i => models[i].color}
            capLabel={i => fmt.signed(3)(models[i].ic)}
            refLines={[{ y: 0.05, label: 'IC 0.05 practical threshold' }]}
            yDomain={[-0.04, 0.08]} yFormat={fmt.n(3)} valueFormat={fmt.signed(3)}
            ariaLabel="Mean information coefficient: GAT 0.054, Random Forest 0.061, Momentum -0.023" />
        </ChartCard>
        <ChartCard eyebrow="Figure 4.5b" title="Mean top-minus-bottom quintile return spread"
          subtitle="Next-month return of top-quintile picks minus bottom quintile, % per month"
          table={{ columns: ['Model', 'Spread (% per month)'], rows: models.map(x => [x.label, x.spread.toFixed(2)]) }}>
          <ColumnChart height={270} maxBar={44}
            categories={models.map(x => ({ key: x.key, label: x.label }))}
            series={[{ key: 'spread', label: 'Quintile spread', color: C.s1 }]}
            value={i => models[i].spread} colorFor={i => models[i].color}
            capLabel={i => fmt.pct(2)(models[i].spread)}
            yFormat={fmt.pct(1)} valueFormat={fmt.pct(2)}
            ariaLabel="Quintile return spread: GAT 2.22%, Random Forest 0.82%, Momentum 0.93%" />
        </ChartCard>
      </div>
      <ChartCard className="mt-4" eyebrow="Figure 4.5c" title="Information coefficient by walk-forward fold"
        subtitle="Mean monthly Spearman IC in each held-out test year"
        legend={legendOf(MODEL_SERIES, 'rect')}
        table={{ columns: ['Test year', 'Months', 'GAT IC', 'RF IC', 'Momentum IC'], rows: R.gat.annual.map(a => [a.year, a.months, a.gatIC.toFixed(3), a.rfIC.toFixed(3), a.momIC.toFixed(3)]) }}
        caption="GAT mean IC = 0.054 across seven folds. Positive average IC with substantial cross-fold variance confirms the need for multi-seed averaging in the final evaluation.">
        <ColumnChart height={280}
          categories={R.gat.annual.map(a => ({ key: String(a.year), label: String(a.year), sub: `${a.months} mo` }))}
          series={MODEL_SERIES}
          value={(i, k) => (R.gat.annual[i] as Record<string, number>)[`${k}IC`]}
          yFormat={fmt.n(2)} valueFormat={fmt.signed(3)}
          tipTitle={i => `Test year ${R.gat.annual[i].year} (${R.gat.annual[i].months} months)`}
          ariaLabel="Grouped bar chart of annual information coefficient for GAT, Random Forest and Momentum, 2019 to 2025" />
      </ChartCard>

      <div className="divider" />

      {/* ── RQ2 ──────────────────────────────────────────────────────────── */}
      <SectionHeader id="rq2" rq="RQ2" status="Prototype · 68 months" title="PPO Portfolio Allocation">
        Can a reinforcement-learning agent allocate across GAT-selected stocks with less trading than mean-variance optimisation?
      </SectionHeader>

      <StatGrid items={[
        { label: 'PPO Sharpe ratio', value: m.ppo.sharpe.toFixed(3), sub: '10 bps cost', note: `vs MVO ${m.mvo.sharpe.toFixed(3)}` },
        { label: 'PPO CAGR',         value: `${m.ppo.cagr.toFixed(1)}%`, sub: 'Annualised, 68 months', note: `vs EW ${m.ew.cagr.toFixed(1)}%` },
        { label: 'PPO turnover',     value: `${m.ppo.turnover}%`, sub: 'Monthly average', note: `vs MVO ${m.mvo.turnover}%` },
        { label: 'Max drawdown',     value: `${m.ppo.maxDD.toFixed(1)}%`, sub: 'Peak to trough, pooled 68 months', note: `vs MVO ${m.mvo.maxDD.toFixed(1)}%` },
      ]} />

      <FigureHeader num="4.6" title="PPO allocation: cumulative wealth and annual performance (2019 to 2025)" />
      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard eyebrow="Figure 4.6a" title="Growth of ₦1, net of 10 bps cost"
          subtitle="68 out-of-sample months pooled across 7 annual policies"
          legend={legendOf(PPO_SERIES)}
          table={{ columns: ['Month', 'PPO', 'MVO', 'Equal weight'], rows: R.ppo.wealth.map(w => [w.month, w.ppo.toFixed(3), w.mvo.toFixed(3), w.ew.toFixed(3)]) }}
          caption="PPO tracks equal weight closely while trading far less than MVO; MVO's late lead comes with 2.6 times the turnover.">
          <LineChart data={ppoWealth} xKey="t" series={PPO_SERIES} height={300}
            xTicks={yearTicks(2019, 2026)} yFormat={fmt.x(1)} valueFormat={fmt.x(2)}
            refLines={[{ y: 1, label: 'Break-even' }]} endLabels
            tipTitle={d => (d.month === '2018-12' ? 'Start (Dec 2018)' : monthLabel(String(d.month)))}
            ariaLabel="Cumulative wealth of PPO, MVO and equal weight portfolios, 2019 to 2025" />
        </ChartCard>
        <ChartCard eyebrow="Figure 4.6b" title="Annual Sharpe ratio by test year"
          subtitle="Zero risk-free rate, each fold evaluated on its own held-out year"
          legend={legendOf(PPO_SERIES, 'rect')}
          table={{ columns: ['Year', 'Months', 'PPO', 'MVO', 'EW', 'PPO CAGR (%)'], rows: R.ppo.annual.map(a => [a.year, a.months, a.ppoSharpe.toFixed(2), a.mvoSharpe.toFixed(2), a.ewSharpe.toFixed(2), a.ppoCAGR]) }}>
          <ColumnChart height={300}
            categories={R.ppo.annual.map(a => ({ key: String(a.year), label: String(a.year) }))}
            series={PPO_SERIES}
            value={(i, k) => (R.ppo.annual[i] as Record<string, number>)[`${k}Sharpe`]}
            yFormat={fmt.n(0)} valueFormat={fmt.n(2)}
            tipTitle={i => `${R.ppo.annual[i].year} (${R.ppo.annual[i].months} months)`}
            tipNote={i => `CAGR · PPO ${R.ppo.annual[i].ppoCAGR}% · MVO ${R.ppo.annual[i].mvoCAGR}% · EW ${R.ppo.annual[i].ewCAGR}%`}
            ariaLabel="Annual Sharpe ratio of PPO, MVO and equal weight by test year" />
        </ChartCard>
      </div>

      <FigureHeader num="4.7" title="Transaction cost sensitivity">
        PPO keeps its Sharpe advantage as costs rise; MVO degrades faster because it trades more.
      </FigureHeader>
      <ChartCard eyebrow="Figure 4.7" title="Sharpe ratio by one-way transaction cost, 68 months pooled"
        subtitle="Horizontal axis in basis points. PPO loses 0.029 Sharpe from 5 to 50 bps; MVO loses 0.078."
        legend={legendOf(PPO_SERIES)}
        table={{ columns: ['Cost (bps)', 'PPO', 'MVO', 'Equal weight'], rows: R.ppo.cost.map(c => [c.cost, c.ppo.toFixed(3), c.mvo.toFixed(3), c.ew.toFixed(3)]) }}>
        <LineChart data={R.ppo.cost} xKey="cost" series={PPO_SERIES} markers endLabels height={300}
          xTicks={R.ppo.cost.map(c => ({ value: c.cost, label: String(c.cost) }))} xDomain={[0, 52]}
          yFormat={fmt.n(2)} valueFormat={fmt.n(3)}
          tipTitle={d => `One-way cost: ${d.cost} bps`}
          ariaLabel="Sharpe ratio of PPO, MVO and equal weight at 5, 10, 25 and 50 basis points cost" />
      </ChartCard>

      <div className="divider" />

      {/* ── RQ3 ──────────────────────────────────────────────────────────── */}
      <SectionHeader id="rq3" rq="RQ3" status="Complete · Final finding" title="Sentiment Analysis">
        Does VADER-scored Nigerian financial news add predictive value to a price-only momentum strategy?
      </SectionHeader>

      <StatGrid items={[
        { label: 'HAC t-statistic', value: m.sentiment.tStat.toFixed(3), sub: 'Newey-West estimator' },
        { label: 'p-value',         value: `≈ ${m.sentiment.pValue}`, sub: 'Not significant at 5%' },
        { label: '95% CI (annual)', value: `[${R.sentiment.hac.ciLow}%, +${R.sentiment.hac.ciHigh}%]`, sub: 'Spans zero' },
      ]} />

      <FigureHeader num="4.8" title="Sentiment data coverage and ablation study (2012 to 2025)">
        News coverage only became adequate from 2021, so the ablation is run on 2021 to 2025. Adding sentiment lowers CAGR by 5.0 percentage points.
      </FigureHeader>
      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard eyebrow="Figure 4.8a" title="Unique news articles per year"
          subtitle="Bar shade shows trading-day coverage tier"
          legend={<Legend items={Object.entries(tierColor).map(([label, color]) => ({ label, color, kind: 'rect' as const }))} />}
          table={{ columns: ['Year', 'Unique articles', 'Trading-day coverage (%)'], rows: R.sentiment.coverage.map(c => [c.year, c.articles, c.coverage]) }}>
          <ColumnChart height={260}
            categories={R.sentiment.coverage.map(c => ({ key: String(c.year), label: `'${String(c.year).slice(2)}` }))}
            series={[{ key: 'articles', label: 'Unique articles', color: C.s1 }]}
            value={i => R.sentiment.coverage[i].articles}
            colorFor={i => tierColor[covTier(R.sentiment.coverage[i].coverage)]}
            yFormat={v => `${v}`}
            tipTitle={i => String(R.sentiment.coverage[i].year)}
            tipNote={i => `${R.sentiment.coverage[i].coverage}% trading-day coverage · ${covTier(R.sentiment.coverage[i].coverage)}`}
            ariaLabel="Unique news articles per year, 2012 to 2025" />
        </ChartCard>
        <ChartCard eyebrow="Figure 4.8b" title="Trading-day sentiment coverage"
          subtitle="Share of trading days with at least one scored headline"
          table={{ columns: ['Year', 'Coverage (%)'], rows: R.sentiment.coverage.map(c => [c.year, c.coverage]) }}>
          <LineChart data={R.sentiment.coverage} xKey="year" markers height={260}
            series={[{ key: 'coverage', label: 'Coverage', color: C.s1 }]}
            xTicks={[2012, 2014, 2016, 2018, 2020, 2022, 2024].map(v => ({ value: v, label: String(v) }))}
            xDomain={[2011.6, 2025.4]} yDomain={[0, 100]}
            yFormat={v => `${v}%`} valueFormat={fmt.pct(1)}
            refLines={[{ y: 42, label: 'Adequate ≥42%' }]}
            tipTitle={d => String(d.year)} tipNote={d => `${d.articles} unique articles`}
            ariaLabel="Trading-day sentiment coverage rising from under 1% in 2012 to 85% in 2025" />
        </ChartCard>
      </div>
      <ChartCard className="mt-4" eyebrow="Figure 4.8c" title="Portfolio ablation results, 2021 to 2025"
        subtitle={`CAGR by strategy · HAC t = ${R.sentiment.hac.t} (p ≈ ${m.sentiment.pValue})`}
        table={{ columns: ['Strategy', 'CAGR (%)', 'Sharpe', 'Avg monthly turnover', 'Max drawdown (%)'], rows: ablation.map(a => [a.label, a.cagr, a.sharpe.toFixed(3), a.turnover.toFixed(3), a.maxDD]) }}
        caption="Adding VADER-scored headline sentiment reduces CAGR by 5.0 percentage points and increases turnover (0.493 vs 0.431 monthly). This is the first systematic test of news-sentiment predictability for an African frontier equity market.">
        <ColumnChart height={280} maxBar={56}
          categories={ablation.map(a => ({ key: a.key, label: a.label, sub: `Sharpe ${a.sharpe.toFixed(3)}` }))}
          series={[{ key: 'cagr', label: 'CAGR', color: C.s1 }]}
          value={i => ablation[i].cagr} colorFor={i => ablColor[ablation[i].key]}
          capLabel={i => fmt.pct(1)(ablation[i].cagr)}
          yFormat={v => `${v}%`} valueFormat={fmt.pct(1)}
          tipNote={i => `Sharpe ${ablation[i].sharpe.toFixed(3)} · Turnover ${ablation[i].turnover.toFixed(3)} · Max DD ${ablation[i].maxDD}%`}
          ariaLabel="CAGR: price-only momentum 54.0%, momentum plus sentiment 49.0%, equal weight 37.2%" />
      </ChartCard>

      <FigureHeader num="4.9" title="Growth of ₦1: news sentiment increment" />
      <ChartCard eyebrow="Figure 4.9" title="Cumulative wealth by strategy, January 2021 to December 2025"
        subtitle="Price-only momentum stays ahead of momentum plus sentiment for most of the period"
        legend={legendOf(SENT_SERIES)}
        table={{ columns: ['Month', 'Price-only momentum', 'Momentum + sentiment', 'Equal weight'], rows: R.sentiment.wealth.map(w => [w.month, w.mom.toFixed(3), w.sent.toFixed(3), w.ew.toFixed(3)]) }}
        caption={`Annualised mean excess return of sentiment over price-only: ${R.sentiment.hac.annualExcess}% (95% CI ${R.sentiment.hac.ciLow}% to +${R.sentiment.hac.ciHigh}%).`}>
        <LineChart data={sentWealth} xKey="t" series={SENT_SERIES} height={320} endLabels
          xTicks={yearTicks(2021, 2026)} yFormat={fmt.x(0)} valueFormat={fmt.x(2)}
          refLines={[{ y: 1, label: 'Break-even' }]}
          tipTitle={d => (d.month === '2020-12' ? 'Start (Dec 2020)' : monthLabel(String(d.month)))}
          ariaLabel="Cumulative wealth of price-only momentum, momentum plus sentiment and equal weight, 2021 to 2025" />
      </ChartCard>

    </div>
  );
}
