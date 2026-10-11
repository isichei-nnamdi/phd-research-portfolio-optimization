# NGX Robo-Advisor Platform

A research demonstration platform for the PhD dissertation:

> **Machine Learning-Enhanced Portfolio Optimisation for the Nigerian Stock Exchange:
> A Two-Stage Graph Attention Network and Proximal Policy Optimisation Framework**
>
> Austin Nnamdi Augustus Isichei | PHD25DTS0002 | CCS-NSUK
> Supervisor: Prof. H. K. Oduwole

Published in **Proceedings of Machine Learning Research, Vol. 319** (IndabaX Nigeria 2026).

---

## Pages

| Route | Description |
|---|---|
| `/` | Hero landing with key metrics and framework overview |
| `/advisor` | Interactive robo-advisor (risk profile → portfolio recommendation) |
| `/research` | Full empirical results: RQ1–RQ4 charts and findings |
| `/api/portfolio` | REST API for portfolio simulation (POST) |

---

## Local model-backed development

The Next.js advisor calls the FastAPI service through the server-side `/api/portfolio` route. Run both processes from the repository root/app directory:

```bash
# Terminal 1, repository root, project Python environment:
..\.venv\Scripts\python.exe -m uvicorn api.main:app --host 127.0.0.1 --port 8000

# Terminal 2, ngx-advisor/ directory:
npm run dev
```

The Next app defaults to `http://127.0.0.1:8000`. Override it in `ngx-advisor/.env.local` using `INFERENCE_API_URL` if the API runs elsewhere. The API must have access to the trained checkpoints and `data/processed/model_inputs`.

## Deployment

This is a split deployment. Build and host the API using `api/Dockerfile`, including the model checkpoints and prepared model-input snapshot in the image. Deploy the Next.js app separately (for example, on Vercel) and set `INFERENCE_API_URL` to the API's reachable HTTPS endpoint. Do not use `localhost` for a remotely deployed frontend. Keep the API private or protect it with authentication, TLS, and rate limits before public exposure.

The repository snapshot currently ends on 2025-11-28. The inference response includes `signal_date` and `stale_days`; this is a historical research demo, not live market data or financial advice.

---

## Local Development

```bash
cd ngx-advisor
npm install
npm run dev
# → http://localhost:3000
```

---

## Tech Stack

- **Next.js 16** (App Router, TypeScript)
- **Tailwind CSS** (custom NGX theme: `#007B3E` green + `#C49A00` gold)
- **Recharts** (all data visualisations)
- **Lucide React** (icons)

---

## Research Data

Research charts and stock descriptions in `lib/data.ts` are static reference content. Advisor allocations are fetched from the FastAPI inference service and are not read from those static profiles:

- `RESEARCH_METRICS` — prototype PPO/MVO/EW pooled statistics
- `WALK_FORWARD_ANNUAL` — year-by-year performance across 7 annual folds
- `COST_SENSITIVITY` — Sharpe ratio at 5/10/25/50 bps one-way cost
- `/api/portfolio` — server-side proxy to the GAT + PPO inference API
- `NGX_STOCKS` — 15 representative NGX-30 stocks with return/risk statistics

---

*Research prototype only. Not financial advice.*
