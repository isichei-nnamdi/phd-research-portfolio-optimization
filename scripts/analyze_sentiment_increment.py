"""Exploratory test of ticker-specific news sentiment in NGX portfolios."""

from __future__ import annotations

import math
import argparse
from pathlib import Path

import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
import statsmodels.api as sm
from statsmodels.stats.sandwich_covariance import cov_hac
from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer


ROOT = Path(__file__).resolve().parents[1]
RETURNS_PATH = ROOT / "data" / "processed" / "ngx_returns_wide.csv"
NEWS_PATH = (
    ROOT
    / "scripts"
    / "ngx_research_data"
    / "raw"
    / "sentiment"
    / "google_news_headlines.csv"
)
TABLE_DIR = ROOT / "results" / "tables"
FIGURE_DIR = ROOT / "results" / "figures"
TOP_FRACTION = 0.20
MOMENTUM_LOOKBACK = 60
MIN_MOMENTUM_OBSERVATIONS = 40
SENTIMENT_LOOKBACK_DAYS = 30


def load_ticker_sentiment(tickers: list[str]) -> tuple[pd.DataFrame, pd.DataFrame]:
    news = pd.read_csv(NEWS_PATH)
    required = {"title", "query"}
    missing = required.difference(news.columns)
    if missing:
        raise ValueError(f"News file is missing required columns: {sorted(missing)}")

    date_column = "date_parsed" if "date_parsed" in news.columns else "date"
    news["date"] = pd.to_datetime(news[date_column], errors="coerce", utc=True)
    news["date"] = news["date"].dt.tz_convert(None).dt.normalize()
    news = news.dropna(subset=["date", "title", "query"])

    analyzer = SentimentIntensityAnalyzer()
    news["sentiment"] = news["title"].astype(str).map(
        lambda title: analyzer.polarity_scores(title)["compound"]
    )

    articles = []
    for ticker in tickers:
        query = f"{ticker} NGX Nigeria stock"
        ticker_news = news.loc[
            news["query"].astype(str).str.startswith(query),
            ["date", "sentiment"],
        ].copy()
        ticker_news["ticker"] = ticker
        articles.append(ticker_news)

    ticker_articles = pd.concat(articles, ignore_index=True)
    daily = ticker_articles.groupby(["date", "ticker"])["sentiment"].mean()
    return ticker_articles, daily


def calculate_turnover(previous: dict[str, float], current: dict[str, float]) -> float:
    names = set(previous) | set(current)
    return 0.5 * sum(abs(current.get(name, 0.0) - previous.get(name, 0.0)) for name in names)


def portfolio_metrics(returns: pd.Series, turnover: pd.Series) -> dict[str, float | int | str]:
    values = returns.dropna()
    wealth = (1 + values).cumprod()
    drawdown = wealth / wealth.cummax() - 1
    volatility = values.std(ddof=1) * np.sqrt(12) if len(values) > 1 else np.nan
    mean_monthly = values.mean() if len(values) else np.nan
    return {
        "months": len(values),
        "start_month": str(values.index.min()) if len(values) else "",
        "end_month": str(values.index.max()) if len(values) else "",
        "total_return": wealth.iloc[-1] - 1 if len(values) else np.nan,
        "cagr": wealth.iloc[-1] ** (12 / len(values)) - 1 if len(values) else np.nan,
        "annualized_mean_return": mean_monthly * 12 if len(values) else np.nan,
        "annualized_volatility": volatility,
        "sharpe_zero_rf": mean_monthly * 12 / volatility
        if pd.notna(volatility) and volatility > 0
        else np.nan,
        "max_drawdown": drawdown.min() if len(values) else np.nan,
        "average_monthly_turnover": turnover.mean() if len(turnover.dropna()) else np.nan,
    }


