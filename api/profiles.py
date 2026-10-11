"""Risk-profile portfolios built on top of the GAT + PPO outputs.

This module is the single source of truth for how the advisor turns model outputs
into Conservative / Moderate / Aggressive portfolios. It is used both by the live
API (`/v1/recommend`) and by `scripts/build_profile_backtests.py`, so the historical
estimates shown to users come from exactly the rule that produces live portfolios.

Rule (applied at each monthly signal date):
  1. Liquidity filter (RQ4): drop stocks with any no-trade day in the last 60
     sessions or with median volume in the bottom quartile of eligible stocks.
  2. Risk screen: Conservative keeps stocks whose 60-day volatility is at or below
     the 70th percentile of the remaining universe.
  3. Stage 1 - GAT pre-selection: take the top-k stocks by GAT score, preferring the
     chosen sector focus and filling from other sectors if the focus is too small.
  4. Stage 2 - PPO allocation: use the PPO weights of the selected stocks,
     renormalised and capped at 20% per stock (the cap used in training).
Risk is set by concentration: Conservative holds 10 stocks, Moderate 8, Aggressive 5.
Each filter is skipped if it would leave fewer than k candidates. Portfolios are
rebalanced monthly, matching the walk-forward evaluation.

Note: the profile sizes and the 70th-percentile screen were chosen after comparing a
small set of variants on the 2019-2025 test months, so the historical estimates are
in-sample for this rule and likely optimistic.
"""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np

MAX_WEIGHT = 0.20
ONE_WAY_COST = 0.001  # 10 bps, as in the PPO walk-forward evaluation
REBALANCE = "monthly"


@dataclass(frozen=True)
class Profile:
    key: str
    label: str
    size: int
    vol_percentile: float | None  # None = no volatility screen


PROFILES: tuple[Profile, ...] = (
    Profile("conservative", "Conservative", 10, 0.70),
    Profile("moderate", "Moderate", 8, None),
    Profile("aggressive", "Aggressive", 5, None),
)
LIQUIDITY_LOOKBACK = 60
LIQUIDITY_MIN_VOLUME_QUANTILE = 0.25

# Sector grouping follows the thesis (Figure 4.2); MTNN and AIRTELAFRI form the ICT focus.
SECTOR_OF: dict[str, str] = {
    **{t: "Financial" for t in ["ZENITHBANK", "GTCO", "ACCESSCORP", "FBNH", "UBA", "STANBIC", "FIDELITYBK", "FCMB", "ETI", "WEMABANK", "STERLINGNG"]},
    **{t: "Consumer" for t in ["NESTLE", "DANGSUGAR", "NB", "INTBREW", "BUAFOODS", "FLOURMILLS", "CADBURY", "UNILEVE", "PZ", "HONYFLOUR", "GSK"]},
    **{t: "Oil & Gas" for t in ["SEPLAT", "OANDO", "TOTAL", "CONOIL", "ARADEL"]},
    **{t: "Industrial" for t in ["DANGCEM", "BUACEMENT", "WAPCO", "GEREGU", "PRESCO", "JBERGER"]},
    **{t: "ICT" for t in ["MTNN", "AIRTELAFRI"]},
    **{t: "Conglomerate & Agro" for t in ["TRANSCORP", "NASCON", "OKOMUOIL", "LIVESTOCK"]},
}
SECTOR_FOCUS = ("All", "Financial", "Oil & Gas", "Consumer", "ICT")


def capped_weights(scores: np.ndarray, cap: float = MAX_WEIGHT) -> np.ndarray:
    """Normalise positive scores to weights summing to 1 with no weight above `cap`."""
    local = np.maximum(np.asarray(scores, dtype=float), 1e-12)
    local = local / local.sum()
    weights = np.zeros_like(local)
    free = np.ones(len(local), dtype=bool)
    remaining = 1.0
    while free.any():
        idx = np.flatnonzero(free)
        proposal = remaining * local[free] / local[free].sum()
        over = proposal > cap + 1e-12
        if not over.any():
            weights[idx] = proposal
            break
        weights[idx[over]] = cap
        remaining -= cap * over.sum()
        free[idx[over]] = False
    return weights


def liquidity_mask(volume_history: np.ndarray, eligible: np.ndarray) -> np.ndarray:
    """Point-in-time liquidity screen from the trailing daily volume matrix (sessions x tickers)."""
    volume = np.nan_to_num(np.asarray(volume_history, dtype=float), nan=0.0)
    no_trade_free = (volume <= 0).sum(axis=0) == 0
    median = np.median(volume, axis=0)
    eligible = np.asarray(eligible, dtype=bool)
    floor = np.quantile(median[eligible], LIQUIDITY_MIN_VOLUME_QUANTILE) if eligible.any() else 0.0
    return no_trade_free & (median >= floor)


def select_portfolio(tickers: list[str], gat_scores: np.ndarray, ppo_weights: np.ndarray,
                     vol_60d: np.ndarray, eligible: np.ndarray, profile: Profile,
                     sector: str = "All", liquid: np.ndarray | None = None) -> list[dict]:
    """Return [{ticker, sector, weight, gat_rank, in_focus}] for one profile."""
    k = profile.size
    candidates = np.asarray(eligible, dtype=bool) & np.isfinite(gat_scores) & np.isfinite(vol_60d)
    if candidates.sum() < k:
        raise ValueError(f"Only {int(candidates.sum())} eligible stocks; {profile.label} needs {k}.")
    gat_order = np.flatnonzero(candidates)[np.argsort(-gat_scores[candidates], kind="stable")]
    gat_rank = {int(i): r + 1 for r, i in enumerate(gat_order)}

    if liquid is not None and (candidates & liquid).sum() >= k:
        candidates = candidates & liquid
    if profile.vol_percentile is not None:
        limit = np.quantile(vol_60d[candidates], profile.vol_percentile)
        screened = candidates & (vol_60d <= limit)
        if screened.sum() >= k:
            candidates = screened

    def in_focus(i: int) -> bool:
        return sector == "All" or SECTOR_OF.get(tickers[i]) == sector

    by_gat = [int(i) for i in gat_order if candidates[i]]
    chosen = ([i for i in by_gat if in_focus(i)] + [i for i in by_gat if not in_focus(i)])[:k]

    ppo = np.array([ppo_weights[i] for i in chosen], dtype=float)
    weights = capped_weights(ppo if ppo.sum() > 0 else np.ones(len(chosen)))
    rows = [
        {"ticker": tickers[i], "sector": SECTOR_OF.get(tickers[i], "Other"), "weight": float(w),
         "gat_rank": gat_rank[i], "in_focus": in_focus(i)}
        for i, w in zip(chosen, weights)
    ]
    return sorted(rows, key=lambda r: -r["weight"])


def build_all(tickers: list[str], gat_scores: np.ndarray, ppo_weights: np.ndarray,
              vol_60d: np.ndarray, eligible: np.ndarray, sector: str = "All",
              liquid: np.ndarray | None = None) -> dict[str, list[dict]]:
    return {p.key: select_portfolio(tickers, gat_scores, ppo_weights, vol_60d, eligible, p, sector, liquid) for p in PROFILES}
