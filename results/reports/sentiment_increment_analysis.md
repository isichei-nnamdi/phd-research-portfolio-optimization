# Sentiment Increment Analysis

## Scope

This is an exploratory, pre-GAT test of whether alternative sentiment adds value to a price-only NGX portfolio strategy. It includes a historical news-only portfolio ablation and a descriptive analysis of a newly collected YouTube comment sample. The YouTube comments do not overlap the NGX returns period, so they cannot yet be included in a portfolio-performance test.

The test uses the 39 stocks in `data/processed/ngx_returns_wide.csv` and ticker-tagged Google News headlines. Nigerian publisher RSS and GDELT observations are market-wide rather than reliably ticker-tagged, so they are not used to rank individual stocks. The original exploratory sample runs from 2012-03 through 2025-12 (166 monthly observations), after a 60-trading-day momentum warm-up. The 786 ticker-specific headlines fall within the returns sample and permitted lookback window.

The audited raw inputs contain 1,954 dated 2012–2025 headline records: 1,825 Google News and 129 GDELT records. Normalized title-and-date deduplication yields 1,947 article-days retained for the panel. VADER was applied to headline titles, including GDELT titles, because all 129 stored GDELT `tone` values are zero. To avoid same-day look-ahead where exact publication times are unavailable, each headline is assigned to the next NGX trading session; days without headlines remain missing and are not forward-filled. On that basis, 986 of 3,653 NGX trading dates have headlines (27.0%). For 2021–2025, 779 of 1,304 trading dates are covered (59.7%). Raw article counts are 65 for 2012–2017, 196 for 2018–2020, and 1,693 for 2021–2025. The 164 Nigerian-site records are dated October 2026, outside the price sample.

The YouTube sample contains 77 public comments from 20 videos across 16 channels, dated 2026-09-22 through 2026-10-06. All comments are later than the NGX return panel, which ends 2025-12-31; the return-date overlap is zero.

## Method

At each month start, eligible stocks are ranked using only information dated before that month. The price-only strategy selects the top quintile by compounded return over the preceding 60 trading days. The sentiment-augmented strategy selects the top quintile by an equal blend of cross-sectional percentile ranks for that momentum score and the mean VADER compound score from ticker-tagged headlines in the preceding 30 calendar days. Stocks without recent headlines receive a neutral sentiment rank. Holdings are equally weighted for the month. An equal-weight portfolio is included as context.

The comparison is gross of transaction costs. A paired monthly return difference is reported with a Newey-West/HAC confidence interval using three lags. The cost sensitivity uses illustrative one-way cost assumptions of 5, 10, 25, and 50 basis points; these are scenarios, not verified NGX transaction-cost estimates.

A separate 2021-01 through 2025-12 run uses 60 monthly observations and 755 ticker-specific headlines within the evaluation period plus its initial sentiment lookback. It uses the same 60-trading-day momentum warm-up and prior-month sentiment rule. This is an exploratory pre-GAT portfolio test, not a full evaluation of the planned walk-forward model windows.

## Results

| Strategy | CAGR | Annualized volatility | Sharpe (zero risk-free rate) | Maximum drawdown |
|---|---:|---:|---:|---:|
| Equal-weight | 11.34% | 25.04% | 0.552 | -74.01% |
| Price-only momentum | 10.11% | 32.64% | 0.448 | -81.95% |
| Momentum plus sentiment | 9.46% | 32.30% | 0.432 | -81.33% |

The sentiment-augmented portfolio's mean monthly return difference versus price-only momentum is -0.0566 percentage points, or -0.679 percentage points annualized. The HAC 95% interval for the annualized difference is -3.886% to +2.528% (t = -0.415). This sample therefore provides no statistically reliable evidence that this sentiment blend improves portfolio returns. Its point estimate is negative, while the interval remains compatible with either a modest loss or gain.

For 2021–2025, equal-weight, price-only momentum, and momentum-plus-sentiment CAGRs are 37.22%, 54.02%, and 49.01%. The paired annualized mean return difference for sentiment versus price-only momentum is -3.45 percentage points; its HAC 95% interval is -11.69% to +4.79% (t = -0.820). This subperiod does not establish a reliable incremental benefit. The sentiment strategy averages 2.35 selected stocks per month with recent ticker-specific sentiment, out of roughly eight holdings.

