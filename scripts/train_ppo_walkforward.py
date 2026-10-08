"""Train monthly PPO portfolios and compare with equal-weight and MVO."""

from __future__ import annotations

import random
from pathlib import Path

import gymnasium as gym
import numpy as np
import pandas as pd
import torch
from gymnasium import spaces
from scipy.optimize import minimize
from stable_baselines3 import PPO


ROOT = Path(__file__).resolve().parents[1]
INPUT_DIR = ROOT / "data" / "processed" / "model_inputs"
SNAPSHOT_PATH = INPUT_DIR / "monthly_stock_snapshots.csv"
RETURN_PATH = INPUT_DIR / "simple_returns_pit_daily.csv"
ACTIVE_PATH = INPUT_DIR / "active_mask_daily.csv"
MODEL_DIR = ROOT / "results" / "models" / "ppo_walkforward"
TABLE_DIR = ROOT / "results" / "tables"
FEATURES = ["ret_1d", "mom_20d", "mom_60d", "vol_20d", "vol_60d", "volume_z_20d"]
SEED = 42
ONE_WAY_COST = 0.001
MAX_WEIGHT = 0.20
PPO_TIMESTEPS_PER_FOLD = 2048


def capped_weights(scores: np.ndarray, eligible: np.ndarray, cap: float = MAX_WEIGHT) -> np.ndarray:
    weights = np.zeros_like(scores, dtype=float)
    indices = np.flatnonzero(eligible)
    if len(indices) == 0:
        return weights
    if len(indices) * cap < 1 - 1e-10:
        raise ValueError(f"{len(indices)} eligible assets cannot support a fully invested portfolio capped at {cap:.0%}.")
    local = np.maximum(np.asarray(scores, dtype=float)[indices], 1e-8)
    local /= local.sum()
    free = np.ones(len(indices), dtype=bool)
    allocated = np.zeros(len(indices), dtype=float)
    remaining = 1.0
    while free.any():
        proposal = remaining * local[free] / local[free].sum()
        free_indices = np.flatnonzero(free)
        over = proposal > cap
        if not over.any():
            allocated[free_indices] = proposal
            break
        capped_indices = free_indices[over]
        allocated[capped_indices] = cap
        remaining -= cap * len(capped_indices)
        free[capped_indices] = False
    weights[indices] = allocated
    return weights


def action_to_weights(action: np.ndarray, eligible: np.ndarray) -> np.ndarray:
    clipped = np.clip(np.asarray(action, dtype=float), -8, 8)
    clipped -= np.max(clipped[eligible]) if eligible.any() else 0
    scores = np.exp(clipped)
    return capped_weights(scores, eligible)


class MonthlyPortfolioEnv(gym.Env):
    metadata = {"render_modes": []}

    def __init__(self, snapshots: pd.DataFrame, returns: pd.DataFrame, tickers: list[str],
                 feature_mean: pd.Series, feature_std: pd.Series, initial_date: pd.Timestamp):
        super().__init__()
        self.snapshots = snapshots.sort_values(["target_period", "ticker"]).reset_index(drop=True)
        self.returns = returns
        self.tickers = tickers
        self.feature_mean = feature_mean
        self.feature_std = feature_std.replace(0, 1).fillna(1)
        self.months = sorted(self.snapshots.target_period.unique())
        self.action_space = spaces.Box(-1.0, 1.0, shape=(len(tickers),), dtype=np.float32)
        observation_size = len(tickers) * (len(FEATURES) + 2) + 2
        self.observation_size = observation_size
        self.observation_space = spaces.Box(-10.0, 10.0, shape=(observation_size,), dtype=np.float32)
        self.initial_date = initial_date
        self.current_step = 0
        self.previous_weights = np.zeros(len(tickers), dtype=float)
        self.current_group = None
        self._obs_rows: dict[str, pd.Series] = {}

    def _group(self, period: pd.Period) -> pd.DataFrame:
        group = self.snapshots.loc[self.snapshots["target_month"] == str(period)].set_index("ticker")
        return group.reindex(self.tickers)

    def _observe(self) -> np.ndarray:
        period = self.months[self.current_step]
        group = self._group(period)
        active = group["active_at_signal"].fillna(False).to_numpy(bool)
        valid_features = group[FEATURES].notna().all(axis=1).to_numpy()
        eligible = active & valid_features
        features = ((group[FEATURES] - self.feature_mean) / self.feature_std).replace([np.inf, -np.inf], np.nan).fillna(0).clip(-8, 8).to_numpy(dtype=np.float32)
        state = np.column_stack([features, active.astype(float), self.previous_weights]).astype(np.float32)
        signal_date = pd.Timestamp(group["signal_date"].iloc[0])
        recent = self.returns.loc[self.returns.index < signal_date].tail(20)
        market_return = float(recent.mean(axis=1).mean()) if not recent.empty else 0.0
        return np.concatenate([state.ravel(), np.array([market_return, eligible.mean()], dtype=np.float32)]).clip(-10, 10)

    def reset(self, *, seed=None, options=None):
        super().reset(seed=seed)
        self.current_step = 0
        self.previous_weights = np.zeros(len(self.tickers), dtype=float)
        self.current_group = self._group(self.months[self.current_step])
        return self._observe(), {}

    def step(self, action):
        period = self.months[self.current_step]
        group = self._group(period)
        eligible = (
            group["active_at_signal"].fillna(False).to_numpy(bool)
            & group[FEATURES].notna().all(axis=1).to_numpy()
            & group["label_next_month_return"].notna().to_numpy()
        )
        if eligible.sum() < 5:
            weights = np.zeros(len(self.tickers), dtype=float)
            gross = 0.0
            turnover = 0.0
        else:
            weights = action_to_weights(action, eligible)
            returns = group["label_next_month_return"].fillna(0).to_numpy(dtype=float)
            gross = float(weights @ returns)
            turnover = float(np.abs(weights - self.previous_weights).sum())
        net = gross - ONE_WAY_COST * turnover
        self.previous_weights = weights
        self.current_step += 1
        terminated = self.current_step >= len(self.months)
        truncated = False
        observation = np.zeros(self.observation_size, dtype=np.float32) if terminated else self._observe()
        return observation, float(net), terminated, truncated, {"gross_return": gross, "turnover": turnover}


