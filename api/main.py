"""FastAPI inference service for the repository's annual GAT and PPO models."""

from __future__ import annotations

import json
import os
from datetime import date, datetime, timezone
from functools import lru_cache
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd
import torch
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from stable_baselines3 import PPO
from torch import nn
from torch_geometric.nn import GATConv


ROOT = Path(__file__).resolve().parents[1]
FEATURES = ["ret_1d", "mom_20d", "mom_60d", "vol_20d", "vol_60d", "volume_z_20d"]
GAT_DIR = ROOT / "results" / "models" / "gat_walkforward"
PPO_DIR = ROOT / "results" / "models" / "ppo_walkforward"
INPUT_DIR = ROOT / "data" / "processed" / "model_inputs"
MAX_WEIGHT = 0.20
SUPPORTED_YEARS = list(range(2019, 2026))

torch.set_num_threads(1)


class StockGAT(nn.Module):
    def __init__(self, input_dim: int, hidden_dim: int = 16):
        super().__init__()
        self.layer1 = GATConv(input_dim, hidden_dim, heads=2, dropout=0.15)
        self.layer2 = GATConv(hidden_dim * 2, hidden_dim, heads=1, concat=False, dropout=0.15)
        self.output = nn.Linear(hidden_dim, 1)

    def forward(self, x: torch.Tensor, edge_index: torch.Tensor) -> torch.Tensor:
        x = torch.nn.functional.elu(self.layer1(x, edge_index))
        x = torch.nn.functional.dropout(x, p=0.15, training=self.training)
        x = torch.nn.functional.elu(self.layer2(x, edge_index))
        return self.output(x).squeeze(-1)


class AssetFeatures(BaseModel):
    ticker: str = Field(min_length=1, max_length=32)
    active: bool = True
    features: dict[str, float | None]


class InferenceRequest(BaseModel):
    signal_date: date
    model_year: int = Field(default=2025, ge=2019, le=2025)
    assets: list[AssetFeatures] = Field(min_length=5, max_length=60)
    recent_returns: dict[str, list[float | None]] = Field(
        description="Chronological daily simple returns keyed by ticker; ideally >=60 rows."
    )
    previous_weights: dict[str, float] = Field(default_factory=dict)


def _artifact_paths(year: int) -> tuple[Path, Path, Path]:
    gat_path = GAT_DIR / f"gat_{year}.pt"
    ppo_path = PPO_DIR / f"ppo_{year}.zip"
    metadata_path = PPO_DIR / f"ppo_{year}.json"
    if not gat_path.exists() or not ppo_path.exists() or not metadata_path.exists():
        raise HTTPException(
            status_code=503,
            detail=f"Model fold {year} is unavailable or missing inference metadata; retrain models with the current scripts.",
        )
    return gat_path, ppo_path, metadata_path


@lru_cache(maxsize=7)
def load_models(year: int) -> tuple[StockGAT, dict[str, Any], PPO, dict[str, Any]]:
    gat_path, ppo_path, metadata_path = _artifact_paths(year)
    try:
        gat_bundle = torch.load(gat_path, map_location="cpu", weights_only=True)
        gat_meta = {
            key: value
            for key, value in gat_bundle.items()
            if key != "state_dict"
        }
        gat = StockGAT(input_dim=len(gat_meta.get("features", FEATURES)))
        gat.load_state_dict(gat_bundle["state_dict"])
        gat.eval()
        ppo_meta = json.loads(metadata_path.read_text(encoding="utf-8"))
        ppo = PPO.load(ppo_path, device="cpu")
        return gat, gat_meta, ppo, ppo_meta
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Unable to load fold {year} inference artifacts: {exc}") from exc


def _weights_from_scores(scores: np.ndarray, eligible: np.ndarray, cap: float = MAX_WEIGHT) -> np.ndarray:
    weights = np.zeros_like(scores, dtype=float)
    indices = np.flatnonzero(eligible)
    if len(indices) < int(np.ceil(1 / cap)):
        raise HTTPException(status_code=422, detail=f"At least {int(np.ceil(1 / cap))} eligible assets are required for the {cap:.0%} weight cap.")
    local = np.maximum(scores[indices], 1e-8)
    local /= local.sum()
    free = np.ones(len(indices), dtype=bool)
    allocated = np.zeros(len(indices), dtype=float)
    remaining = 1.0
    while free.any():
        free_indices = np.flatnonzero(free)
        proposed = remaining * local[free] / local[free].sum()
        over = proposed > cap
        if not over.any():
            allocated[free_indices] = proposed
            break
        capped = free_indices[over]
        allocated[capped] = cap
        remaining -= cap * len(capped)
        free[capped] = False
    weights[indices] = allocated
    return weights


