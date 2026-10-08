"""Build leakage-aware, point-in-time panels for annual GAT/RL evaluation."""

from __future__ import annotations

import importlib.util
from pathlib import Path

import numpy as np
import pandas as pd


ROOT = Path(__file__).resolve().parents[1]
RETURNS_PATH = ROOT / "data" / "processed" / "ngx_returns_wide.csv"
PRICES_PATH = ROOT / "data" / "processed" / "ngx_prices_wide.csv"
VOLUME_PATH = ROOT / "data" / "processed" / "ngx_volume_wide.csv"
OUTPUT_DIR = ROOT / "data" / "processed" / "model_inputs"
MEMBERSHIP_SCRIPT = ROOT / "scripts" / "ngx_data_downloader.py"


def load_membership() -> pd.DataFrame:
    spec = importlib.util.spec_from_file_location("ngx_data_downloader", MEMBERSHIP_SCRIPT)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Unable to load membership definitions from {MEMBERSHIP_SCRIPT}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module.MEMBERSHIP_DF.copy()


def align_panel(path: Path, columns: list[str]) -> pd.DataFrame:
    panel = pd.read_csv(path, index_col=0, parse_dates=True)
    panel = panel.apply(pd.to_numeric, errors="coerce").sort_index()
    missing = sorted(set(columns) - set(panel.columns))
    if missing:
        raise ValueError(f"{path.name} is missing return-panel symbols: {missing}")
    return panel.reindex(columns=columns)


def build_daily_inputs() -> tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame]:
    returns = pd.read_csv(RETURNS_PATH, index_col=0, parse_dates=True)
    returns = returns.apply(pd.to_numeric, errors="coerce").sort_index()
    tickers = returns.columns.astype(str).tolist()
    prices = align_panel(PRICES_PATH, tickers)
    volume = align_panel(VOLUME_PATH, tickers)
    returns = returns.replace([np.inf, -np.inf], np.nan)

    membership = load_membership()
    membership["Entry_Date"] = pd.to_datetime(membership["Entry_Date"])
    membership["Exit_Date"] = pd.to_datetime(membership["Exit_Date"])
    membership = membership.set_index("Symbol").reindex(tickers)
    if membership["Entry_Date"].isna().any():
        missing = membership.index[membership["Entry_Date"].isna()].tolist()
        raise ValueError(f"Return symbols lack point-in-time membership: {missing}")

    dates = pd.DatetimeIndex(returns.index)
    active = pd.DataFrame(False, index=dates, columns=tickers)
    for ticker in tickers:
        row = membership.loc[ticker]
        active[ticker] = (dates >= row["Entry_Date"]) & (dates <= row["Exit_Date"])

    # Use daily simple returns for portfolio accounting; retain raw source returns separately.
    simple_returns = prices.pct_change(fill_method=None).replace([np.inf, -np.inf], np.nan)
    simple_returns = simple_returns.where(active)
    active &= prices.notna()
    features = {}
    for ticker in tickers:
        price = prices[ticker].where(active[ticker])
        ret = simple_returns[ticker]
        vol = volume[ticker].where(active[ticker])
        features[(ticker, "ret_1d")] = ret.shift(1)
        features[(ticker, "mom_20d")] = price.pct_change(20, fill_method=None).shift(1)
        features[(ticker, "mom_60d")] = price.pct_change(60, fill_method=None).shift(1)
        features[(ticker, "vol_20d")] = ret.rolling(20, min_periods=15).std().shift(1)
        features[(ticker, "vol_60d")] = ret.rolling(60, min_periods=40).std().shift(1)
        features[(ticker, "volume_z_20d")] = (
            (np.log1p(vol.clip(lower=0)) - np.log1p(vol.clip(lower=0)).rolling(20, min_periods=15).mean())
            / np.log1p(vol.clip(lower=0)).rolling(20, min_periods=15).std()
        ).shift(1)
    feature_panel = pd.concat(features, axis=1)
    feature_panel.columns = pd.MultiIndex.from_tuples(feature_panel.columns, names=["ticker", "feature"])

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    active.to_csv(OUTPUT_DIR / "active_mask_daily.csv")
    simple_returns.to_csv(OUTPUT_DIR / "simple_returns_pit_daily.csv")
    prices.where(active).to_csv(OUTPUT_DIR / "prices_pit_daily.csv")
    volume.where(active).to_csv(OUTPUT_DIR / "volume_pit_daily.csv")
    feature_panel.to_csv(OUTPUT_DIR / "features_pit_daily.csv")
    membership.reset_index().to_csv(OUTPUT_DIR / "membership_used.csv", index=False)
    return feature_panel, simple_returns, active


def build_monthly_snapshots(
    feature_panel: pd.DataFrame,
    simple_returns: pd.DataFrame,
    active: pd.DataFrame,
) -> pd.DataFrame:
    tickers = simple_returns.columns.tolist()
    month_ends = simple_returns.groupby(simple_returns.index.to_period("M")).apply(
        lambda frame: frame.index.max(), include_groups=False
    )
    rows = []
    for period, signal_date in month_ends.items():
        next_period = period + 1
        target = simple_returns.loc[simple_returns.index.to_period("M") == next_period]
        if target.empty:
            continue
        target_returns = (1 + target).prod(min_count=1) - 1
        signal_features = feature_panel.loc[signal_date]
        signal_active = active.loc[signal_date]
        for ticker in tickers:
            values = signal_features[ticker].to_dict()
            valid = signal_active[ticker] and target_returns.get(ticker, np.nan) == target_returns.get(ticker, np.nan)
            row = {
                "signal_date": signal_date,
                "target_month": str(next_period),
                "ticker": ticker,
                "active_at_signal": bool(signal_active[ticker]),
                "label_next_month_return": float(target_returns[ticker]) if valid else np.nan,
            }
            row.update(values)
            rows.append(row)

    monthly = pd.DataFrame(rows)
    feature_columns = ["ret_1d", "mom_20d", "mom_60d", "vol_20d", "vol_60d", "volume_z_20d"]
    monthly["feature_valid"] = monthly[feature_columns].notna().all(axis=1)
    eligible_labels = monthly["active_at_signal"] & monthly["label_next_month_return"].notna()
    monthly["label_rank"] = np.nan
    monthly.loc[eligible_labels, "label_rank"] = (
        monthly.loc[eligible_labels]
        .groupby("target_month")["label_next_month_return"]
        .rank(pct=True)
    )
    monthly.to_csv(OUTPUT_DIR / "monthly_stock_snapshots.csv", index=False)
    return monthly


def main() -> None:
    features, simple_returns, active = build_daily_inputs()
    snapshots = build_monthly_snapshots(features, simple_returns, active)
    dates = pd.to_datetime(snapshots["signal_date"])
    print(f"Assets: {simple_returns.shape[1]}; daily dates: {len(simple_returns)}")
    print(f"PIT daily return coverage: {simple_returns.notna().mean().mean():.1%}")
    print(f"Monthly snapshots: {len(snapshots)}; signal range: {dates.min().date()} to {dates.max().date()}")
    print(f"Valid monthly labels: {snapshots.label_next_month_return.notna().sum()}")
    print(f"Saved model inputs to {OUTPUT_DIR}")


if __name__ == "__main__":
    main()