def monthly_covariance_and_return(signal_date: pd.Timestamp, tickers: list[str],
                                  returns: pd.DataFrame, active: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    history = returns.loc[returns.index < signal_date, tickers].tail(756)
    period_index = pd.PeriodIndex(pd.to_datetime(history.index), freq="M")
    monthly = (1 + history).groupby(period_index).prod(min_count=10) - 1
    use = np.flatnonzero(active)
    block = monthly.iloc[:, use]
    means = block.tail(36).mean().fillna(0).to_numpy()
    covariance = block.tail(36).cov(min_periods=12).to_numpy()
    covariance = np.nan_to_num(covariance, nan=0.0, posinf=0.0, neginf=0.0)
    covariance += np.eye(len(use)) * 1e-5
    return means, covariance


def mvo_weights(signal_date: pd.Timestamp, tickers: list[str], returns: pd.DataFrame,
                eligible: np.ndarray) -> np.ndarray:
    weights = np.zeros(len(tickers), dtype=float)
    if eligible.sum() < 5:
        return weights
    mean, covariance = monthly_covariance_and_return(signal_date, tickers, returns, eligible)
    # Long-only minimum-variance solution; stable with sparse/short NGX histories.
    result = minimize(
        lambda candidate: float(candidate @ covariance @ candidate),
        np.full(eligible.sum(), 1 / eligible.sum()),
        method="SLSQP",
        bounds=[(0.0, MAX_WEIGHT)] * eligible.sum(),
        constraints=[{"type": "eq", "fun": lambda candidate: candidate.sum() - 1.0}],
        options={"maxiter": 300, "ftol": 1e-10},
    )
    if result.success:
        weights[np.flatnonzero(eligible)] = result.x
    else:
        weights = capped_weights(np.ones(len(tickers)), eligible)
    return weights


def metrics(returns: pd.Series, turnover: pd.Series) -> dict[str, float | int]:
    values = returns.astype(float)
    wealth = (1 + values).cumprod()
    vol = values.std(ddof=1) * np.sqrt(12)
    return {
        "months": len(values),
        "total_return": wealth.iloc[-1] - 1,
        "cagr": wealth.iloc[-1] ** (12 / len(values)) - 1,
        "annualized_volatility": vol,
        "sharpe_zero_rf": values.mean() * 12 / vol if vol > 0 else np.nan,
        "max_drawdown": (wealth / wealth.cummax() - 1).min(),
        "average_monthly_turnover": turnover.mean(),
    }


def run() -> tuple[pd.DataFrame, pd.DataFrame]:
    random.seed(SEED)
    np.random.seed(SEED)
    torch.manual_seed(SEED)
    torch.set_num_threads(1)
    snapshots = pd.read_csv(SNAPSHOT_PATH, parse_dates=["signal_date"])
    snapshots["target_period"] = pd.PeriodIndex(snapshots["target_month"], freq="M")
    snapshots = snapshots.loc[snapshots.feature_valid].copy()
    returns = pd.read_csv(RETURN_PATH, index_col=0, parse_dates=True).replace([np.inf, -np.inf], np.nan)
    active_daily = pd.read_csv(ACTIVE_PATH, index_col=0, parse_dates=True).astype(bool)
    tickers = returns.columns.tolist()
    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    TABLE_DIR.mkdir(parents=True, exist_ok=True)

    predictions = []
    annual_rows = []
    for test_year in range(2019, 2026):
        # Strict expanding training history; no test-year data enters PPO fitting.
        train = snapshots.loc[
            snapshots.target_period.dt.year.le(test_year - 1)
            & snapshots.label_next_month_return.notna()
        ].copy()
        test = snapshots.loc[
            snapshots.target_period.dt.year.eq(test_year)
            & snapshots.label_next_month_return.notna()
        ].copy()
        if train.empty or test.empty:
            print(f"Skipping {test_year}: empty PPO train/test set")
            continue

        mean = train[FEATURES].mean()
        std = train[FEATURES].std().replace(0, 1).fillna(1)
        train_periods = sorted(train.target_period.unique())
        train_monthly = train.loc[train.target_period.isin(train_periods)]
        env = MonthlyPortfolioEnv(train_monthly, returns, tickers, mean, std, train.signal_date.min())
        model = PPO(
            "MlpPolicy", env, policy_kwargs={"net_arch": {"pi": [32, 32], "vf": [32, 32]}},
            learning_rate=3e-4, n_steps=128, batch_size=64,
            n_epochs=5, gamma=0.99, gae_lambda=0.95, clip_range=0.2,
            ent_coef=0.01, vf_coef=0.5, seed=SEED + test_year,
            device="cpu", verbose=0,
        )
        model.learn(total_timesteps=PPO_TIMESTEPS_PER_FOLD, progress_bar=False)
        model.save(MODEL_DIR / f"ppo_{test_year}")

        previous = {"PPO": np.zeros(len(tickers)), "MVO": np.zeros(len(tickers)), "EqualWeight": np.zeros(len(tickers))}
        fold_rows = []
        for period, group in test.groupby("target_period", sort=True):
            group = group.set_index("ticker").reindex(tickers)
            signal_date = pd.Timestamp(group["signal_date"].iloc[0])
            eligible = (
                group["active_at_signal"].fillna(False).to_numpy(bool)
                & group[FEATURES].notna().all(axis=1).to_numpy()
                & group["label_next_month_return"].notna().to_numpy()
            )
            if eligible.sum() < 5:
                continue
            x_df = ((group[FEATURES] - mean) / std).replace([np.inf, -np.inf], np.nan).fillna(0).clip(-8, 8)
            state = np.column_stack([
                x_df.to_numpy(dtype=np.float32),
                group["active_at_signal"].fillna(False).to_numpy(float),
                previous["PPO"],
            ]).astype(np.float32)
            recent = returns.loc[returns.index < signal_date].tail(20)
            market_return = float(recent.mean(axis=1).mean()) if not recent.empty else 0.0
            obs = np.concatenate([state.ravel(), np.array([market_return, eligible.mean()], dtype=np.float32)]).clip(-10, 10)
            action, _ = model.predict(obs, deterministic=True)
            weights = {
                "PPO": action_to_weights(action, eligible),
                "MVO": mvo_weights(signal_date, tickers, returns, eligible),
                "EqualWeight": capped_weights(np.ones(len(tickers)), eligible),
            }
            target_returns = group["label_next_month_return"].fillna(0).to_numpy(float)
            for strategy, portfolio_weights in weights.items():
                turnover = float(np.abs(portfolio_weights - previous[strategy]).sum())
                gross = float(portfolio_weights @ target_returns)
                net = gross - ONE_WAY_COST * turnover
                row = {
                    "test_year": test_year,
                    "target_month": str(period),
                    "strategy": strategy,
                    "gross_return": gross,
                    "turnover": turnover,
                    "cost_bps": ONE_WAY_COST * 10_000,
                    "net_return": net,
                    "eligible_assets": int(eligible.sum()),
                    "holdings": ";".join(ticker for ticker, weight in zip(tickers, portfolio_weights) if weight > 1e-6),
                }
                fold_rows.append(row)
                predictions.append(row)
                previous[strategy] = portfolio_weights

        fold_frame = pd.DataFrame(fold_rows)
        for strategy, group in fold_frame.groupby("strategy"):
            result = metrics(group["net_return"], group["turnover"])
            annual_rows.append({"test_year": test_year, "strategy": strategy, **result})
        print(f"{test_year}: PPO trained on {len(train_periods)} monthly observations, evaluated on {fold_frame.target_month.nunique() if not fold_frame.empty else 0} months")

    detail = pd.DataFrame(predictions)
    annual = pd.DataFrame(annual_rows)
    cost_rows = []
    for strategy, frame in detail.groupby("strategy"):
        for cost_bps in (5, 10, 25, 50):
            net_returns = frame["gross_return"] - frame["turnover"] * (cost_bps / 10_000)
            result = metrics(net_returns.reset_index(drop=True), frame["turnover"].reset_index(drop=True))
            cost_rows.append({"strategy": strategy, "one_way_cost_bps": cost_bps, **result})
    cost_sensitivity = pd.DataFrame(cost_rows)
    detail.to_csv(TABLE_DIR / "ppo_walkforward_monthly_returns.csv", index=False)
    annual.to_csv(TABLE_DIR / "ppo_walkforward_annual_metrics.csv", index=False)
    cost_sensitivity.to_csv(TABLE_DIR / "ppo_walkforward_cost_sensitivity.csv", index=False)
    print("\nAnnual allocation metrics (net of 10 bps one-way turnover costs):")
    print(annual.to_string(index=False))
    print("\nPooled cost sensitivity across all test months:")
    print(cost_sensitivity.to_string(index=False))
    return detail, annual


if __name__ == "__main__":
    run()