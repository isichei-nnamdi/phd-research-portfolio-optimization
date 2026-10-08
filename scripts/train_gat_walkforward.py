"""Train annual expanding-window GAT stock rankings for 2019–2025."""

from __future__ import annotations

import random
from pathlib import Path

import numpy as np
import pandas as pd
import torch
from sklearn.ensemble import RandomForestRegressor
from scipy.stats import spearmanr
from torch import nn
from torch_geometric.nn import GATConv


ROOT = Path(__file__).resolve().parents[1]
INPUT_DIR = ROOT / "data" / "processed" / "model_inputs"
RETURN_PATH = INPUT_DIR / "simple_returns_pit_daily.csv"
ACTIVE_PATH = INPUT_DIR / "active_mask_daily.csv"
SNAPSHOT_PATH = INPUT_DIR / "monthly_stock_snapshots.csv"
OUT_DIR = ROOT / "results" / "models" / "gat_walkforward"
TABLE_DIR = ROOT / "results" / "tables"
FEATURES = ["ret_1d", "mom_20d", "mom_60d", "vol_20d", "vol_60d", "volume_z_20d"]
SEED = 42


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


def seed_everything(seed: int) -> None:
    random.seed(seed)
    np.random.seed(seed)
    torch.manual_seed(seed)


def prepare_snapshots() -> tuple[pd.DataFrame, pd.DataFrame]:
    snapshots = pd.read_csv(SNAPSHOT_PATH, parse_dates=["signal_date"])
    snapshots["target_period"] = pd.PeriodIndex(snapshots["target_month"], freq="M")
    returns = pd.read_csv(RETURN_PATH, index_col=0, parse_dates=True)
    active = pd.read_csv(ACTIVE_PATH, index_col=0, parse_dates=True).astype(bool)
    return snapshots, (returns, active)


def make_graph(signal_date: pd.Timestamp, tickers: list[str], returns: pd.DataFrame,
               active: pd.DataFrame, node_mask: np.ndarray) -> torch.Tensor:
    history = returns.loc[returns.index < signal_date, tickers].tail(60)
    membership = active.loc[signal_date, tickers].to_numpy(dtype=bool)
    eligible = membership & node_mask
    correlation = history.corr(min_periods=30).fillna(0.0).to_numpy()
    edges = {(i, i) for i, valid in enumerate(eligible) if valid}
    for left in range(len(tickers)):
        if not eligible[left]:
            continue
        candidates = [
            (abs(correlation[left, right]), right)
            for right in range(len(tickers))
            if right != left and eligible[right] and abs(correlation[left, right]) >= 0.30
        ]
        for _, right in sorted(candidates, reverse=True)[:5]:
            edges.add((left, right))
            edges.add((right, left))
    if not edges:
        return torch.empty((2, 0), dtype=torch.long)
    return torch.tensor(sorted(edges), dtype=torch.long).t().contiguous()


def metric_row(year: int, model_name: str, predictions: list[dict]) -> dict:
    frame = pd.DataFrame(predictions)
    frame = frame.dropna(subset=["prediction", "label"])
    if frame.empty:
        return {"test_year": year, "model": model_name, "months": 0}
    by_month = []
    for _, group in frame.groupby("target_period"):
        if len(group) < 5:
            continue
        count = max(1, int(np.ceil(len(group) * 0.20)))
        ranked = group.sort_values("prediction", ascending=False)
        by_month.append(
            {
                "ic": spearmanr(group["prediction"], group["label"]).statistic,
                "top_quintile_return": ranked.head(count)["label"].mean(),
                "bottom_quintile_return": ranked.tail(count)["label"].mean(),
                "top_bottom_spread": ranked.head(count)["label"].mean()
                - ranked.tail(count)["label"].mean(),
            }
        )
    monthly = pd.DataFrame(by_month)
    return {
        "test_year": year,
        "model": model_name,
        "months": len(monthly),
        "mean_spearman_ic": monthly["ic"].mean() if len(monthly) else np.nan,
        "mean_top_quintile_next_month_return": monthly["top_quintile_return"].mean() if len(monthly) else np.nan,
        "mean_bottom_quintile_next_month_return": monthly["bottom_quintile_return"].mean() if len(monthly) else np.nan,
        "mean_top_bottom_spread": monthly["top_bottom_spread"].mean() if len(monthly) else np.nan,
    }


