import { NextResponse } from 'next/server';
import { ADVISOR } from '@/lib/advisorData';
import {
  AMOUNT_MAX, AMOUNT_MIN, HORIZON_MAX_MONTHS, HORIZON_MIN_MONTHS, SECTORS,
  type Recommendation, type RecommendationResponse, type Sector,
} from '@/lib/advisor';

// Hugging Face Spaces can take a while to wake from sleep.
export const maxDuration = 60;

const INFERENCE_API_URL = process.env.INFERENCE_API_URL?.replace(/\/$/, '');
// Bearer token for a private Hugging Face Space or a token-protected API (server-side only).
const INFERENCE_API_TOKEN = process.env.INFERENCE_API_TOKEN;

function snapshot(sector: Sector, notice: string): RecommendationResponse {
  return { ...(ADVISOR.snapshot[sector] as Recommendation), source: 'snapshot', notice };
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const amount = Number(body.amount);
  const horizonMonths = Number(body.horizonMonths);
  const sector = body.sector as Sector;

  if (!Number.isFinite(amount) || amount < AMOUNT_MIN || amount > AMOUNT_MAX)
    return NextResponse.json({ error: `amount must be between ₦${AMOUNT_MIN.toLocaleString()} and ₦${AMOUNT_MAX.toLocaleString()}.` }, { status: 400 });
  if (!Number.isInteger(horizonMonths) || horizonMonths < HORIZON_MIN_MONTHS || horizonMonths > HORIZON_MAX_MONTHS)
    return NextResponse.json({ error: `horizonMonths must be a whole number from ${HORIZON_MIN_MONTHS} to ${HORIZON_MAX_MONTHS}.` }, { status: 400 });
  if (!SECTORS.includes(sector))
    return NextResponse.json({ error: `sector must be one of ${SECTORS.join(', ')}.` }, { status: 400 });

  if (!INFERENCE_API_URL) {
    return NextResponse.json(snapshot(sector,
      'The live model service is not configured, so these portfolios are the saved model output for the latest prepared data snapshot.'));
  }

  try {
    const res = await fetch(`${INFERENCE_API_URL}/v1/recommend?sector=${encodeURIComponent(sector)}`, {
      cache: 'no-store',
      headers: INFERENCE_API_TOKEN ? { Authorization: `Bearer ${INFERENCE_API_TOKEN}` } : undefined,
      signal: AbortSignal.timeout(55_000),
    });
    const payload = await res.json().catch(() => null);
    if (res.ok && payload?.portfolios) {
      return NextResponse.json({ ...(payload as Recommendation), source: 'live' } satisfies RecommendationResponse);
    }
    return NextResponse.json(snapshot(sector,
      `The live model service returned an error (${res.status}), so these portfolios are the saved model output for the latest prepared data snapshot.`));
  } catch {
    return NextResponse.json(snapshot(sector,
      'The live model service did not respond in time, so these portfolios are the saved model output for the latest prepared data snapshot.'));
  }
}

export async function GET() {
  if (!INFERENCE_API_URL) return NextResponse.json({ status: 'snapshot', inference: 'not configured' });
  try {
    const res = await fetch(`${INFERENCE_API_URL}/health`, {
      cache: 'no-store',
      headers: INFERENCE_API_TOKEN ? { Authorization: `Bearer ${INFERENCE_API_TOKEN}` } : undefined,
      signal: AbortSignal.timeout(55_000),
    });
    return NextResponse.json({ status: res.ok ? 'ok' : 'unavailable', inference: await res.json().catch(() => null) });
  } catch {
    return NextResponse.json({ status: 'unreachable' }, { status: 502 });
  }
}
