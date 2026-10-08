# Chapter 3–4 Model Evaluation: Prototype Protocol and Evidence

## Status

This document records the first reproducible GAT/PPO prototype runs. It is not dissertation-final evidence: the price inputs are not total-return adjusted, only one seed is used, PPO has a short fixed training budget, and not all 12 months per test year contribute to reported cross-sectional ranking metrics.

## Walk-Forward Protocol

- Universe: point-in-time NGX-30 membership from `scripts/ngx_data_downloader.py`, restricted to the 39 symbols for which processed return data are available. The membership file lists 42 symbols; DIAMONB, MOBIL, and UBN do not have processed returns.
- Test windows: seven annual windows, 2019 through 2025.
- For test year $y$: supervised training labels end in year $y-2$; year $y-1$ is validation for GAT early stopping; year $y$ is held out for testing. PPO is fit on data ending in year $y-1$ and evaluated only on year $y$.
- GAT target: next-calendar-month cross-sectional return percentile rank, ranked only among point-in-time active stocks with observed labels.
- GAT predictors: lagged daily return, 20- and 60-session price momentum, 20- and 60-session return volatility, and standardized log-volume. Features are shifted to exclude information from the signal date onward; normalization parameters are fit using each fold's training sample.
- Graph: trailing 60-session return correlations, using observations strictly before the signal date; edges connect active stocks with absolute correlation at least 0.30 and up to five strongest neighbors per node, plus self-loops.
- GAT architecture: two GAT layers (16 hidden units, 2 first-layer attention heads, dropout 0.15), optimized with Adam (learning rate 0.003, weight decay 1e-4) and MSE on return-rank targets. Validation loss selects the epoch, with a maximum 60 epochs and patience 8.
- GAT baselines: 60-session momentum ranking and a 150-tree Random Forest regression with minimum leaf size 5.
- Ranking metrics: monthly Spearman information coefficient and equal-weight top/bottom quintile next-month return spread. The annual CSV reports the number of months that met the minimum five-stock cross-section.
- PPO action: continuous asset scores mapped to long-only weights that sum to one, with a 20% per-asset cap. State includes lagged stock features, active flags, previous weights, a market-return summary, and eligible-universe fraction.
- PPO reward: next-month portfolio simple return less 10 bps per unit of one-way turnover (one-way turnover is half the sum of absolute weight changes). PPO uses MlpPolicy, CPU, 5,000 timesteps per annual fold, and seed `42 + test_year`.
- Allocation baselines: equal weight and long-only minimum-variance MVO with a 20% cap, using only trailing daily return observations available at the signal date. Net performance is reported after the same 10 bps one-way turnover cost; cost sensitivity is evaluated at 5, 10, 25, and 50 bps.

## Current RQ2 Results

PPO, MVO, and equal-weight policies completed the annual held-out folds. There are 68 usable monthly observations total (11, 9, 12, 11, 6, 10, and 9 by year). Pooled over the stitched test months at the assumed 10 bps one-way turnover cost, prototype PPO CAGR is 25.61%, long-only minimum-variance MVO is 26.39%, and equal weight is 25.43%. At the 50 bps sensitivity, PPO CAGR is 24.73%, MVO 24.05%, and equal weight 24.67%. MVO has substantially higher mean monthly turnover (39.8%) than PPO (15.2%) or equal weight (13.4%).

These pooled results concatenate separate annual policies and are not a single uninterrupted buy-and-hold wealth path. Short annual test lengths (6–12 months), one random seed per fold, and only 2,048 PPO timesteps per fold mean there is insufficient evidence to claim PPO superiority. The cost sensitivity is assumption-based.

See `results/tables/ppo_walkforward_annual_metrics.csv`, `results/tables/ppo_walkforward_monthly_returns.csv`, and `results/tables/ppo_walkforward_cost_sensitivity.csv` for the full results.

Across annual folds, mean monthly Spearman IC was approximately 0.054 for GAT, -0.023 for momentum, and 0.061 for Random Forest. Mean monthly top-minus-bottom quintile spreads were approximately 2.22%, 0.93%, and 0.82%, respectively. These are simple averages of the annual metric rows, not pooled inferential estimates. The GAT is not uniformly best: Random Forest has the higher average IC, and annual GAT spreads vary in sign/size. No statistical significance claim is made.

## Current RQ2 Results

See `results/tables/ppo_walkforward_annual_metrics.csv`, `results/tables/ppo_walkforward_monthly_returns.csv`, and `results/tables/ppo_walkforward_cost_sensitivity.csv`. PPO, MVO, and equal-weight policies have been evaluated on annual held-out folds. Interpret short folds (6–12 months) cautiously; no statistical superiority claim is warranted yet.

## Data and Method Limitations

1. Processed prices are closing-price panels, not verified dividend-adjusted total returns. Corporate actions and delisting proceeds are not fully reconciled; large gains/drawdowns require raw-event review.
2. NGX sessions are represented by business-day indices. Exchange holidays are present as missing rows; evaluation counts are based on observations that survive the model cross-section filters.
3. The current GAT graph is a trailing correlation graph, not a sector/fundamental graph. Graph thresholds and features are initial protocol choices and should be locked before additional validation.
4. There is one model seed per GAT fold and one PPO seed per fold. Repeat-seed uncertainty and paired confidence intervals have not been computed.
5. PPO's 5,000 timesteps per fold is a prototype budget. Training convergence and policy sensitivity to seed/reward/cost need assessment.
6. The PPO reward and MVO use unadjusted price-based simple returns, subject to the corporate-action limitation above. Cost scenarios are assumptions, not confirmed NGX fees.
7. Current ticker-specific news is sparse; YouTube comments are entirely after the current price panel and cannot enter this historical comparison.

## Reproduction

```powershell
.\.venv\Scripts\python.exe scripts\prepare_model_data.py
.\.venv\Scripts\python.exe scripts\train_gat_walkforward.py
.\.venv\Scripts\python.exe scripts\train_ppo_walkforward.py
```
