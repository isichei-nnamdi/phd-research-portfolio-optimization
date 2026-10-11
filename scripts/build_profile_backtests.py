"""Walk-forward backtest of the advisor's risk-profile portfolios (api/profiles.py).

For every test month 2019-2025 this replays the saved annual models exactly as the
PPO walk-forward evaluation did (scripts/train_ppo_walkforward.py), then applies the
profile rule to the GAT scores and PPO weights. Net returns use the same 10 bps
one-way cost on monthly turnover.

Outputs:
  results/tables/profile_backtest_monthly.csv
  results/tables/profile_backtest_metrics.csv
  ngx-advisor/lib/advisorData.ts   (estimates + precomputed latest-snapshot portfolios)

Run from the repository root:  .venv/Scripts/python.exe scripts/build_profile_backtests.py
"""
from __future__ import annotations

import json
import sys
import warnings
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
warnings.filterwarnings("ignore")

from stable_baselines3 import PPO  # noqa: E402

from api import profiles  # noqa: E402
from api.main import latest_snapshot_payload, recommend  # noqa: E402

INPUT = ROOT / "data" / "processed" / "model_inputs"
TABLES = ROOT / "results" / "tables"
PPO_DIR = ROOT / "results" / "models" / "ppo_walkforward"
OUT_TS = ROOT / "ngx-advisor" / "lib" / "advisorData.ts"
FEATURES = ["ret_1d", "mom_20d", "mom_60d", "vol_20d", "vol_60d", "volume_z_20d"]

NAMES = {
    "ZENITHBANK": "Zenith Bank", "GTCO": "Guaranty Trust Holding Co", "ACCESSCORP": "Access Holdings",
    "FBNH": "FBN Holdings", "UBA": "United Bank for Africa", "STANBIC": "Stanbic IBTC Holdings",
    "FIDELITYBK": "Fidelity Bank", "FCMB": "FCMB Group", "ETI": "Ecobank Transnational",
    "WEMABANK": "Wema Bank", "STERLINGNG": "Sterling Financial Holdings", "NESTLE": "Nestlé Nigeria",
    "DANGSUGAR": "Dangote Sugar Refinery", "NB": "Nigerian Breweries", "INTBREW": "International Breweries",
    "BUAFOODS": "BUA Foods", "FLOURMILLS": "Flour Mills of Nigeria", "CADBURY": "Cadbury Nigeria",
    "UNILEVE": "Unilever Nigeria", "PZ": "PZ Cussons Nigeria", "HONYFLOUR": "Honeywell Flour Mills",
    "GSK": "GSK Consumer Nigeria", "SEPLAT": "Seplat Energy", "OANDO": "Oando",
    "TOTAL": "TotalEnergies Marketing Nigeria", "CONOIL": "Conoil", "ARADEL": "Aradel Holdings",
    "DANGCEM": "Dangote Cement", "BUACEMENT": "BUA Cement", "WAPCO": "Lafarge Africa (WAPCO)",
    "GEREGU": "Geregu Power", "PRESCO": "Presco", "JBERGER": "Julius Berger Nigeria",
    "MTNN": "MTN Nigeria Communications", "AIRTELAFRI": "Airtel Africa", "TRANSCORP": "Transnational Corporation",
    "NASCON": "NASCON Allied Industries", "OKOMUOIL": "Okomu Oil Palm", "LIVESTOCK": "Livestock Feeds",
}


def action_to_weights(action: np.ndarray, eligible: np.ndarray) -> np.ndarray:
    clipped = np.clip(np.asarray(action, dtype=float), -8, 8)
    clipped -= np.max(clipped[eligible])
    weights = np.zeros(len(clipped))
    weights[eligible] = profiles.capped_weights(np.exp(clipped[eligible]))
    return weights


def metrics(net: pd.Series, turnover: pd.Series) -> dict:
    wealth = (1 + net).cumprod()
    vol = net.std(ddof=1) * np.sqrt(12)
    roll12 = (1 + net).rolling(12).apply(np.prod, raw=True).dropna() - 1
    return {
        "months": int(len(net)),
        "cagr": float(wealth.iloc[-1] ** (12 / len(net)) - 1),
        "volatility": float(vol),
        "sharpe": float(net.mean() * 12 / vol) if vol > 0 else None,
        "max_drawdown": float((wealth / wealth.cummax() - 1).min()),
        "turnover": float(turnover.mean()),
        "roll12_p25": float(roll12.quantile(0.25)),
        "roll12_p50": float(roll12.quantile(0.50)),
        "roll12_p75": float(roll12.quantile(0.75)),
        "positive_months": float((net > 0).mean()),
    }