def run() -> tuple[pd.DataFrame, pd.DataFrame]:
    seed_everything(SEED)
    snapshots, data = prepare_snapshots()
    returns, active = data
    tickers = returns.columns.tolist()
    predictions_out = []
    metrics_out = []
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    TABLE_DIR.mkdir(parents=True, exist_ok=True)

    for test_year in range(2019, 2026):
        validation_year = test_year - 1
        fold = snapshots.loc[snapshots["feature_valid"] & snapshots["label_next_month_return"].notna()].copy()
        train = fold.loc[fold["target_period"].dt.year <= test_year - 2]
        validation = fold.loc[fold["target_period"].dt.year == validation_year]
        test = fold.loc[fold["target_period"].dt.year == test_year]
        if train.empty or validation.empty or test.empty:
            print(f"Skipping {test_year}: empty train/validation/test fold")
            continue

        mu = train[FEATURES].mean()
        sigma = train[FEATURES].std().replace(0, 1).fillna(1)
        for subset in (train, validation, test):
            subset.loc[:, FEATURES] = (subset[FEATURES] - mu) / sigma
            subset.loc[:, FEATURES] = subset[FEATURES].replace([np.inf, -np.inf], np.nan).fillna(0).clip(-8, 8)

        train_groups = [g for _, g in train.groupby("target_month")]
        val_groups = [g for _, g in validation.groupby("target_month")]
        test_groups = [g for _, g in test.groupby("target_month")]
        model = StockGAT(len(FEATURES))
        optimizer = torch.optim.Adam(model.parameters(), lr=0.003, weight_decay=1e-4)
        best_state = None
        best_validation_loss = float("inf")
        best_epoch = 1
        patience = 8
        stale = 0

        for epoch in range(1, 61):
            model.train()
            for group in train_groups:
                group = group.sort_values("ticker")
                node_mask = group.set_index("ticker").reindex(tickers)["active_at_signal"].fillna(False).to_numpy(bool)
                x_df = group.set_index("ticker").reindex(tickers)[FEATURES].fillna(0)
                labels = group.set_index("ticker").reindex(tickers)["label_rank"].to_numpy(dtype=np.float32)
                observed = np.isfinite(labels) & node_mask
                if observed.sum() < 5:
                    continue
                edge_index = make_graph(pd.Timestamp(group["signal_date"].iloc[0]), tickers, returns, active, node_mask)
                x = torch.tensor(x_df.to_numpy(dtype=np.float32))
                y = torch.tensor(np.nan_to_num(labels, nan=0.5), dtype=torch.float32)
                mask = torch.tensor(observed)
                optimizer.zero_grad()
                scores = model(x, edge_index)
                loss = nn.functional.mse_loss(scores[mask], y[mask])
                loss.backward()
                optimizer.step()

            model.eval()
            losses = []
            with torch.no_grad():
                for group in val_groups:
                    group = group.sort_values("ticker")
                    node_mask = group.set_index("ticker").reindex(tickers)["active_at_signal"].fillna(False).to_numpy(bool)
                    x_df = group.set_index("ticker").reindex(tickers)[FEATURES].fillna(0)
                    labels = group.set_index("ticker").reindex(tickers)["label_rank"].to_numpy(dtype=np.float32)
                    observed = np.isfinite(labels) & node_mask
                    if observed.sum() < 5:
                        continue
                    edge_index = make_graph(pd.Timestamp(group["signal_date"].iloc[0]), tickers, returns, active, node_mask)
                    scores = model(torch.tensor(x_df.to_numpy(dtype=np.float32)), edge_index)
                    losses.append(nn.functional.mse_loss(scores[torch.tensor(observed)], torch.tensor(np.nan_to_num(labels[observed], nan=0.5))).item())
            val_loss = float(np.mean(losses)) if losses else float("inf")
            if val_loss < best_validation_loss:
                best_validation_loss = val_loss
                best_state = {key: value.detach().clone() for key, value in model.state_dict().items()}
                best_epoch = epoch
                stale = 0
            else:
                stale += 1
                if stale >= patience:
                    break

        if best_state is not None:
            model.load_state_dict(best_state)
        model.eval()
        fold_predictions: dict[str, list[dict]] = {"GAT": [], "Momentum": [], "RandomForest": []}
        rf = RandomForestRegressor(n_estimators=150, min_samples_leaf=5, max_features=0.8, random_state=SEED + test_year, n_jobs=-1)
        rf.fit(train[FEATURES], train["label_rank"])
        with torch.no_grad():
            for group in test_groups:
                group = group.sort_values("ticker")
                indexed = group.set_index("ticker").reindex(tickers)
                node_mask = indexed["active_at_signal"].fillna(False).to_numpy(bool)
                x_df = indexed[FEATURES].fillna(0)
                edge_index = make_graph(pd.Timestamp(group["signal_date"].iloc[0]), tickers, returns, active, node_mask)
                gat_scores = model(torch.tensor(x_df.to_numpy(dtype=np.float32)), edge_index).numpy()
                rf_scores = rf.predict(group[FEATURES])
                rf_by_ticker = dict(zip(group["ticker"], rf_scores))
                gat_by_ticker = dict(zip(tickers, gat_scores))
                momentum_by_ticker = group.set_index("ticker")["mom_60d"].to_dict()
                for row in group.itertuples(index=False):
                    common = {"test_year": test_year, "target_period": row.target_period, "ticker": row.ticker, "label": row.label_next_month_return}
                    for model_name, prediction in (
                        ("GAT", gat_by_ticker.get(row.ticker, np.nan)),
                        ("Momentum", momentum_by_ticker.get(row.ticker, np.nan)),
                        ("RandomForest", rf_by_ticker.get(row.ticker, np.nan)),
                    ):
                        fold_predictions[model_name].append({**common, "prediction": prediction})
        for model_name, rows in fold_predictions.items():
            metrics_out.append({**metric_row(test_year, model_name, rows), "validation_year": validation_year, "selected_epoch": best_epoch if model_name == "GAT" else np.nan})
            predictions_out.extend(rows)
        torch.save(model.state_dict(), OUT_DIR / f"gat_{test_year}.pt")
        print(f"{test_year}: train labels through {test_year - 2}, validation {validation_year}, test {test_year}, GAT epoch {best_epoch}")

    predictions = pd.DataFrame(predictions_out)
    metrics = pd.DataFrame(metrics_out)
    predictions.to_csv(TABLE_DIR / "gat_walkforward_predictions.csv", index=False)
    metrics.to_csv(TABLE_DIR / "gat_walkforward_metrics.csv", index=False)
    metrics.to_csv(OUT_DIR / "annual_metrics.csv", index=False)
    print("\nAnnual model comparison:")
    print(metrics.to_string(index=False))
    return predictions, metrics


if __name__ == "__main__":
    run()