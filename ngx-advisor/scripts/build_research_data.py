"""Build lib/researchData.ts from the thesis results so the web charts use the real numbers.

Run from the ngx-advisor folder:  python scripts/build_research_data.py
"""
import json
from pathlib import Path

import numpy as np
import pandas as pd

APP = Path(__file__).resolve().parents[1]
ROOT = APP.parent
RES = ROOT / 'results'
OUT = APP / 'lib' / 'researchData.ts'

SECTORS = [
    ('Financial',  ['ZENITHBANK', 'GTCO', 'ACCESSCORP', 'FBNH', 'UBA', 'STANBIC', 'FIDELITYBK', 'FCMB', 'ETI', 'WEMABANK', 'STERLINGNG']),
    ('Consumer',   ['NESTLE', 'DANGSUGAR', 'NB', 'INTBREW', 'BUAFOODS', 'FLOURMILLS', 'CADBURY', 'UNILEVE', 'PZ', 'HONYFLOUR', 'GSK']),
    ('Oil & Gas',  ['SEPLAT', 'OANDO', 'TOTAL', 'CONOIL', 'ARADEL']),
    ('Industrial', ['DANGCEM', 'BUACEMENT', 'WAPCO', 'GEREGU', 'PRESCO', 'JBERGER']),
    ('ICT & Other', ['MTNN', 'AIRTELAFRI', 'TRANSCORP', 'NASCON', 'OKOMUOIL', 'LIVESTOCK']),
]
STRATEGY = {'PPO': 'ppo', 'MVO': 'mvo', 'EqualWeight': 'ew'}


def r(x, n=4):
    return None if x is None or (isinstance(x, float) and np.isnan(x)) else round(float(x), n)


def returns_section():
    rets = pd.read_csv(ROOT / 'data/processed/ngx_returns_wide.csv', index_col=0, parse_dates=True)
    pooled = rets.stack().dropna().values * 100
    lo, hi, width = -15.0, 15.0, 0.25
    edges = np.arange(lo, hi + width / 2, width)
    counts, _ = np.histogram(pooled, bins=edges)
    density = counts / (len(pooled) * width)
    mu, sd = pooled.mean(), pooled.std()
    hist = [
        {'x0': r(edges[i], 2), 'x1': r(edges[i + 1], 2), 'density': r(density[i]),
         'normal': r(np.exp(-0.5 * (((edges[i] + edges[i + 1]) / 2 - mu) / sd) ** 2) / (sd * np.sqrt(2 * np.pi))),
         'count': int(counts[i])}
        for i in range(len(counts))
    ]
    dist = pd.read_csv(RES / 'return_distributions.csv')
    jb = [{'symbol': s, 'jb': r(j / 1000, 2), 'skew': r(sk, 3), 'kurt': r(k, 2)}
          for s, j, sk, k in zip(dist.Symbol, dist.JB_Stat, dist.Skewness, dist.Kurtosis)]
    jb.sort(key=lambda d: d['jb'], reverse=True)
    mkt = pd.read_csv(RES / 'market_comparison.csv')
    markets = [{'market': m, 'sharpe': r(s, 3), 'ret': r(ret * 100, 1), 'vol': r(v * 100, 1)}
               for m, s, ret, v in zip(mkt.Market, mkt.Sharpe_Ratio, mkt.Mean_Return, mkt.Volatility)]
    from scipy import stats
    return {
        'histogram': hist,
        'pooledStats': {'skew': r(stats.skew(pooled), 3), 'kurt': r(stats.kurtosis(pooled), 2),
                        'mean': r(mu, 3), 'std': r(sd, 3), 'n': int(len(pooled))},
        'jarqueBera': jb,
        'markets': markets,
    }


def correlation_section():
    corr = pd.read_csv(RES / 'correlation_matrix.csv', index_col=0)
    order = [s for _, names in SECTORS for s in names]
    corr = corr.loc[order, order]
    m = corr.values
    return {
        'symbols': order,
        'sectors': [{'name': sec, 'size': len(names)} for sec, names in SECTORS],
        'matrix': [[r(v, 2) for v in row] for row in m],
    }


