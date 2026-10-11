'use client';
import { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle, ArrowLeft, ArrowRight, Brain, Check, CheckCircle2, ChevronDown, Info, RefreshCw, ShieldCheck,
} from 'lucide-react';
import clsx from 'clsx';
import { ADVISOR } from '@/lib/advisorData';
import {
  AMOUNT_MAX, AMOUNT_MIN, AMOUNT_PRESETS, HISTORY_MONTHS, HORIZON_MAX_MONTHS, HORIZON_MIN_MONTHS,
  HORIZON_SUGGESTED_MONTHS, PROFILE_KEYS, QUESTIONS, SECTORS, formatHorizon, formatNGN, horizonStats,
  metricsFor, minimumToHoldAll, nameOf, pct, priceOf, recommendedProfile, seriesFor,
  type Holding, type ProfileKey, type RecommendationResponse, type Sector,
} from '@/lib/advisor';
import { C, ChartCard, Legend, Series } from '@/components/charts/core';
import { LineChart } from '@/components/charts/LineChart';

type Step = 1 | 2 | 3 | 4;

const STEPS = ['Investor profile', 'Parameters', 'Analysis', 'Portfolios'];
const PROFILE_META: Record<ProfileKey, { label: string; color: string; blurb: string }> = {
  conservative: { label: 'Conservative', color: C.s2, blurb: 'Most diversified, with a volatility screen' },
  moderate:     { label: 'Moderate',     color: C.s1, blurb: 'Balanced: top GAT picks across liquid stocks' },
  aggressive:   { label: 'Aggressive',   color: C.s3, blurb: 'Most concentrated: highest return and risk' },
};
const SECTOR_NOTE: Partial<Record<Sector, string>> = {
  ICT: 'Only 2 ICT stocks are listed in the panel (MTNN, AIRTELAFRI); remaining positions are filled from other sectors.',
  'Oil & Gas': 'Five Oil & Gas stocks are in the panel; larger portfolios are filled from other sectors.',
};
const ANALYSIS_STAGES = [
  `Screening liquidity across ${ADVISOR.snapshot.All.universe} NGX equities`,
  'Ranking stocks with the Graph Attention Network',
  'Allocating weights with the PPO policy',
  'Building conservative, moderate and aggressive portfolios',
];

