"""Describe YouTube comment sentiment and its overlap with NGX returns."""

from __future__ import annotations

from pathlib import Path

import pandas as pd
from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer


ROOT = Path(__file__).resolve().parents[1]
COMMENTS_PATH = (
    ROOT
    / "scripts"
    / "ngx_research_data"
    / "raw"
    / "sentiment"
    / "youtube_comments.csv"
)
RETURNS_PATH = ROOT / "data" / "processed" / "ngx_returns_wide.csv"
TABLE_DIR = ROOT / "results" / "tables"


def analyze_youtube_sentiment() -> tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame]:
    if not COMMENTS_PATH.exists():
        raise FileNotFoundError(f"YouTube comments file not found: {COMMENTS_PATH}")
    if not RETURNS_PATH.exists():
        raise FileNotFoundError(f"NGX return panel not found: {RETURNS_PATH}")

    comments = pd.read_csv(COMMENTS_PATH)
    required = {"comment_id", "comment", "comment_published_at", "video_id"}
    missing = required.difference(comments.columns)
    if missing:
        raise ValueError(f"YouTube comments file is missing columns: {sorted(missing)}")

    comments = comments.drop_duplicates(subset="comment_id").copy()
    comments["comment"] = comments["comment"].fillna("").astype(str).str.strip()
    comments["comment_published_at"] = pd.to_datetime(
        comments["comment_published_at"], errors="coerce", utc=True
    )
    comments = comments.dropna(subset=["comment_published_at"])
    comments = comments.loc[comments["comment"].ne("")].copy()
    if comments.empty:
        raise ValueError("No timestamped, non-empty YouTube comments are available.")

    analyzer = SentimentIntensityAnalyzer()
    score_rows = comments["comment"].map(analyzer.polarity_scores)
    comments["vader_compound"] = score_rows.map(lambda score: score["compound"])
    comments["vader_positive"] = score_rows.map(lambda score: score["pos"])
    comments["vader_negative"] = score_rows.map(lambda score: score["neg"])
    comments["vader_neutral"] = score_rows.map(lambda score: score["neu"])
    comments["sentiment_class"] = comments["vader_compound"].map(
        lambda score: "positive" if score >= 0.05 else "negative" if score <= -0.05 else "neutral"
    )
    comments["date"] = comments["comment_published_at"].dt.tz_convert(None).dt.normalize()

    daily = (
        comments.groupby("date")
        .agg(
            sentiment_mean=("vader_compound", "mean"),
            sentiment_median=("vader_compound", "median"),
            sentiment_std=("vader_compound", "std"),
            positive_ratio=("sentiment_class", lambda values: values.eq("positive").mean()),
            negative_ratio=("sentiment_class", lambda values: values.eq("negative").mean()),
            neutral_ratio=("sentiment_class", lambda values: values.eq("neutral").mean()),
            comment_count=("comment_id", "nunique"),
            video_count=("video_id", "nunique"),
        )
        .rename_axis("date")
        .reset_index()
    )

    returns = pd.read_csv(RETURNS_PATH, index_col=0, parse_dates=True)
    return_dates = pd.DatetimeIndex(returns.index).normalize().unique()
    comments["return_date_overlap"] = comments["date"].isin(return_dates)
    overlapping_comments = int(comments["return_date_overlap"].sum())

    classes = comments["sentiment_class"].value_counts()
    summary = pd.DataFrame(
        [
            {
                "comment_count": len(comments),
                "video_count": comments["video_id"].nunique(),
                "channel_count": comments.get("channel_title", pd.Series(dtype=str)).nunique(),
                "comment_start_utc": comments["comment_published_at"].min(),
                "comment_end_utc": comments["comment_published_at"].max(),
                "return_start": return_dates.min(),
                "return_end": return_dates.max(),
                "comments_on_return_dates": overlapping_comments,
                "return_date_overlap_pct": 100 * overlapping_comments / len(comments),
                "mean_compound": comments["vader_compound"].mean(),
                "median_compound": comments["vader_compound"].median(),
                "positive_count": int(classes.get("positive", 0)),
                "neutral_count": int(classes.get("neutral", 0)),
                "negative_count": int(classes.get("negative", 0)),
                "positive_pct": 100 * classes.get("positive", 0) / len(comments),
                "neutral_pct": 100 * classes.get("neutral", 0) / len(comments),
                "negative_pct": 100 * classes.get("negative", 0) / len(comments),
            }
        ]
    )

    channel_summary = (
        comments.groupby("channel_title", dropna=False)
        .agg(
            comment_count=("comment_id", "nunique"),
            video_count=("video_id", "nunique"),
            mean_compound=("vader_compound", "mean"),
        )
        .sort_values("comment_count", ascending=False)
        .reset_index()
    )

    TABLE_DIR.mkdir(parents=True, exist_ok=True)
    comments.to_csv(TABLE_DIR / "youtube_comments_scored.csv", index=False)
    daily.to_csv(TABLE_DIR / "youtube_sentiment_daily.csv", index=False)
    summary.to_csv(TABLE_DIR / "youtube_sentiment_summary.csv", index=False)
    channel_summary.to_csv(TABLE_DIR / "youtube_sentiment_by_channel.csv", index=False)

    print("YouTube sentiment summary:")
    print(summary.to_string(index=False))
    print("\nBy sentiment class:")
    print(comments["sentiment_class"].value_counts().to_string())
    print("\nTop channels by comment count:")
    print(channel_summary.head(10).to_string(index=False))
    print(f"\nSaved analysis tables to {TABLE_DIR}")
    return comments, daily, summary


if __name__ == "__main__":
    analyze_youtube_sentiment()