def main() -> None:
    snaps = pd.read_csv(INPUT / "monthly_stock_snapshots.csv", parse_dates=["signal_date"])
    snaps["target_period"] = pd.PeriodIndex(snaps["target_month"], freq="M")
    snaps = snaps.loc[snaps.feature_valid].copy()
    returns = pd.read_csv(INPUT / "simple_returns_pit_daily.csv", index_col=0, parse_dates=True).replace([np.inf, -np.inf], np.nan)
    tickers = returns.columns.tolist()
    volume = pd.read_csv(INPUT / "volume_pit_daily.csv", index_col=0, parse_dates=True).reindex(columns=tickers)

    gat = pd.read_csv(TABLES / "gat_walkforward_predictions.csv")
    # Each fold appends GAT rows first, then Momentum, then RandomForest.
    gat = gat.loc[gat.groupby(["target_period", "ticker"]).cumcount() == 0]
    gat_score = gat.set_index(["target_period", "ticker"])["prediction"]

    reference = pd.read_csv(TABLES / "ppo_walkforward_monthly_returns.csv")
    ref_ppo = reference.loc[reference.strategy == "PPO"].set_index("target_month")["gross_return"]

    rows, check = [], []
    for year in range(2019, 2026):
        meta = json.loads((PPO_DIR / f"ppo_{year}.json").read_text(encoding="utf-8"))
        model = PPO.load(PPO_DIR / f"ppo_{year}.zip", device="cpu")
        mean, std = pd.Series(meta["feature_mean"]), pd.Series(meta["feature_std"]).replace(0, 1).fillna(1)
        test = snaps.loc[snaps.target_period.dt.year.eq(year) & snaps.label_next_month_return.notna()]
        prev_ppo = np.zeros(len(tickers))
        prev = {(s, p.key): {} for s in profiles.SECTOR_FOCUS for p in profiles.PROFILES}
        for period, group in test.groupby("target_period", sort=True):
            group = group.set_index("ticker").reindex(tickers)
            signal_date = pd.Timestamp(group["signal_date"].dropna().iloc[0])
            eligible = (group["active_at_signal"].fillna(False).to_numpy(bool)
                        & group[FEATURES].notna().all(axis=1).to_numpy()
                        & group["label_next_month_return"].notna().to_numpy())
            if eligible.sum() < 5:
                continue
            x = ((group[FEATURES] - mean) / std).replace([np.inf, -np.inf], np.nan).fillna(0).clip(-8, 8)
            state = np.column_stack([x.to_numpy(np.float32), group["active_at_signal"].fillna(False).to_numpy(float), prev_ppo]).astype(np.float32)
            recent = returns.loc[returns.index < signal_date].tail(20)
            market = float(recent.mean(axis=1).mean()) if not recent.empty else 0.0
            obs = np.concatenate([state.ravel(), np.array([market, eligible.mean()], dtype=np.float32)]).clip(-10, 10)
            action, _ = model.predict(obs, deterministic=True)
            ppo_w = action_to_weights(action, eligible)
            label = group["label_next_month_return"].fillna(0).to_numpy(float)
            check.append((str(period), float(ppo_w @ label), float(ref_ppo.get(str(period), np.nan))))
            prev_ppo = ppo_w

            scores = np.array([gat_score.get((str(period), t), np.nan) for t in tickers], dtype=float)
            vol = group["vol_60d"].to_numpy(float)
            history = volume.loc[volume.index < signal_date].tail(profiles.LIQUIDITY_LOOKBACK).to_numpy()
            liquid = profiles.liquidity_mask(history, eligible)
            for sector in profiles.SECTOR_FOCUS:
                built = profiles.build_all(tickers, scores, ppo_w, vol, eligible, sector, liquid)
                for key, port in built.items():
                    w = {r["ticker"]: r["weight"] for r in port}
                    gross = sum(wt * label[tickers.index(t)] for t, wt in w.items())
                    last = prev[(sector, key)]
                    turnover = sum(abs(w.get(t, 0) - last.get(t, 0)) for t in set(w) | set(last))
                    prev[(sector, key)] = w
                    rows.append({"test_year": year, "target_month": str(period), "sector": sector, "profile": key,
                                 "gross_return": gross, "turnover": turnover,
                                 "net_return": gross - profiles.ONE_WAY_COST * turnover,
                                 "holdings": ";".join(f"{t}:{wt:.4f}" for t, wt in w.items())})
        print(f"{year}: replayed")

    diff = np.nanmax([abs(a - b) for _, a, b in check])
    print(f"PPO replay vs recorded walk-forward gross returns: max abs difference {diff:.2e} over {len(check)} months")
    if diff > 1e-6:
        raise SystemExit("Replay does not reproduce the recorded PPO evaluation - aborting.")

    monthly = pd.DataFrame(rows)
    monthly.to_csv(TABLES / "profile_backtest_monthly.csv", index=False)
    metric_rows = []
    for (sector, key), g in monthly.groupby(["sector", "profile"], sort=False):
        metric_rows.append({"sector": sector, "profile": key, **metrics(g.net_return.reset_index(drop=True), g.turnover)})
    metric_frame = pd.DataFrame(metric_rows)
    metric_frame.to_csv(TABLES / "profile_backtest_metrics.csv", index=False)
    print(metric_frame.loc[:, ["sector", "profile", "cagr", "max_drawdown", "sharpe", "roll12_p25", "roll12_p75"]].round(3).to_string(index=False))

    # Reference strategies from the thesis evaluation, same months.
    ref = reference.pivot_table(index="target_month", columns="strategy", values="net_return").sort_index()
    ref_turn = reference.pivot_table(index="target_month", columns="strategy", values="turnover").sort_index()
    refs = {k: metrics(ref[s].reset_index(drop=True), ref_turn[s]) for k, s in (("ppo", "PPO"), ("ew", "EqualWeight"))}

    # Precomputed portfolios for the latest prepared snapshot (served when the live API is unreachable).
    snapshot = {sector: recommend(latest_snapshot_payload(2025), sector) for sector in profiles.SECTOR_FOCUS}
    prices = pd.read_csv(INPUT / "prices_pit_daily.csv", index_col=0, parse_dates=True)
    price_row = prices.loc[prices.index <= pd.Timestamp(next(iter(snapshot.values()))["signal_date"])].ffill().iloc[-1]

    months = sorted(monthly.target_month.unique())
    series = {f"{s}|{k}": [round(float(v), 6) for v in g.sort_values("target_month").net_return]
              for (s, k), g in monthly.groupby(["sector", "profile"], sort=False)}
    data = {
        "profiles": [{"key": p.key, "label": p.label, "size": p.size, "volPercentile": p.vol_percentile} for p in profiles.PROFILES],
        "sectors": list(profiles.SECTOR_FOCUS),
        "sectorCounts": {s: sum(1 for t in tickers if profiles.SECTOR_OF.get(t) == s) for s in profiles.SECTOR_FOCUS if s != "All"},
        "maxWeight": profiles.MAX_WEIGHT, "oneWayCostBps": profiles.ONE_WAY_COST * 10_000,
        "months": months,
        "metrics": {f"{r['sector']}|{r['profile']}": {k: (round(v, 6) if isinstance(v, float) else v) for k, v in r.items() if k not in ("sector", "profile")} for r in metric_rows},
        "monthly": series,
        "reference": {k: {kk: (round(vv, 6) if isinstance(vv, float) else vv) for kk, vv in v.items()} for k, v in refs.items()},
        "snapshot": snapshot,
        "prices": {t: round(float(price_row[t]), 2) for t in tickers if pd.notna(price_row[t])},
        "priceDate": str(price_row.name.date()),
        "names": NAMES,
        "sectorOf": profiles.SECTOR_OF,
    }
    OUT_TS.write_text(
        "// Generated by scripts/build_profile_backtests.py - do not edit by hand.\n"
        f"export const ADVISOR = {json.dumps(data, separators=(',', ':'), allow_nan=False)};\n"
        "export type AdvisorData = typeof ADVISOR;\n",
        encoding="utf-8",
    )
    print(f"wrote {OUT_TS} ({OUT_TS.stat().st_size / 1024:.0f} KB)")


if __name__ == "__main__":
    main()
