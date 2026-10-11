// ── Actual prototype results from the PhD dissertation ─────────────────────────

export const RESEARCH_METRICS = {
  panel:       { stocks: 39, years: 14, tradingDays: 3653, startYear: 2012, endYear: 2025 },
  gat:         { ic: 0.054, quintileSpread: 2.22, folds: 7, rfIC: 0.061, momIC: -0.023 },
  // Pooled 68 test months at 10 bps one-way cost: results/tables/ppo_walkforward_cost_sensitivity.csv
  ppo:         { sharpe: 1.077, cagr: 25.60, turnover: 15.2, maxDD: -39.83, winRate: 61.8 },
  mvo:         { sharpe: 1.024, cagr: 26.39, turnover: 39.8, maxDD: -40.51 },
  ew:          { sharpe: 1.072, cagr: 25.43, turnover: 13.4, maxDD: -39.64 },
  sentiment:   { tStat: -0.820, pValue: 0.41, ci: [-11.7, 4.8] as [number, number] },
  publication: { venue: 'PMLR Vol. 319', event: 'IndabaX Nigeria 2026', year: 2026 },
};
