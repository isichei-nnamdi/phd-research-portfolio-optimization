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

## Deploy to Vercel (zero-config)

### Option A — Vercel CLI (fastest)

```bash
# From inside the ngx-advisor/ folder:
npx vercel --prod
```

Vercel auto-detects Next.js. No further configuration needed.

### Option B — GitHub + Vercel Dashboard

1. Push the `ngx-advisor/` folder to your GitHub repo.
2. Go to [vercel.com/new](https://vercel.com/new).
3. Import the repository.
4. Set **Root Directory** to `ngx-advisor` if the folder is inside a larger repo.
5. Click **Deploy**. Done.

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

- **Next.js 14** (App Router, TypeScript)
- **Tailwind CSS** (custom NGX theme: `#007B3E` green + `#C49A00` gold)
- **Recharts** (all data visualisations)
- **Lucide React** (icons)

---

## Research Data

All data in `lib/data.ts` are actual empirical results from the dissertation:

- `RESEARCH_METRICS` — prototype PPO/MVO/EW pooled statistics
- `WALK_FORWARD_ANNUAL` — year-by-year performance across 7 annual folds
- `COST_SENSITIVITY` — Sharpe ratio at 5/10/25/50 bps one-way cost
- `PORTFOLIO_PROFILES` — GAT+PPO allocation profiles for 3 risk levels
- `NGX_STOCKS` — 15 representative NGX-30 stocks with return/risk statistics

---

*Research prototype only. Not financial advice.*
