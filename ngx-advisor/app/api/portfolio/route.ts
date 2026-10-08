import { NextResponse } from 'next/server';
import { PORTFOLIO_PROFILES } from '@/lib/data';

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const { riskProfile = 'moderate', capital = 1000000 } = body;

  const profile = PORTFOLIO_PROFILES[riskProfile as keyof typeof PORTFOLIO_PROFILES];
  if (!profile) {
    return NextResponse.json({ error: 'Invalid risk profile.' }, { status: 400 });
  }

  // Simulate brief processing time (mirrors prototype model call)
  await new Promise(r => setTimeout(r, 120));

  const amount = Number(capital);
  const allocations = profile.allocations.map(a => ({
    symbol:   a.symbol,
    weight:   a.weight,
    amount:   Math.round(amount * a.weight),
    rationale: a.rationale,
  }));

  return NextResponse.json({
    riskProfile,
    capital:     amount,
    allocations,
    metrics: {
      expectedReturn: profile.expectedReturn,
      expectedVol:    profile.expectedVol,
      sharpe:         profile.sharpe,
      maxDrawdown:    profile.maxDD,
    },
    meta: {
      model:    'GAT v1 + PPO prototype (7-fold walk-forward, 2019-2025)',
      folds:    7,
      months:   68,
      disclaimer: 'Research prototype only. Not financial advice.',
    },
  });
}

export async function GET() {
  return NextResponse.json({ status: 'NGX Advisor API v1.0', profiles: Object.keys(PORTFOLIO_PROFILES) });
}
