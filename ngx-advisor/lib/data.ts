// ── Actual prototype results from the PhD dissertation ─────────────────────────

export const RESEARCH_METRICS = {
  panel:       { stocks: 39, years: 14, tradingDays: 3653, startYear: 2012, endYear: 2025 },
  gat:         { ic: 0.054, quintileSpread: 2.22, folds: 7, rfIC: 0.061, momIC: -0.023 },
  ppo:         { sharpe: 1.077, cagr: 29.12, turnover: 15.2, maxDD: -20.64, winRate: 61.8 },
  mvo:         { sharpe: 1.024, cagr: 30.46, turnover: 39.8, maxDD: -20.01 },
  ew:          { sharpe: 1.072, cagr: 28.93, turnover: 13.4 },
  sentiment:   { tStat: -0.820, pValue: 0.41, ci: [-11.7, 4.8] as [number, number] },
  publication: { venue: 'PMLR Vol. 319', event: 'IndabaX Nigeria 2026', year: 2026 },
};

export const WALK_FORWARD_ANNUAL = [
  { year: 2019, months: 11, ppoCAGR: -13.8, mvoCAGR: -20.0, ewCAGR: -13.7, ppoSharpe: -0.67, mvoSharpe: -0.89, ewSharpe: -0.66 },
  { year: 2020, months: 9,  ppoCAGR:  -7.4, mvoCAGR:   1.9, ewCAGR:  -7.3, ppoSharpe:  0.00, mvoSharpe:  0.24, ewSharpe:  0.00 },
  { year: 2021, months: 12, ppoCAGR:  11.5, mvoCAGR:  18.1, ewCAGR:  11.4, ppoSharpe:  0.75, mvoSharpe:  1.45, ewSharpe:  0.74 },
  { year: 2022, months: 11, ppoCAGR:  32.8, mvoCAGR:  33.0, ewCAGR:  32.2, ppoSharpe:  1.58, mvoSharpe:  1.97, ewSharpe:  1.55 },
  { year: 2023, months: 6,  ppoCAGR:  62.7, mvoCAGR:  44.1, ewCAGR:  63.0, ppoSharpe:  4.57, mvoSharpe:  3.06, ewSharpe:  4.48 },
  { year: 2024, months: 10, ppoCAGR: 109.5, mvoCAGR: 102.6, ewCAGR: 108.2, ppoSharpe:  3.74, mvoSharpe:  2.03, ewSharpe:  3.70 },
  { year: 2025, months: 9,  ppoCAGR:  40.9, mvoCAGR:  52.8, ewCAGR:  40.6, ppoSharpe:  1.46, mvoSharpe:  1.98, ewSharpe:  1.46 },
];

export const COST_SENSITIVITY = [
  { cost: 5,  ppoSharpe: 1.080, mvoSharpe: 1.032, ewSharpe: 1.075 },
  { cost: 10, ppoSharpe: 1.077, mvoSharpe: 1.024, ewSharpe: 1.072 },
  { cost: 25, ppoSharpe: 1.067, mvoSharpe: 0.998, ewSharpe: 1.064 },
  { cost: 50, ppoSharpe: 1.051, mvoSharpe: 0.954, ewSharpe: 1.049 },
];

export type Stock = {
  symbol: string; name: string; sector: string;
  annReturn: number; annVol: number; sharpe: number; beta: number;
  description: string;
};

