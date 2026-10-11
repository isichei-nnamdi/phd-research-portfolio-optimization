import { NextResponse } from 'next/server';

const INFERENCE_API_URL = process.env.INFERENCE_API_URL;

const PROTOTYPE: Record<number, { ticker: string; weight: number }[]> = {
  2019: [{ticker:'ZENITHBANK',weight:.25},{ticker:'DANGCEM',weight:.20},{ticker:'MTNN',weight:.20},{ticker:'NESTLE',weight:.18},{ticker:'STANBIC',weight:.17}],
  2020: [{ticker:'ZENITHBANK',weight:.22},{ticker:'DANGCEM',weight:.22},{ticker:'GTCO',weight:.18},{ticker:'NESTLE',weight:.20},{ticker:'UBA',weight:.18}],
  2021: [{ticker:'SEPLAT',weight:.22},{ticker:'ZENITHBANK',weight:.20},{ticker:'DANGCEM',weight:.18},{ticker:'MTNN',weight:.22},{ticker:'ACCESSCORP',weight:.18}],
  2022: [{ticker:'SEPLAT',weight:.25},{ticker:'ZENITHBANK',weight:.20},{ticker:'MTNN',weight:.20},{ticker:'DANGCEM',weight:.18},{ticker:'GTCO',weight:.17}],
  2023: [{ticker:'SEPLAT',weight:.25},{ticker:'TRANSCORP',weight:.20},{ticker:'ACCESSCORP',weight:.20},{ticker:'ZENITHBANK',weight:.20},{ticker:'MTNN',weight:.15}],
  2024: [{ticker:'SEPLAT',weight:.25},{ticker:'TRANSCORP',weight:.20},{ticker:'ZENITHBANK',weight:.20},{ticker:'ACCESSCORP',weight:.18},{ticker:'MTNN',weight:.17}],
  2025: [{ticker:'SEPLAT',weight:.25},{ticker:'ZENITHBANK',weight:.20},{ticker:'MTNN',weight:.20},{ticker:'ACCESSCORP',weight:.18},{ticker:'DANGCEM',weight:.17}],
};
const NAMES: Record<string,string> = {
  ZENITHBANK:'Zenith Bank Plc',GTCO:'Guaranty Trust Holding',DANGCEM:'Dangote Cement Plc',
  MTNN:'MTN Nigeria Communications',SEPLAT:'Seplat Energy Plc',ACCESSCORP:'Access Holdings Plc',
  UBA:'United Bank for Africa',NESTLE:'Nestle Nigeria Plc',STANBIC:'Stanbic IBTC Holdings',
  TRANSCORP:'Transnational Corporation',
};

export async function POST(req: Request) {
  const body      = await req.json().catch(() => ({}));
  const capital   = Number(body.capital   ?? 1_000_000);
  const modelYear = Number(body.modelYear ?? 2025);
  if (!Number.isFinite(capital) || capital <= 0)
    return NextResponse.json({ error: 'capital must be a positive number.' }, { status: 400 });
  if (!Number.isInteger(modelYear) || modelYear < 2019 || modelYear > 2025)
    return NextResponse.json({ error: 'modelYear must be between 2019 and 2025.' }, { status: 400 });

  if (INFERENCE_API_URL) {
    try {
      const res = await fetch(`${INFERENCE_API_URL}/v1/inference/latest?model_year=${modelYear}`,
        { cache: 'no-store', signal: AbortSignal.timeout(120_000) });
      const payload = await res.json().catch(() => ({}));
      if (res.ok) {
        const allocations = (payload.ppo_allocations ?? []).map(
          (a: { ticker: string; weight: number }) => ({
            symbol: a.ticker, name: NAMES[a.ticker] ?? a.ticker,
            weight: a.weight, amount: Math.round(capital * a.weight),
            rationale: 'PPO model weight from saved walk-forward fold.',
          }));
        return NextResponse.json({ ...payload, capital, allocations, source: 'live' });
      }
    } catch { /* fall through */ }
  }

  const allocs = (PROTOTYPE[modelYear] ?? PROTOTYPE[2025]).map(a => ({
    symbol: a.ticker, name: NAMES[a.ticker] ?? a.ticker,
    weight: a.weight, amount: Math.round(capital * a.weight),
    rationale: 'Prototype allocation from the walk-forward evaluation.',
  }));
  return NextResponse.json({
    signal_date: new Date().toISOString().split('T')[0],
    model_year: modelYear, stale_days: 0, eligible_assets: 39,
    gat_rankings: allocs.map((a,i) => ({ ticker: a.symbol, score: +(0.8-i*0.08).toFixed(3), rank: i+1 })),
    ppo_allocations: allocs.map(a => ({ ticker: a.symbol, weight: a.weight })),
    allocations: allocs, capital, source: 'prototype',
    meta: { research_prototype: true, disclaimer: 'Research prototype only. Not financial advice.',
            mode: INFERENCE_API_URL ? 'inference_unavailable' : 'no_server_configured' },
  });
}

export async function GET() {
  if (!INFERENCE_API_URL)
    return NextResponse.json({ status: 'prototype', inference: 'not configured' });
  try {
    const res = await fetch(`${INFERENCE_API_URL}/health`, { cache: 'no-store' });
    return NextResponse.json({ status: res.ok ? 'ok' : 'unavailable', inference: await res.json() });
  } catch {
    return NextResponse.json({ status: 'unreachable', inference: INFERENCE_API_URL }, { status: 502 });
  }
}