def macro_section():
    macro = pd.read_csv(ROOT / 'scripts/ngx_research_data/raw/macro/macro_daily_master.csv',
                        index_col=0, parse_dates=True)
    rets = pd.read_csv(ROOT / 'data/processed/ngx_returns_wide.csv', index_col=0, parse_dates=True)
    liq = pd.read_csv(RES / 'liquidity_analysis.csv').sort_values('Avg_Volume', ascending=False)
    top5 = list(liq.Symbol.head(5))
    vol = rets[top5].rolling(60, min_periods=40).std() * np.sqrt(252) * 100
    avg_vol = vol.mean(axis=1)
    weekly = pd.DataFrame({
        'vol': avg_vol.resample('W-FRI').last(),
        'brent': macro['Brent_USD'].resample('W-FRI').last(),
        'ngn': macro['NGN_USD'].resample('W-FRI').last(),
    }).loc['2012-01-01':'2025-12-31']
    rows = [{'date': d.strftime('%Y-%m-%d'), 'vol': r(v.vol, 1), 'brent': r(v.brent, 2), 'ngn': r(v.ngn, 1)}
            for d, v in weekly.iterrows()]
    return {
        'top5': top5,
        'series': rows,
        'regimes': [
            {'label': 'Oil crash & Naira devaluation', 'start': '2015-01-01', 'end': '2016-12-31'},
            {'label': 'COVID-19 shock', 'start': '2020-01-01', 'end': '2020-08-31'},
            {'label': 'Naira unification crisis', 'start': '2022-06-01', 'end': '2024-03-01'},
        ],
    }


def liquidity_section():
    liq = pd.read_csv(RES / 'liquidity_analysis.csv')
    threshold = float(liq.Coefficient_of_Variation.quantile(0.75))
    cov = [{'symbol': s, 'cov': r(c, 2), 'avgVolume': int(a), 'zeroDays': int(z)}
           for s, c, a, z in zip(liq.Symbol, liq.Coefficient_of_Variation, liq.Avg_Volume, liq.Zero_Vol_Days)]
    cov.sort(key=lambda d: d['cov'], reverse=True)
    zero = sorted([d for d in cov if d['zeroDays'] > 0], key=lambda d: d['zeroDays'], reverse=True)
    illiquid = sum(1 for d in cov if d['cov'] > threshold)
    return {'cov': cov, 'zeroVolume': zero, 'threshold': r(threshold, 2),
            'illiquidCount': illiquid, 'illiquidPct': r(illiquid / len(cov) * 100, 0)}


def gat_section():
    g = pd.read_csv(RES / 'tables/gat_walkforward_metrics.csv')
    names = {'GAT': 'gat', 'RandomForest': 'rf', 'Momentum': 'mom'}
    summary = {names[m]: {'ic': r(d.mean_spearman_ic.mean(), 3), 'spread': r(d.mean_top_bottom_spread.mean() * 100, 2)}
               for m, d in g.groupby('model')}
    annual = []
    for y, d in g.groupby('test_year'):
        row = {'year': int(y), 'months': int(d.months.iloc[0])}
        for _, x in d.iterrows():
            row[names[x.model] + 'IC'] = r(x.mean_spearman_ic, 3)
            row[names[x.model] + 'Spread'] = r(x.mean_top_bottom_spread * 100, 2)
        annual.append(row)
    return {'summary': summary, 'annual': annual}