export const NGX_STOCKS: Stock[] = [
  { symbol: 'ZENITHBANK', name: 'Zenith Bank Plc',            sector: 'Financial',   annReturn: 28.4, annVol: 34.2, sharpe: 0.83, beta: 1.02, description: 'Largest Nigerian bank by profitability; anchor of NGX-30 Financial sector' },
  { symbol: 'GTCO',       name: 'Guaranty Trust Holding',     sector: 'Financial',   annReturn: 19.7, annVol: 30.9, sharpe: 0.64, beta: 0.92, description: 'Pan-African fintech holding company; consistent dividend payer' },
  { symbol: 'DANGCEM',    name: 'Dangote Cement Plc',         sector: 'Industrial',  annReturn: 21.7, annVol: 31.4, sharpe: 0.69, beta: 0.87, description: 'Largest cement producer in Africa; defensive from infrastructure spend' },
  { symbol: 'MTNN',       name: 'MTN Nigeria Communications', sector: 'ICT',         annReturn: 26.1, annVol: 30.7, sharpe: 0.85, beta: 0.72, description: 'Market leader in Nigerian telecoms; high data revenue growth' },
  { symbol: 'SEPLAT',     name: 'Seplat Energy Plc',          sector: 'Oil & Gas',   annReturn: 31.7, annVol: 42.2, sharpe: 0.75, beta: 1.41, description: 'Indigenous E&P company; direct beneficiary of Naira-denominated oil revenue' },
  { symbol: 'FBNH',       name: 'FBN Holdings Plc',           sector: 'Financial',   annReturn: 17.6, annVol: 35.2, sharpe: 0.50, beta: 1.05, description: 'Oldest Nigerian banking group; transformation under new management' },
  { symbol: 'UBA',        name: 'United Bank for Africa',     sector: 'Financial',   annReturn: 24.3, annVol: 32.8, sharpe: 0.74, beta: 0.98, description: 'Pan-African bank with operations in 20 African countries' },
  { symbol: 'NESTLE',     name: 'Nestlé Nigeria Plc',         sector: 'Consumer',    annReturn: 14.3, annVol: 27.1, sharpe: 0.53, beta: 0.63, description: 'Multinational FMCG leader; lowest volatility in panel' },
  { symbol: 'AIRTELAFRI', name: 'Airtel Africa Plc',          sector: 'ICT',         annReturn: 18.4, annVol: 34.9, sharpe: 0.53, beta: 0.76, description: 'Pan-African telecom with strong mobile money growth' },
  { symbol: 'ACCESSCORP', name: 'Access Holdings Plc',        sector: 'Financial',   annReturn: 22.2, annVol: 33.5, sharpe: 0.66, beta: 1.11, description: 'Largest Nigerian bank by assets; digital banking expansion' },
  { symbol: 'STANBIC',    name: 'Stanbic IBTC Holdings',      sector: 'Financial',   annReturn: 16.9, annVol: 28.9, sharpe: 0.58, beta: 0.78, description: 'Investment banking and pensions powerhouse; low correlation with peers' },
  { symbol: 'TRANSCORP',  name: 'Transnational Corporation',  sector: 'Conglomerate',annReturn: 24.8, annVol: 38.1, sharpe: 0.65, beta: 1.28, description: 'Energy, hospitality, and agriculture conglomerate; high growth' },
  { symbol: 'TOTAL',      name: 'TotalEnergies Marketing Ng', sector: 'Oil & Gas',   annReturn: 17.8, annVol: 33.6, sharpe: 0.53, beta: 0.94, description: 'Petroleum products marketing and lubricants; stable downstream' },
  { symbol: 'BUACEMENT',  name: 'BUA Cement Plc',             sector: 'Industrial',  annReturn: 19.4, annVol: 33.1, sharpe: 0.59, beta: 0.82, description: 'Fast-growing cement producer; Northern Nigeria infrastructure play' },
  { symbol: 'OANDO',      name: 'Oando Plc',                  sector: 'Oil & Gas',   annReturn: 12.4, annVol: 44.7, sharpe: 0.28, beta: 1.38, description: 'Integrated energy company; high risk, restructuring ongoing' },
];

export type Allocation = { symbol: string; weight: number; rationale: string };
export type PortfolioProfile = {
  label: string; description: string; horizon: string;
  expectedReturn: number; expectedVol: number; sharpe: number; maxDD: number;
  allocations: Allocation[];
};