/* ── Small UI pieces ─────────────────────────────────────────────────────── */
function Stepper({ step }: { step: Step }) {
  return (
    <ol className="mb-10 grid grid-cols-4 gap-2">
      {STEPS.map((label, i) => {
        const n = (i + 1) as Step;
        const done = n < step, active = n === step;
        return (
          <li key={label} className="flex flex-col gap-2">
            <div className={clsx('h-1 rounded-full', done || active ? 'bg-brand' : 'bg-line')} />
            <div className="flex items-center gap-1.5 text-xs">
              <span className={clsx('flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold',
                done ? 'bg-brand text-white' : active ? 'border-2 border-brand text-accent' : 'border border-line text-ink-3')}>
                {done ? <Check className="h-3 w-3" /> : n}
              </span>
              <span className={clsx('hidden sm:inline', active ? 'font-semibold text-ink' : 'text-ink-3')}>{label}</span>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function Choice({ selected, onClick, children, className }: {
  selected: boolean; onClick: () => void; children: React.ReactNode; className?: string;
}) {
  return (
    <button type="button" onClick={onClick} aria-pressed={selected}
      className={clsx('rounded-xl border px-3.5 py-2.5 text-left text-sm transition-colors',
        selected ? 'border-brand bg-brand/10 font-medium text-ink' : 'border-line bg-surface text-ink-2 hover:border-ink-3 hover:text-ink',
        className)}>
      {children}
    </button>
  );
}

function FieldLabel({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="mb-3">
      <div className="text-sm font-semibold text-ink">{title}</div>
      {hint && <div className="mt-0.5 text-xs text-ink-2">{hint}</div>}
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div>
      <div className="text-[11px] text-ink-3">{label}</div>
      <div className="mt-0.5 text-base font-bold text-ink">{value}</div>
      {sub && <div className="text-[10px] text-ink-3">{sub}</div>}
    </div>
  );
}

/* ── Results: one portfolio card ─────────────────────────────────────────── */
function PortfolioCard({ profile, holdings, sector, amount, horizon, recommended }: {
  profile: ProfileKey; holdings: Holding[]; sector: Sector; amount: number; horizon: number; recommended: boolean;
}) {
  const meta = PROFILE_META[profile];
  const m = metricsFor(sector, profile);
  const hz = horizonStats(seriesFor(sector, profile), horizon);
  const minAll = minimumToHoldAll(holdings);

  return (
    <article className={clsx('card flex flex-col p-5', recommended && 'ring-2 ring-brand')}>
      <header className="mb-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-sm" style={{ background: meta.color }} />
            <h3 className="text-lg font-bold text-ink">{meta.label}</h3>
          </div>
          {recommended && <span className="tag tag-brand text-[10px]"><CheckCircle2 className="h-3 w-3" /> Suggested for you</span>}
        </div>
        <p className="mt-1 text-xs text-ink-2">{holdings.length} stocks · {meta.blurb}</p>
      </header>

      <div className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-xl bg-subtle p-3.5">
        <Stat label="Typical 12-month return" value={`${pct(m.roll12_p25, 0)} to ${pct(m.roll12_p75, 0)}`} sub="Middle 50% of historical 12-month periods" />
        <Stat label="Annualised return" value={pct(m.cagr)} sub="2019 to 2025 walk-forward test" />
        <Stat label="Worst fall from peak" value={pct(m.max_drawdown)} sub="Maximum drawdown in the test" />
        <Stat label="Rebalancing" value="Monthly" sub="As in the walk-forward evaluation" />
      </div>

      <div className="mt-3 rounded-xl border border-line p-3.5 text-xs leading-relaxed text-ink-2">
        {hz ? (
          <>
            Over <span className="font-semibold text-ink">{formatHorizon(horizon)}</span>,{' '}
            <span className="font-semibold text-ink">{Math.round(hz.positiveShare * 100)}%</span> of the {hz.windows} historical periods gained.
            In the middle half of outcomes, {formatNGN(amount)} ended between{' '}
            <span className="font-semibold text-ink">{formatNGN(amount * (1 + hz.p25))}</span> and{' '}
            <span className="font-semibold text-ink">{formatNGN(amount * (1 + hz.p75))}</span>.
          </>
        ) : (
          <>Your {formatHorizon(horizon)} horizon is longer than the {HISTORY_MONTHS}-month test history, so no full historical period exists to estimate it. Use the 12-month range above as a guide.</>
        )}
      </div>

      <ul className="mt-4 space-y-2.5">
        {holdings.map(h => {
          const price = priceOf(h.ticker);
          const value = amount * h.weight;
          const shares = price ? Math.floor(value / price) : null;
          return (
            <li key={h.ticker}>
              <div className="flex items-baseline justify-between gap-2 text-sm">
                <div className="min-w-0">
                  <span className="font-semibold text-ink">{h.ticker}</span>
                  <span className="ml-1.5 truncate text-xs text-ink-3">{nameOf(h.ticker)}</span>
                </div>
                <span className="tabular shrink-0 font-semibold text-ink">{(h.weight * 100).toFixed(1)}%</span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-subtle">
                <div className="h-full rounded-full" style={{ width: `${(h.weight / 0.2) * 100}%`, background: meta.color }} />
              </div>
              <div className="mt-1 flex flex-wrap justify-between gap-x-2 text-[11px] text-ink-3">
                <span>
                  {h.sector}
                  {sector !== 'All' && !h.in_focus && <span className="ml-1 rounded bg-subtle px-1 py-px text-ink-2">filled from other sector</span>}
                </span>
                <span className="tabular">{formatNGN(value)}{shares != null && ` · ≈${shares.toLocaleString()} share${shares === 1 ? '' : 's'}`}</span>
              </div>
            </li>
          );
        })}
      </ul>
      <p className="mt-2 text-[10px] text-ink-3">Bar length is relative to the 20% per-stock cap.</p>

      {amount < minAll && (
        <div className="mt-3 flex gap-2 rounded-lg border border-line bg-subtle p-2.5 text-[11px] leading-relaxed text-ink-2">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink-3" />
          At indicative prices, about {formatNGN(Math.ceil(minAll / 1000) * 1000)} is needed to buy at least one share of every stock here.
        </div>
      )}
    </article>
  );
}

/* ── Page ────────────────────────────────────────────────────────────────── */
export default function AdvisorPage() {
  const [step, setStep] = useState<Step>(1);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [amountText, setAmountText] = useState('1,000,000');
  const [horizonText, setHorizonText] = useState('1');
  const [unit, setUnit] = useState<'months' | 'years'>('years');
  const [sector, setSector] = useState<Sector>('All');
  const [result, setResult] = useState<RecommendationResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [stage, setStage] = useState(0);

  const answered = Object.keys(answers).length;
  const score = Object.values(answers).reduce((a, b) => a + b, 0);
  const amount = Number(amountText.replace(/[^\d.]/g, ''));
  const amountError = !amountText.trim() ? 'Enter an amount.'
    : !Number.isFinite(amount) ? 'Enter a valid number.'
    : amount < AMOUNT_MIN ? `The minimum investment is ${formatNGN(AMOUNT_MIN)}.`
    : amount > AMOUNT_MAX ? `The maximum is ${formatNGN(AMOUNT_MAX)}: larger orders can move thinly traded NGX stocks (RQ4 liquidity finding).`
    : null;
  const horizonValue = Number(horizonText);
  const horizon = Math.round(unit === 'years' ? horizonValue * 12 : horizonValue);
  const horizonError = !horizonText.trim() || !Number.isFinite(horizonValue) || horizonValue <= 0 ? 'Enter a duration.'
    : horizon < HORIZON_MIN_MONTHS ? 'The shortest duration is 1 month, the model\'s rebalancing interval.'
    : horizon > HORIZON_MAX_MONTHS ? `The longest duration is ${HORIZON_MAX_MONTHS / 12} years.`
    : null;
  const rec = recommendedProfile(score, horizon || HORIZON_SUGGESTED_MONTHS);
  const shortStats = !horizonError && horizon < HORIZON_SUGGESTED_MONTHS
    ? horizonStats(seriesFor(sector, rec.key), horizon) : null;

  async function run() {
    setStep(3); setError(null); setResult(null); setStage(0);
    const started = Date.now();
    const timer = setInterval(() => setStage(s => Math.min(s + 1, ANALYSIS_STAGES.length - 1)), 900);
    try {
      const res = await fetch('/api/portfolio', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount, horizonMonths: horizon, sector }),
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error ?? 'The recommendation request failed.');
      await new Promise(r => setTimeout(r, Math.max(0, 3600 - (Date.now() - started))));
      setResult(payload as RecommendationResponse);
      setStep(4);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to build portfolios.');
      setStep(2);
    } finally {
      clearInterval(timer);
    }
  }

  useEffect(() => { window.scrollTo({ top: 0, behavior: 'smooth' }); }, [step]);

  // Historical growth of the user's amount under each profile (walk-forward test months).
  const growth = useMemo(() => {
    const months = ADVISOR.months;
    const start = { t: +months[0].slice(0, 4) + (+months[0].slice(5, 7) - 1) / 12, month: 'Start' } as Record<string, number | string>;
    const rows: Record<string, number | string>[] = [{ ...start, ...Object.fromEntries(PROFILE_KEYS.map(k => [k, amount || 0])) }];
    const wealth = Object.fromEntries(PROFILE_KEYS.map(k => [k, amount || 0])) as Record<ProfileKey, number>;
    months.forEach((mo, i) => {
      const row: Record<string, number | string> = { month: mo, t: +mo.slice(0, 4) + +mo.slice(5, 7) / 12 };
      PROFILE_KEYS.forEach(k => { wealth[k] *= 1 + seriesFor(result?.sector ?? sector, k)[i]; row[k] = wealth[k]; });
      rows.push(row);
    });
    return rows;
  }, [amount, sector, result]);
  const growthSeries: Series[] = PROFILE_KEYS.map(k => ({ key: k, label: PROFILE_META[k].label, color: PROFILE_META[k].color }));

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="text-center mb-8">
        <div className="tag tag-brand mb-4"><Brain className="w-3.5 h-3.5" /> GAT + PPO Robo-Advisor</div>
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-ink mb-3">Portfolio Recommendation</h1>
        <p className="text-ink-2 max-w-2xl mx-auto">
          Answer five questions, set your amount, duration and sector focus, and get three NGX portfolios
          built from the thesis models, with estimates from their 2019 to 2025 walk-forward test.
        </p>
      </div>

      <div className="mx-auto max-w-4xl"><Stepper step={step} /></div>

      {/* ── Step 1: questionnaire ─────────────────────────────────────────── */}
      {step === 1 && (
        <section className="mx-auto max-w-3xl animate-in">
          <div className="mb-6 flex flex-wrap items-end justify-between gap-2">
            <div>
              <h2 className="text-xl font-bold text-ink">Tell us about yourself as an investor</h2>
              <p className="text-sm text-ink-2">Five questions, about two minutes.</p>
            </div>
            <span className="text-xs font-medium text-ink-3">{answered} of {QUESTIONS.length} answered</span>
          </div>
          <div className="space-y-4">
            {QUESTIONS.map((q, qi) => (
              <fieldset key={q.id} className="card p-5">
                <legend className="sr-only">{q.text}</legend>
                <div className="mb-3 flex gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-subtle text-xs font-bold text-ink-2">{qi + 1}</span>
                  <div>
                    <div className="text-sm font-semibold text-ink">{q.text}</div>
                    {q.hint && <div className="mt-0.5 text-xs text-ink-3">{q.hint}</div>}
                  </div>
                </div>
                <div className="grid gap-2 sm:grid-cols-3">
                  {q.options.map(o => (
                    <Choice key={o.label} selected={answers[q.id] === o.score}
                      onClick={() => setAnswers(a => ({ ...a, [q.id]: o.score }))}>{o.label}</Choice>
                  ))}
                </div>
              </fieldset>
            ))}
          </div>
          <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
            {answered === QUESTIONS.length ? (
              <p className="text-sm text-ink-2">
                Your risk profile: <span className="font-semibold text-ink">{PROFILE_META[recommendedProfile(score, 12).key].label}</span>
              </p>
            ) : <span />}
            <button className="btn-primary" disabled={answered < QUESTIONS.length} onClick={() => setStep(2)}>
              Continue <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </section>
      )}

      {/* ── Step 2: parameters ────────────────────────────────────────────── */}
      {step === 2 && (
        <section className="mx-auto max-w-3xl animate-in">
          <button onClick={() => setStep(1)} className="mb-4 inline-flex items-center gap-1.5 text-sm text-ink-2 hover:text-ink">
            <ArrowLeft className="h-4 w-4" /> Back to questions
          </button>
          <h2 className="mb-6 text-xl font-bold text-ink">Choose your investment parameters</h2>

          <div className="space-y-4">
            {/* Amount */}
            <div className="card p-5">
              <FieldLabel title="Amount to invest" hint={`Pick an amount or type your own: minimum ${formatNGN(AMOUNT_MIN)}, maximum ${formatNGN(AMOUNT_MAX)}.`} />
              <div className="mb-3 flex flex-wrap gap-2">
                {AMOUNT_PRESETS.map(v => (
                  <Choice key={v} selected={amount === v} onClick={() => setAmountText(v.toLocaleString('en-NG'))} className="py-2">
                    {formatNGN(v, true)}
                  </Choice>
                ))}
              </div>
              <label className="block">
                <span className="sr-only">Custom amount in naira</span>
                <div className={clsx('flex items-center rounded-xl border bg-canvas px-3.5 focus-within:border-brand',
                  amountError ? 'border-negative/60' : 'border-line')}>
                  <span className="text-ink-3">₦</span>
                  <input inputMode="numeric" value={amountText}
                    onChange={e => setAmountText(e.target.value.replace(/[^\d,]/g, ''))}
                    onBlur={() => { if (Number.isFinite(amount) && amount > 0) setAmountText(Math.round(amount).toLocaleString('en-NG')); }}
                    className="tabular w-full bg-transparent px-2 py-2.5 text-base font-semibold text-ink outline-none" />
                </div>
              </label>
              {amountError && <p role="alert" className="mt-2 text-xs text-negative">{amountError}</p>}
            </div>

            {/* Duration */}
            <div className="card p-5">
              <FieldLabel title="Investment duration"
                hint={`Enter any duration in months or years. Suggested minimum: ${formatHorizon(HORIZON_SUGGESTED_MONTHS)}, one full walk-forward fold of the model.`} />
              <div className="mb-3 flex flex-wrap gap-2">
                {[{ v: '3', u: 'months' as const, l: '3 months' }, { v: '1', u: 'years' as const, l: '1 year' }, { v: '3', u: 'years' as const, l: '3 years' }].map(p => (
                  <Choice key={p.l} selected={horizonText === p.v && unit === p.u} onClick={() => { setHorizonText(p.v); setUnit(p.u); }} className="py-2">{p.l}</Choice>
                ))}
              </div>
              <div className="flex gap-2">
                <label className="flex-1">
                  <span className="sr-only">Duration</span>
                  <input inputMode="decimal" value={horizonText} onChange={e => setHorizonText(e.target.value.replace(/[^\d.]/g, ''))}
                    className={clsx('tabular w-full rounded-xl border bg-canvas px-3.5 py-2.5 text-base font-semibold text-ink outline-none focus:border-brand',
                      horizonError ? 'border-negative/60' : 'border-line')} />
                </label>
                <div className="flex rounded-xl border border-line bg-canvas p-1" role="group" aria-label="Duration unit">
                  {(['months', 'years'] as const).map(u => (
                    <button key={u} type="button" onClick={() => setUnit(u)} aria-pressed={unit === u}
                      className={clsx('rounded-lg px-3.5 text-sm font-medium capitalize transition-colors',
                        unit === u ? 'bg-brand text-white' : 'text-ink-2 hover:text-ink')}>{u}</button>
                  ))}
                </div>
              </div>
              {horizonError ? <p role="alert" className="mt-2 text-xs text-negative">{horizonError}</p>
                : <p className="mt-2 text-xs text-ink-3">= {formatHorizon(horizon)}</p>}
              {shortStats && (
                <div className="mt-3 flex gap-2 rounded-lg border border-line bg-subtle p-3 text-xs leading-relaxed text-ink-2">
                  <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink-3" />
                  <span>
                    Shorter than the suggested {formatHorizon(HORIZON_SUGGESTED_MONTHS)}. Over {formatHorizon(horizon)} periods, the {PROFILE_META[rec.key].label.toLowerCase()} portfolio
                    gained in {Math.round(shortStats.positiveShare * 100)}% of historical cases; the worst case returned {pct(shortStats.worst)}.
                  </span>
                </div>
              )}
            </div>

            {/* Sector */}
            <div className="card p-5">
              <FieldLabel title="Sector focus" hint="Portfolios prefer stocks from this sector, then fill any remaining positions from the rest of the market." />
              <div className="flex flex-wrap gap-2">
                {SECTORS.map(s => (
                  <Choice key={s} selected={sector === s} onClick={() => setSector(s)} className="py-2">
                    {s === 'All' ? 'All sectors' : s}
                    <span className="ml-1.5 text-xs text-ink-3">
                      {s === 'All' ? ADVISOR.snapshot.All.universe : ADVISOR.sectorCounts[s as keyof typeof ADVISOR.sectorCounts]}
                    </span>
                  </Choice>
                ))}
              </div>
              {SECTOR_NOTE[sector] && <p className="mt-3 text-xs text-ink-2">{SECTOR_NOTE[sector]}</p>}
            </div>
          </div>

          {error && <div role="alert" className="mt-4 card border-negative/50 p-4 text-sm text-negative">{error}</div>}

          <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
            <p className="text-sm text-ink-2">
              Suggested profile: <span className="font-semibold text-ink">{PROFILE_META[rec.key].label}</span>
              {rec.adjusted && <span className="text-ink-3"> (one level lower because of the short duration)</span>}
            </p>
            <button className="btn-primary" disabled={!!amountError || !!horizonError} onClick={run}>
              <Brain className="w-4 h-4" /> Build my portfolios
            </button>
          </div>
        </section>
      )}

      {/* ── Step 3: analysis ──────────────────────────────────────────────── */}
      {step === 3 && (
        <section className="mx-auto max-w-xl animate-in">
          <div className="card p-8 text-center">
            <RefreshCw className="mx-auto mb-4 h-8 w-8 animate-spin text-accent" />
            <h2 className="text-lg font-bold text-ink">Analysing {ADVISOR.snapshot.All.universe} NGX equities using the Graph Attention Network…</h2>
            <p className="mt-1 text-sm text-ink-2">This usually takes a few seconds.</p>
            <ul className="mx-auto mt-6 max-w-sm space-y-2.5 text-left">
              {ANALYSIS_STAGES.map((s, i) => (
                <li key={s} className={clsx('flex items-center gap-2.5 text-sm', i <= stage ? 'text-ink' : 'text-ink-3')}>
                  {i < stage ? <CheckCircle2 className="h-4 w-4 shrink-0 text-accent" />
                    : i === stage ? <span className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-brand border-t-transparent" />
                    : <span className="h-4 w-4 shrink-0 rounded-full border border-line" />}
                  {s}
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {/* ── Step 4: results ───────────────────────────────────────────────── */}
      {step === 4 && result && (
        <section className="animate-in space-y-6">
          <div className="card flex flex-wrap items-center justify-between gap-4 p-5">
            <div className="grid grid-cols-2 gap-x-8 gap-y-2 sm:grid-cols-4">
              <Stat label="Amount" value={formatNGN(amount)} />
              <Stat label="Duration" value={formatHorizon(horizon)} />
              <Stat label="Sector focus" value={result.sector === 'All' ? 'All sectors' : result.sector} />
              <Stat label="Suggested profile" value={PROFILE_META[rec.key].label} />
            </div>
            <div className="flex gap-2">
              <button className="btn-ghost py-2 text-sm" onClick={() => setStep(2)}><ArrowLeft className="h-4 w-4" /> Adjust</button>
              <button className="btn-ghost py-2 text-sm" onClick={() => { setAnswers({}); setResult(null); setStep(1); }}>
                <RefreshCw className="h-4 w-4" /> Start over
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-start gap-3 rounded-xl border border-line bg-surface p-4 text-xs leading-relaxed text-ink-2">
            <span className={clsx('tag text-[10px]', result.source === 'live' ? 'tag-brand' : 'tag-neutral')}>
              {result.source === 'live' ? 'Live model output' : 'Saved model output'}
            </span>
            <span className="min-w-0 flex-1">
              Signal date <span className="font-semibold text-ink">{result.signal_date}</span> ({result.stale_days} days ago) ·{' '}
              {result.eligible_assets} of {result.universe} stocks eligible · {result.model_year} model fold.
              {result.notice && <> {result.notice}</>}
            </span>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            {PROFILE_KEYS.map(k => (
              <PortfolioCard key={k} profile={k} holdings={result.portfolios[k]} sector={result.sector}
                amount={amount} horizon={horizon} recommended={k === rec.key} />
            ))}
          </div>

          <ChartCard eyebrow="Historical test" title={`How ${formatNGN(amount)} would have grown under each profile`}
            subtitle="Pooled walk-forward test months, January 2019 to December 2025, net of 10 bps trading cost and rebalanced monthly"
            legend={<Legend items={growthSeries.map(s => ({ label: s.label, color: s.color }))} />}
            table={{ columns: ['Month', ...growthSeries.map(s => s.label)], rows: growth.slice(1).map(r => [String(r.month), ...PROFILE_KEYS.map(k => formatNGN(Number(r[k])))]) }}
            caption={`For comparison, the full PPO portfolio (about 30 stocks) returned ${pct(ADVISOR.reference.ppo.cagr)} a year with a worst fall of ${pct(ADVISOR.reference.ppo.max_drawdown)} over the same months.`}>
            <LineChart data={growth} xKey="t" series={growthSeries} height={300} endLabels
              xTicks={[2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026].map(v => ({ value: v, label: String(v) }))}
              yFormat={v => formatNGN(v, true)} valueFormat={v => formatNGN(v)}
              refLines={[{ y: amount, label: 'Amount invested' }]}
              tipTitle={d => (d.month === 'Start' ? 'Start (Jan 2019)' : String(d.month))}
              ariaLabel="Historical growth of the investment amount under the conservative, moderate and aggressive profiles" />
          </ChartCard>

          <div className="card border-l-4 border-l-brand p-5">
            <div className="flex gap-3">
              <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-accent" />
              <div className="space-y-2 text-sm leading-relaxed text-ink-2">
                <p className="font-semibold text-ink">
                  This is not financial advice. Estimates are based on historical model performance and carry uncertainty.
                </p>
                <p className="text-xs">
                  Estimates come from replaying the saved annual GAT and PPO models over 68 walk-forward test months (2019 to 2025) with a 10 bps one-way
                  trading cost; actual NGX brokerage and regulatory fees are higher. Profile sizes and screens were chosen by comparing a small set of rules on
                  those same months, so the estimates are likely optimistic. Share counts use indicative prices from {ADVISOR.priceDate}. Past performance does not
                  guarantee future results.
                </p>
              </div>
            </div>
          </div>

          <details className="card group p-5">
            <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-semibold text-ink">
              How these portfolios are built
              <ChevronDown className="h-4 w-4 text-ink-3 transition-transform group-open:rotate-180" />
            </summary>
            <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-xs leading-relaxed text-ink-2">
              <li>Liquidity filter (RQ4): stocks with any no-trade day in the last 60 sessions, or with median volume in the bottom quarter, are excluded.</li>
              <li>Risk screen: the conservative portfolio also excludes the most volatile 30% of the remaining stocks.</li>
              <li>Stage 1, GAT pre-selection: stocks are ranked by Graph Attention Network score, preferring your sector focus.</li>
              <li>Stage 2, PPO allocation: weights follow the PPO policy for the selected stocks, capped at 20% per stock as in training.</li>
              <li>Risk is set by concentration: 10 stocks (conservative), 8 (moderate) or 5 (aggressive). Fewer stocks raised both return and volatility in the test.</li>
            </ol>
          </details>
        </section>
      )}
    </div>
  );
}
