"""Rebuild historical NGX headline sentiment and audit its data coverage."""

from __future__ import annotations

from pathlib import Path

import pandas as pd
from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer


ROOT = Path(__file__).resolve().parents[1]
RAW_DIR = ROOT / "scripts" / "ngx_research_data" / "raw" / "sentiment"
RETURNS_PATH = ROOT / "data" / "processed" / "ngx_returns_wide.csv"
TABLE_DIR = ROOT / "results" / "tables"
START_DATE = "2012-01-01"
END_DATE = "2025-12-31"


def load_headline_sources() -> tuple[pd.DataFrame, pd.DataFrame]:
    sources = [
        ("google_news", RAW_DIR / "google_news_headlines.csv", "date_parsed"),
        ("gdelt", RAW_DIR / "gdelt_ngx_sentiment.csv", "date"),
        ("nigerian_sites", RAW_DIR / "nigerian_news_scraped.csv", "date"),
    ]
    frames = []
    for source_name, path, date_column in sources:
        if not path.exists():
            continue
        frame = pd.read_csv(path)
        if "title" not in frame or date_column not in frame:
            raise ValueError(f"{path.name} requires title and {date_column} columns")
        frame["source"] = source_name
        frame["date"] = pd.to_datetime(
            frame[date_column], errors="coerce", utc=True
        ).dt.tz_convert(None).dt.normalize()
        frame = frame.dropna(subset=["date", "title"])
        frame["title"] = frame["title"].astype(str).str.strip()
        frame = frame.loc[frame["title"].ne("")].copy()
        frames.append(frame)

    if not frames:
        raise FileNotFoundError(f"No dated headline sources found in {RAW_DIR}")

    raw = pd.concat(frames, ignore_index=True, sort=False)
    raw = raw.loc[raw["date"].between(START_DATE, END_DATE)].copy()
    raw["title_key"] = (
        raw["title"].str.lower().str.replace(r"[^a-z0-9]+", " ", regex=True).str.strip()
    )
    raw = raw.loc[raw["title_key"].ne("")].copy()

    unique = (
        raw.sort_values(["date", "source"])
        .drop_duplicates(subset=["date", "title_key"])
        .copy()
    )
    unique["sources"] = raw.groupby(["date", "title_key"])["source"].transform(
        lambda values: ";".join(sorted(set(values)))
    )
    unique = unique.drop(columns="sources").merge(
        raw.groupby(["date", "title_key"])["source"]
        .agg(lambda values: ";".join(sorted(set(values))))
        .rename("sources"),
        on=["date", "title_key"],
        how="left",
    )
    return raw, unique


def analyze_historical_sentiment() -> tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame]:
    if not RETURNS_PATH.exists():
        raise FileNotFoundError(f"NGX returns panel not found: {RETURNS_PATH}")

    raw, articles = load_headline_sources()
    analyzer = SentimentIntensityAnalyzer()
    score_rows = articles["title"].map(analyzer.polarity_scores)
    articles["vader_compound"] = score_rows.map(lambda score: score["compound"])
    articles["vader_positive"] = score_rows.map(lambda score: score["pos"])
    articles["vader_negative"] = score_rows.map(lambda score: score["neg"])
    articles["vader_neutral"] = score_rows.map(lambda score: score["neu"])
    articles["sentiment_class"] = articles["vader_compound"].map(
        lambda score: "positive" if score >= 0.05 else "negative" if score <= -0.05 else "neutral"
    )

    returns = pd.read_csv(RETURNS_PATH, index_col=0, parse_dates=True)
    trading_dates = pd.DatetimeIndex(returns.index).normalize().unique().sort_values()
    trading_dates = trading_dates[(trading_dates >= START_DATE) & (trading_dates <= END_DATE)]
    next_session_positions = trading_dates.searchsorted(articles["date"], side="right")
    has_next_session = next_session_positions < len(trading_dates)
    articles = articles.loc[has_next_session].copy()
    articles["signal_date"] = trading_dates.take(next_session_positions[has_next_session])

    daily = (
        articles.groupby("signal_date")
        .agg(
            sentiment_mean=("vader_compound", "mean"),
            sentiment_median=("vader_compound", "median"),
            sentiment_std=("vader_compound", "std"),
            positive_ratio=("sentiment_class", lambda values: values.eq("positive").mean()),
            neutral_ratio=("sentiment_class", lambda values: values.eq("neutral").mean()),
            negative_ratio=("sentiment_class", lambda values: values.eq("negative").mean()),
            article_count=("title_key", "size"),
            source_count=("sources", "nunique"),
        )
        .reindex(trading_dates)
    )
    daily.index.name = "Date"
    daily["article_count"] = daily["article_count"].fillna(0).astype(int)
    daily["source_count"] = daily["source_count"].fillna(0).astype(int)

    annual_rows = []
    for year in range(2012, 2026):
        year_articles = articles.loc[articles["date"].dt.year.eq(year)]
        year_dates = trading_dates[trading_dates.year == year]
        active_dates = daily.loc[year_dates, "article_count"].gt(0)
        annual_rows.append(
            {
                "year": year,
                "raw_article_records": int(raw["date"].dt.year.eq(year).sum()),
                "unique_articles": len(year_articles),
                "trading_days": len(year_dates),
                "trading_days_with_headlines": int(active_dates.sum()),
                "trading_day_coverage_pct": 100 * active_dates.mean() if len(active_dates) else 0,
                "mean_daily_vader_on_active_days": daily.loc[year_dates, "sentiment_mean"].mean(),
            }
        )
    annual = pd.DataFrame(annual_rows)

    source_rows = []
    for source, source_articles in articles.groupby("sources"):
        source_rows.append(
            {
                "source_or_source_combination": source,
                "unique_articles": len(source_articles),
                "first_date": source_articles["date"].min(),
                "last_date": source_articles["date"].max(),
            }
        )
    source_summary = pd.DataFrame(source_rows).sort_values("unique_articles", ascending=False)

    TABLE_DIR.mkdir(parents=True, exist_ok=True)
    articles.to_csv(TABLE_DIR / "historical_headlines_vader_scored.csv", index=False)
    daily.to_csv(TABLE_DIR / "historical_sentiment_daily_vader.csv")
    annual.to_csv(TABLE_DIR / "historical_sentiment_coverage_by_year.csv", index=False)
    source_summary.to_csv(TABLE_DIR / "historical_sentiment_coverage_by_source.csv", index=False)

    observed = int(daily["article_count"].gt(0).sum())
    print(f"Raw in-period source records: {len(raw)}")
    print(f"Unique in-period dated headlines: {len(articles)}")
    print(f"NGX trading dates with headlines: {observed}/{len(trading_dates)} ({100 * observed / len(trading_dates):.1f}%)")
    print("\nAnnual coverage:")
    print(annual.to_string(index=False))
    print("\nBy source:")
    print(source_summary.to_string(index=False))
    return articles, daily, annual


if __name__ == "__main__":
    analyze_historical_sentiment()