def ppo_section():
    mr = pd.read_csv(RES / 'tables/ppo_walkforward_monthly_returns.csv')
    piv = mr.pivot_table(index='target_month', columns='strategy', values='net_return').sort_index()
    wealth = (1 + piv).cumprod()
    path = [{'month': '2018-12', 'ppo': 1.0, 'mvo': 1.0, 'ew': 1.0}]
    for mo, row in wealth.iterrows():
        path.append({'month': mo, **{STRATEGY[k]: r(row[k], 4) for k in STRATEGY}})
    ann = pd.read_csv(RES / 'tables/ppo_walkforward_annual_metrics.csv')
    annual = []
    for y, d in ann.groupby('test_year'):
        row = {'year': int(y), 'months': int(d.months.iloc[0])}
        for _, x in d.iterrows():
            k = STRATEGY[x.strategy]
            row[k + 'Sharpe'] = r(x.sharpe_zero_rf, 3)
            row[k + 'CAGR'] = r(x.cagr * 100, 1)
            row[k + 'MaxDD'] = r(x.max_drawdown * 100, 1)
        annual.append(row)
    cs = pd.read_csv(RES / 'tables/ppo_walkforward_cost_sensitivity.csv')
    cost = []
    for c, d in cs.groupby('one_way_cost_bps'):
        row = {'cost': int(c)}
        for _, x in d.iterrows():
            k = STRATEGY[x.strategy]
            row[k] = r(x.sharpe_zero_rf, 3)
            row[k + 'CAGR'] = r(x.cagr * 100, 2)
        cost.append(row)
    return {'wealth': path, 'annual': annual, 'cost': cost}


def sentiment_section():
    cov = pd.read_csv(RES / 'tables/historical_sentiment_coverage_by_year.csv')
    coverage = [{'year': int(y), 'articles': int(a), 'coverage': r(c, 1)}
                for y, a, c in zip(cov.year, cov.unique_articles, cov.trading_day_coverage_pct)]
    met = pd.read_csv(RES / 'tables/sentiment_increment_metrics_2021_2025.csv').set_index('strategy')
    ablation = [
        {'key': k, 'label': lbl, 'cagr': r(met.loc[k, 'cagr'] * 100, 1), 'sharpe': r(met.loc[k, 'sharpe_zero_rf'], 3),
         'turnover': r(met.loc[k, 'average_monthly_turnover'], 3), 'maxDD': r(met.loc[k, 'max_drawdown'] * 100, 1)}
        for k, lbl in [('price_only_momentum', 'Price-only momentum'),
                       ('momentum_plus_sentiment', 'Momentum + sentiment'),
                       ('equal_weight', 'Equal weight')]
    ]
    inc = met.loc['sentiment_increment_vs_price_only']
    mr = pd.read_csv(RES / 'tables/sentiment_increment_monthly_returns_2021_2025.csv')
    piv = mr.pivot_table(index='month', columns='strategy', values='portfolio_return').sort_index()
    wealth = (1 + piv).cumprod()
    keys = {'price_only_momentum': 'mom', 'momentum_plus_sentiment': 'sent', 'equal_weight': 'ew'}
    path = [{'month': '2020-12', 'mom': 1.0, 'sent': 1.0, 'ew': 1.0}]
    for mo, row in wealth.iterrows():
        path.append({'month': mo, **{v: r(row[k], 4) for k, v in keys.items()}})
    return {
        'coverage': coverage, 'ablation': ablation, 'wealth': path,
        'hac': {'t': r(inc.hac_t_stat, 3), 'ciLow': r(inc.hac_95ci_lower_annualized * 100, 1),
                'ciHigh': r(inc.hac_95ci_upper_annualized * 100, 1),
                'annualExcess': r(inc.annualized_mean_excess_return * 100, 2)},
    }


def main():
    data = {
        'returns': returns_section(),
        'correlation': correlation_section(),
        'macro': macro_section(),
        'liquidity': liquidity_section(),
        'gat': gat_section(),
        'ppo': ppo_section(),
        'sentiment': sentiment_section(),
    }
    body = json.dumps(data, separators=(',', ':'), allow_nan=False)
    OUT.write_text(
        '// Generated by scripts/build_research_data.py from ../results - do not edit by hand.\n'
        f'export const RESEARCH = {body};\n'
        'export type ResearchData = typeof RESEARCH;\n',
        encoding='utf-8',
    )
    print(f'wrote {OUT} ({OUT.stat().st_size / 1024:.0f} KB)')


if __name__ == '__main__':
    main()