export const PORTFOLIO_PROFILES: Record<string, PortfolioProfile> = {
  conservative: {
    label: 'Conservative', description: 'Low-volatility stocks with sector diversification and stable earnings streams.',
    horizon: '1 to 3 years', expectedReturn: 16.8, expectedVol: 22.1, sharpe: 0.76, maxDD: -12.4,
    allocations: [
      { symbol: 'ZENITHBANK', weight: 0.22, rationale: 'Highest Sharpe in Financial sector; consistent dividend history' },
      { symbol: 'DANGCEM',    weight: 0.20, rationale: 'Defensive industrial; beta 0.87; infrastructure spending tailwind' },
      { symbol: 'NESTLE',     weight: 0.18, rationale: 'Lowest annual volatility in panel (27.1%); stable FMCG demand' },
      { symbol: 'MTNN',       weight: 0.20, rationale: 'High Sharpe (0.85); low macro correlation; ICT growth driver' },
      { symbol: 'STANBIC',    weight: 0.20, rationale: 'Low beta (0.78); diversified revenue; pensions income buffer' },
    ],
  },
  moderate: {
    label: 'Moderate', description: 'Balanced risk-return mix with momentum tilt and cross-sector diversification.',
    horizon: '3 to 5 years', expectedReturn: 24.5, expectedVol: 29.7, sharpe: 0.82, maxDD: -17.8,
    allocations: [
      { symbol: 'ZENITHBANK', weight: 0.18, rationale: 'Anchor financial holding; positive GAT attention score' },
      { symbol: 'GTCO',       weight: 0.15, rationale: 'Pan-African diversification; consistent ROE above 30%' },
      { symbol: 'SEPLAT',     weight: 0.18, rationale: 'Oil-sector momentum; direct NGN oil revenue exposure' },
      { symbol: 'DANGCEM',    weight: 0.15, rationale: 'Industrial ballast; infrastructure capex tailwind' },
      { symbol: 'ACCESSCORP', weight: 0.14, rationale: 'Largest balance sheet; expansion momentum post-merger' },
      { symbol: 'MTNN',       weight: 0.20, rationale: 'High GAT quintile score; leading ICT equity in Nigeria' },
    ],
  },
  aggressive: {
    label: 'Aggressive', description: 'High-momentum selections from top-quintile GAT pre-selection output.',
    horizon: '5 or more years', expectedReturn: 38.2, expectedVol: 41.6, sharpe: 0.92, maxDD: -26.3,
    allocations: [
      { symbol: 'SEPLAT',     weight: 0.25, rationale: 'Top GAT quintile score (2024 to 2025 folds); oil cycle upside' },
      { symbol: 'TRANSCORP',  weight: 0.20, rationale: 'Highest momentum in Conglomerate sector; energy asset monetisation' },
      { symbol: 'ACCESSCORP', weight: 0.20, rationale: 'Aggressive expansion; digital banking growth trajectory' },
      { symbol: 'ZENITHBANK', weight: 0.20, rationale: 'Anchor quality holding; strong earnings momentum sustained' },
      { symbol: 'MTNN',       weight: 0.15, rationale: 'Consistent top-quintile GAT selection across 2023 to 2025 folds' },
    ],
  },
};

export function generateWealthPath(cagr: number, vol: number, months = 68): number[] {
  const mr  = cagr / 100 / 12;
  const mv  = vol  / 100 / Math.sqrt(12);
  let w     = 1.0;
  const path: number[] = [w];
  for (let i = 1; i <= months; i++) {
    const noise = Math.sin(i * 2.7183 + cagr * 0.1) * mv * 0.55;
    w *= (1 + mr + noise);
    path.push(Math.max(0.15, w));
  }
  return path;
}

export const MONTH_LABELS: string[] = [];
for (let i = 0; i < 69; i++) {
  const d = new Date(2019, i, 1);
  const mo = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][d.getMonth()];
  MONTH_LABELS.push(`${mo} '${d.getFullYear().toString().slice(2)}`);
}

export const SECTOR_COLORS: Record<string, string> = {
  'Financial':    '#3b82f6',
  'Industrial':   '#f59e0b',
  'Consumer':     '#10b981',
  'Oil & Gas':    '#ef4444',
  'ICT':          '#8b5cf6',
  'Conglomerate': '#06b6d4',
  'Agro':         '#84cc16',
};