def _recent_return_matrix(request: InferenceRequest, tickers: list[str]) -> np.ndarray:
    lengths = {len(values) for values in request.recent_returns.values()}
    if len(lengths) != 1 or not lengths or next(iter(lengths)) < 30:
        raise HTTPException(status_code=422, detail="recent_returns must have equal-length ticker series with at least 30 observations.")
    matrix = np.full((next(iter(lengths)), len(tickers)), np.nan, dtype=float)
    supplied = request.recent_returns
    for index, ticker in enumerate(tickers):
        if ticker in supplied:
            matrix[:, index] = np.array(
                [np.nan if value is None else float(value) for value in supplied[ticker]],
                dtype=float,
            )
    return matrix


def run_inference(payload: InferenceRequest) -> dict[str, Any]:
    gat, gat_meta, ppo, ppo_meta = load_models(payload.model_year)
    tickers = list(gat_meta["tickers"])
    features = list(gat_meta["features"])
    supplied = {asset.ticker: asset for asset in payload.assets}
    unknown = sorted(set(supplied) - set(tickers))
    missing = sorted(set(tickers) - set(supplied))
    if unknown or missing:
        raise HTTPException(status_code=422, detail={"unknown_tickers": unknown, "missing_tickers": missing})

    assets = [supplied[ticker] for ticker in tickers]
    active = np.array([asset.active for asset in assets], dtype=bool)
    raw_features = np.array(
        [[np.nan if asset.features.get(feature) is None else asset.features.get(feature, np.nan) for feature in features] for asset in assets],
        dtype=float,
    )
    feature_valid = np.isfinite(raw_features).all(axis=1)
    eligible = active & feature_valid
    if eligible.sum() < 5:
        raise HTTPException(status_code=422, detail="At least five active assets with all required features are needed.")

    means = np.array([gat_meta["feature_mean"][feature] for feature in features], dtype=float)
    scales = np.array([gat_meta["feature_std"][feature] for feature in features], dtype=float)
    scales[~np.isfinite(scales) | (scales == 0)] = 1.0
    normalized = np.nan_to_num((raw_features - means) / scales, nan=0.0, posinf=0.0, neginf=0.0)
    normalized = np.clip(normalized, -8, 8).astype(np.float32)

    returns = _recent_return_matrix(payload, tickers)
    graph_settings = gat_meta["graph"]
    recent = returns[-graph_settings["lookback_sessions"] :]
    correlation = pd.DataFrame(recent, columns=tickers).corr(min_periods=graph_settings["minimum_pairwise_observations"]).fillna(0).to_numpy()
    edge_set = {(index, index) for index, valid in enumerate(eligible) if valid}
    for left in range(len(tickers)):
        if not eligible[left]:
            continue
        neighbors = [
            (abs(correlation[left, right]), right)
            for right in range(len(tickers))
            if right != left and eligible[right] and abs(correlation[left, right]) >= graph_settings["absolute_correlation_threshold"]
        ]
        for _, right in sorted(neighbors, reverse=True)[: graph_settings["maximum_neighbors"]]:
            edge_set.add((left, right))
            edge_set.add((right, left))
    edge_index = torch.tensor(sorted(edge_set), dtype=torch.long).t().contiguous()
    with torch.inference_mode():
        gat_scores = gat(torch.from_numpy(normalized), edge_index).cpu().numpy()
    gat_scores = np.where(eligible, gat_scores, -np.inf)
    rank_order = np.argsort(-gat_scores)

    ppo_features = list(ppo_meta["features"])
    ppo_means = np.array([ppo_meta["feature_mean"][name] for name in ppo_features], dtype=float)
    ppo_scales = np.array([ppo_meta["feature_std"][name] for name in ppo_features], dtype=float)
    ppo_scales[~np.isfinite(ppo_scales) | (ppo_scales == 0)] = 1.0
    raw_ppo_features = np.array(
        [[np.nan if asset.features.get(feature) is None else asset.features.get(feature, np.nan) for feature in ppo_features] for asset in assets],
        dtype=float,
    )
    ppo_normalized = np.clip(np.nan_to_num((raw_ppo_features - ppo_means) / ppo_scales), -8, 8)
    prior = np.array([payload.previous_weights.get(ticker, 0.0) for ticker in tickers], dtype=float)
    recent_market = np.nanmean(returns[-20:], axis=1)
    market_return = float(np.nan_to_num(np.nanmean(recent_market), nan=0.0))
    ppo_state = np.column_stack([ppo_normalized, active.astype(float), prior]).astype(np.float32)
    observation = np.concatenate([ppo_state.ravel(), np.array([market_return, eligible.mean()], dtype=np.float32)]).clip(-10, 10)
    action, _ = ppo.predict(observation, deterministic=True)
    action = np.clip(np.asarray(action, dtype=float), -8, 8)
    action -= np.max(action[eligible])
    ppo_weights = _weights_from_scores(np.exp(action), eligible, float(ppo_meta["max_weight"]))

    gat_rankings = [
        {"ticker": tickers[index], "score": float(gat_scores[index]), "rank": rank + 1}
        for rank, index in enumerate(rank_order)
        if eligible[index]
    ]
    allocations = [
        {"ticker": ticker, "weight": float(weight)}
        for ticker, weight in zip(tickers, ppo_weights)
        if weight > 0
    ]
    days_stale = (datetime.now(timezone.utc).date() - payload.signal_date).days
    return {
        "signal_date": payload.signal_date.isoformat(),
        "model_year": payload.model_year,
        "stale_days": days_stale,
        "eligible_assets": int(eligible.sum()),
        "gat_rankings": gat_rankings,
        "ppo_allocations": allocations,
        "meta": {
            "gat_validation_epoch": gat_meta.get("selected_epoch"),
            "ppo_training_timesteps": ppo_meta["training_timesteps"],
            "ppo_max_weight": ppo_meta["max_weight"],
            "research_prototype": True,
            "disclaimer": "Research prototype only. Not financial advice.",
        },
    }


