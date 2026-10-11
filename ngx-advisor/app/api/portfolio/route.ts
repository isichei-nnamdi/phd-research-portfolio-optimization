import { NextResponse } from 'next/server';

const INFERENCE_API_URL = process.env.INFERENCE_API_URL ?? 'http://127.0.0.1:8000';

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const capital = Number(body.capital ?? 1_000_000);
  const modelYear = Number(body.modelYear ?? 2025);
  if (!Number.isFinite(capital) || capital <= 0) {
    return NextResponse.json({ error: 'capital must be a positive number.' }, { status: 400 });
  }
  if (!Number.isInteger(modelYear) || modelYear < 2019 || modelYear > 2025) {
    return NextResponse.json({ error: 'modelYear must be an integer from 2019 through 2025.' }, { status: 400 });
  }

  try {
    const response = await fetch(
      `${INFERENCE_API_URL}/v1/inference/latest?model_year=${modelYear}`,
      { cache: 'no-store', signal: AbortSignal.timeout(120_000) },
    );
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      return NextResponse.json(
        { error: payload.detail ?? 'Inference service returned an error.' },
        { status: response.status >= 500 ? 502 : response.status },
      );
    }

    const allocations = (payload.ppo_allocations ?? []).map((allocation: { ticker: string; weight: number }) => ({
      symbol: allocation.ticker,
      weight: allocation.weight,
      amount: Math.round(capital * allocation.weight),
      rationale: 'PPO model weight from the selected saved walk-forward fold.',
    }));
    return NextResponse.json({ ...payload, capital, allocations });
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'Unknown inference service error.';
    return NextResponse.json(
      { error: `Cannot reach FastAPI inference service at ${INFERENCE_API_URL}: ${detail}` },
      { status: 502 },
    );
  }
}

export async function GET() {
  try {
    const response = await fetch(`${INFERENCE_API_URL}/health`, { cache: 'no-store' });
    const health = await response.json();
    return NextResponse.json({ status: response.ok ? 'ok' : 'unavailable', inference: health }, { status: response.ok ? 200 : 502 });
  } catch {
    return NextResponse.json({ status: 'unavailable', inference: INFERENCE_API_URL }, { status: 502 });
  }
}