def run_analysis(
    start_date: str | None = None,
    end_date: str | None = None,
    output_suffix: str = "",
) -> tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame]:
    if not RETURNS_PATH.exists() or not NEWS_PATH.exists():
        raise FileNotFoundError("Required NGX returns or Google News data file is missing.")

    daily_returns = pd.read_csv(RETURNS_PATH, index_col=0, parse_dates=True)
    daily_returns = daily_returns.apply(pd.to_numeric, errors="coerce").sort_index()
    daily_returns = daily_returns.replace([np.inf, -np.inf], np.nan)
    tickers = daily_returns.columns.astype(str).tolist()
    ticker_articles, daily_sentiment = load_ticker_sentiment(tickers)
    ticker_articles = ticker_articles.loc[
        ticker_articles["date"].between(
            daily_returns.index.min() - pd.Timedelta(days=SENTIMENT_LOOKBACK_DAYS),
            daily_returns.index.max(),
        )
    ].copy()
    daily_sentiment = ticker_articles.groupby(["date", "ticker"])["sentiment"].mean()

    monthly_returns = (1 + daily_returns).groupby(
        daily_returns.index.to_period("M")
    ).prod(min_count=1) - 1
    monthly_returns.index.name = "month"
    if start_date:
        monthly_returns = monthly_returns.loc[monthly_returns.index >= pd.Period(start_date, freq="M")]
    if end_date:
        monthly_returns = monthly_returns.loc[monthly_returns.index <= pd.Period(end_date, freq="M")]

    records = []
    previous_weights: dict[str, dict[str, float] | None] = {
        "equal_weight": None,
        "price_only_momentum": None,
        "momentum_plus_sentiment": None,
    }

    for target_month in monthly_returns.index:
        current_returns = monthly_returns.loc[target_month].dropna()
        if current_returns.empty:
            continue

        target_start = target_month.start_time
        signal_end = target_start - pd.Timedelta(days=1)
        history = daily_returns.loc[:signal_end, tickers].tail(MOMENTUM_LOOKBACK)
        momentum = history.apply(
            lambda column: (1 + column.dropna()).prod() - 1
            if column.notna().sum() >= MIN_MOMENTUM_OBSERVATIONS
            else np.nan
        )
        eligible = current_returns.index.intersection(momentum.dropna().index)
        if not len(eligible):
            continue

        momentum_rank = momentum.loc[eligible].rank(pct=True)
        sentiment_start = target_start - pd.Timedelta(days=SENTIMENT_LOOKBACK_DAYS)
        recent_articles = ticker_articles.loc[
            ticker_articles["date"].between(sentiment_start, signal_end)
        ]
        recent_sentiment = recent_articles.groupby("ticker")["sentiment"].mean()
        observed_sentiment = recent_sentiment.reindex(eligible)
        sentiment_rank = observed_sentiment.rank(pct=True).fillna(0.5)
        blended_rank = 0.5 * momentum_rank + 0.5 * sentiment_rank

        count = max(1, math.ceil(len(eligible) * TOP_FRACTION))
        selections = {
            "equal_weight": eligible.tolist(),
            "price_only_momentum": momentum_rank.nlargest(count).index.tolist(),
            "momentum_plus_sentiment": blended_rank.nlargest(count).index.tolist(),
        }

        for strategy, holdings in selections.items():
            weights = {ticker: 1 / len(holdings) for ticker in holdings}
            turnover = (
                1.0
                if previous_weights[strategy] is None
                else calculate_turnover(previous_weights[strategy], weights)
            )
            strategy_return = float(current_returns.loc[holdings].mean())
            records.append(
                {
                    "month": target_month,
                    "strategy": strategy,
                    "portfolio_return": strategy_return,
                    "turnover": turnover,
                    "holdings": ";".join(holdings),
                    "eligible_stocks": len(eligible),
                    "stocks_with_recent_sentiment": int(observed_sentiment.notna().sum()),
                    "selected_stocks_with_recent_sentiment": int(
                        observed_sentiment.reindex(holdings).notna().sum()
                    ),
                }
            )
            previous_weights[strategy] = weights

    monthly = pd.DataFrame(records)
    if monthly.empty:
        raise ValueError("No portfolio months could be formed from the available data.")

    wide_returns = monthly.pivot(
        index="month", columns="strategy", values="portfolio_return"
    ).sort_index()
    wide_turnover = monthly.pivot(
        index="month", columns="strategy", values="turnover"
    ).reindex(wide_returns.index)
    evaluation_start = wide_returns.index.min().start_time
    evaluation_end = wide_returns.index.max().end_time
    evaluation_articles = ticker_articles.loc[
        ticker_articles["date"].between(
            evaluation_start - pd.Timedelta(days=SENTIMENT_LOOKBACK_DAYS),
            evaluation_end,
        )
    ]

    metric_rows = []
    for strategy in wide_returns.columns:
        row = {"strategy": strategy}
        row.update(portfolio_metrics(wide_returns[strategy], wide_turnover[strategy]))
        metric_rows.append(row)

    paired = wide_returns[["price_only_momentum", "momentum_plus_sentiment"]].dropna()
    difference = paired["momentum_plus_sentiment"] - paired["price_only_momentum"]
    mean_monthly_difference = difference.mean()
    if len(difference) >= 12:
        intercept_model = sm.OLS(difference.to_numpy(), np.ones((len(difference), 1))).fit()
        standard_error = float(np.sqrt(cov_hac(intercept_model, nlags=min(3, len(difference) - 1))[0, 0]))
    else:
        standard_error = np.nan
    metric_rows.append(
        {
            "strategy": "sentiment_increment_vs_price_only",
            "months": len(difference),
            "start_month": str(difference.index.min()) if len(difference) else "",
            "end_month": str(difference.index.max()) if len(difference) else "",
            "mean_monthly_excess_return": mean_monthly_difference,
            "annualized_mean_excess_return": mean_monthly_difference * 12,
            "hac_95ci_lower_annualized": (mean_monthly_difference - 1.96 * standard_error) * 12,
            "hac_95ci_upper_annualized": (mean_monthly_difference + 1.96 * standard_error) * 12,
            "hac_t_stat": mean_monthly_difference / standard_error
            if pd.notna(standard_error) and standard_error > 0
            else np.nan,
        }
    )
    metrics = pd.DataFrame(metric_rows)

    cost_rows = []
    for strategy in ("price_only_momentum", "momentum_plus_sentiment"):
        gross = wide_returns[strategy]
        traded = wide_turnover[strategy].fillna(0)
        for cost_bps in (5, 10, 25, 50):
            net = gross - traded * (cost_bps / 10_000)
            cost_metrics = portfolio_metrics(net, wide_turnover[strategy])
            cost_rows.append(
                {
                    "strategy": strategy,
                    "assumed_one_way_cost_bps": cost_bps,
                    **cost_metrics,
                }
            )
    cost_sensitivity = pd.DataFrame(cost_rows)

    coverage = (
        ticker_articles.groupby("ticker")
        .agg(
            headline_count=("sentiment", "size"),
            first_headline=("date", "min"),
            last_headline=("date", "max"),
        )
        .reindex(tickers)
        .rename_axis("ticker")
        .reset_index()
    )

    TABLE_DIR.mkdir(parents=True, exist_ok=True)
    FIGURE_DIR.mkdir(parents=True, exist_ok=True)
    suffix = f"_{output_suffix}" if output_suffix else ""
    monthly.to_csv(TABLE_DIR / f"sentiment_increment_monthly_returns{suffix}.csv", index=False)
    metrics.to_csv(TABLE_DIR / f"sentiment_increment_metrics{suffix}.csv", index=False)
    coverage.to_csv(TABLE_DIR / f"sentiment_increment_coverage{suffix}.csv", index=False)
    cost_sensitivity.to_csv(TABLE_DIR / f"sentiment_increment_cost_sensitivity{suffix}.csv", index=False)

    wealth = (1 + wide_returns).cumprod()
    ax = wealth.plot(figsize=(11, 6), linewidth=1.5)
    ax.set_title("NGX Portfolio Ablation: News Sentiment Increment")
    ax.set_xlabel("Month")
    ax.set_ylabel("Growth of 1 NGN")
    ax.grid(True, alpha=0.3)
    ax.figure.tight_layout()
    ax.figure.savefig(FIGURE_DIR / f"sentiment_increment_wealth{suffix}.png", dpi=200)
    plt.close(ax.figure)

    print(f"Return panel: {len(tickers)} stocks, {daily_returns.index.min().date()} to {daily_returns.index.max().date()}")
    print(f"Ticker-specific headlines in sample and signal lookback: {len(evaluation_articles)}")
    print(f"Portfolio comparison months: {len(wide_returns)}")
    print("\nPortfolio metrics:")
    print(metrics.to_string(index=False))
    print("\nAverage selected-stock sentiment coverage:")
    print(
        monthly.groupby("strategy")["selected_stocks_with_recent_sentiment"]
        .mean()
        .round(2)
        .to_string()
    )
    print("\nHypothetical net CAGR at one-way transaction costs:")
    print(
        cost_sensitivity.pivot(
            index="assumed_one_way_cost_bps", columns="strategy", values="cagr"
        ).round(4).to_string()
    )
    return monthly, metrics, coverage


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--start-date", help="First portfolio month, e.g. 2021-01-01")
    parser.add_argument("--end-date", help="Last portfolio month, e.g. 2025-12-31")
    parser.add_argument("--output-suffix", default="", help="Suffix for saved result files")
    arguments = parser.parse_args()
    run_analysis(arguments.start_date, arguments.end_date, arguments.output_suffix)