def latest_snapshot_payload(model_year: int = 2025) -> InferenceRequest:
    snapshot_path = INPUT_DIR / "monthly_stock_snapshots.csv"
    returns_path = INPUT_DIR / "simple_returns_pit_daily.csv"
    active_path = INPUT_DIR / "active_mask_daily.csv"
    if not all(path.exists() for path in (snapshot_path, returns_path, active_path)):
        raise HTTPException(status_code=503, detail="Prepared model inputs are missing. Run scripts/prepare_model_data.py first.")
    snapshots = pd.read_csv(snapshot_path, parse_dates=["signal_date"])
    snapshots = snapshots.sort_values("signal_date")
    latest = snapshots.iloc[-len(snapshots["ticker"].unique()) :].copy()
    signal_date = pd.Timestamp(latest["signal_date"].max())
    returns = pd.read_csv(returns_path, index_col=0, parse_dates=True)
    returns = returns.loc[returns.index < signal_date].tail(60)
    tickers = returns.columns.tolist()
    active = pd.read_csv(active_path, index_col=0, parse_dates=True)
    active_row = active.loc[signal_date, tickers].astype(bool)
    latest_by_ticker = latest.set_index("ticker").reindex(tickers)
    assets = [
        AssetFeatures(
            ticker=ticker,
            active=bool(active_row[ticker]),
            features={feature: (None if pd.isna(latest_by_ticker.loc[ticker, feature]) else float(latest_by_ticker.loc[ticker, feature])) for feature in FEATURES},
        )
        for ticker in tickers
    ]
    recent_returns = {
        ticker: [None if pd.isna(value) else float(value) for value in returns[ticker].tolist()]
        for ticker in tickers
    }
    return InferenceRequest(
        signal_date=signal_date.date(),
        model_year=model_year,
        assets=assets,
        recent_returns=recent_returns,
    )


app = FastAPI(title="NGX GAT + PPO Inference API", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("CORS_ORIGINS", "http://localhost:3000").split(","),
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type", "Authorization"],
)


@app.get("/health")
def health() -> dict[str, Any]:
    available = {
        str(year): (GAT_DIR / f"gat_{year}.pt").exists()
        and (PPO_DIR / f"ppo_{year}.zip").exists()
        and (PPO_DIR / f"ppo_{year}.json").exists()
        for year in SUPPORTED_YEARS
    }
    return {"status": "ok", "models": available}


@app.post("/v1/inference")
def inference(payload: InferenceRequest) -> dict[str, Any]:
    return run_inference(payload)


@app.get("/v1/inference/latest")
def inference_latest(model_year: int = 2025) -> dict[str, Any]:
    if model_year not in SUPPORTED_YEARS:
        raise HTTPException(status_code=422, detail=f"model_year must be one of {SUPPORTED_YEARS}")
    return run_inference(latest_snapshot_payload(model_year))