The sentiment strategy averages 0.94 held stocks with recent sentiment per month, versus roughly eight holdings in its top-quintile portfolio. This sparse coverage limits the strength of the finding. Turnover is also higher for both concentrated momentum strategies than for equal-weight: about 50.6% monthly for the sentiment strategy and 48.1% for price-only momentum.

| Assumed one-way cost | Price-only momentum CAGR | Momentum plus sentiment CAGR |
|---:|---:|---:|
| 5 bps | 9.80% | 9.13% |
| 10 bps | 9.48% | 8.80% |
| 25 bps | 8.54% | 7.82% |
| 50 bps | 6.98% | 6.20% |

## Interpretation and Limitations

On this first, sparse news-only ablation, the chosen sentiment blend does not add measurable portfolio value beyond the price-only momentum ranking. This is not evidence that sentiment has no value in general: the strategy, blend weight, news coverage, and VADER scores are preliminary, and results should be confirmed out of sample with pre-specified alternatives.

The collected YouTube comment sample has a mean VADER compound score of 0.371 and median 0.367. Using compound thresholds of +0.05 and -0.05, 53 comments (68.8%) are positive, 14 (18.2%) neutral, and 10 (13.0%) negative. NairametricsTV contributes 36 of 77 comments, so source concentration is substantial. These are descriptive sample statistics, not evidence of a market-wide sentiment level; comments may also be self-selected and VADER is a general-purpose lexicon rather than a finance-specific model.

The YouTube comments were posted after the NGX return sample, and there are no corresponding return observations in the current panel. Therefore, the YouTube signal cannot be tested for incremental portfolio performance using the present dataset. Do not extend the backtest with post-period comments or interpret their positive skew as portfolio alpha. A valid social-signal ablation requires future NGX prices covering these comment dates, or a timestamped social archive that overlaps a pre-specified return test period. The current social source is YouTube comments only; this does not represent all Nigerian social media.

The proposed GDELT TimelineTone historical backfill was tested. The supplied `/api/v2/timeline/timeline` URL returns 404. TimelineTone is a mode on `/api/v2/doc/doc`, but the GDELT DOC API documents exact start/end searches as limited to the most recent three months; a 2015–2025 request is rejected as an invalid start date. It cannot provide the proposed historical backfill. Accessing historical GDELT archives would require a separate ingestion workflow.

The raw Google News feeds are capped search results rather than a complete historical archive. Publisher RSS and GDELT data are not reliably linked to individual stocks. Future work should collect timestamped, ticker-attributed sources, document survivorship and point-in-time universe membership, and evaluate a frozen design on a held-out period with empirically supported NGX costs.

## Reproducibility

Run from the repository root with the project environment:

```powershell
 .\.venv\Scripts\python.exe scripts\analyze_sentiment_increment.py
.\.venv\Scripts\python.exe scripts\analyze_youtube_sentiment.py
.\.venv\Scripts\python.exe scripts\analyze_historical_sentiment_coverage.py
.\.venv\Scripts\python.exe scripts\analyze_sentiment_increment.py --start-date 2021-01-01 --end-date 2025-12-31 --output-suffix 2021_2025
```

Outputs:

- `results/tables/sentiment_increment_metrics.csv`
- `results/tables/sentiment_increment_monthly_returns.csv`
- `results/tables/sentiment_increment_coverage.csv`
- `results/tables/sentiment_increment_cost_sensitivity.csv`
- `results/figures/sentiment_increment_wealth.png`
- `results/tables/sentiment_increment_metrics_2021_2025.csv`
- `results/tables/sentiment_increment_monthly_returns_2021_2025.csv`
- `results/tables/sentiment_increment_coverage_2021_2025.csv`
- `results/tables/sentiment_increment_cost_sensitivity_2021_2025.csv`
- `results/figures/sentiment_increment_wealth_2021_2025.png`
- `results/tables/historical_headlines_vader_scored.csv`
- `results/tables/historical_sentiment_daily_vader.csv`
- `results/tables/historical_sentiment_coverage_by_year.csv`
- `results/tables/historical_sentiment_coverage_by_source.csv`
- `results/tables/youtube_comments_scored.csv`
- `results/tables/youtube_sentiment_daily.csv`
- `results/tables/youtube_sentiment_summary.csv`
- `results/tables/youtube_sentiment_by_channel.csv`