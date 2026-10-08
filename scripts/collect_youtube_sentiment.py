"""Collect public comments from YouTube videos about the Nigerian stock market."""

from __future__ import annotations

import os
import time
from pathlib import Path
from typing import Any

import pandas as pd
import requests


ROOT = Path(__file__).resolve().parents[1]
OUTPUT_PATH = (
    ROOT
    / "scripts"
    / "ngx_research_data"
    / "raw"
    / "sentiment"
    / "youtube_comments.csv"
)
API_ROOT = "https://www.googleapis.com/youtube/v3"
SEARCH_QUERIES = (
    "Nigerian stock market NGX",
    "NGX stock market analysis Nigeria",
    "Nigerian stocks investing NGX",
    "Nigerian Stock Exchange All Share Index",
    "NGX market outlook Nigeria",
    "investing in Nigerian stocks",
)
USER_AGENT = "NGX-PhD-Sentiment-Research/1.0"


def get_api_key() -> str:
    api_key = os.getenv("YOUTUBE_API_KEY")
    if not api_key:
        raise RuntimeError(
            "Set the YOUTUBE_API_KEY environment variable locally before running "
            "the collector. Do not paste the key into chat or commit it."
        )
    return api_key


def api_get(
    session: requests.Session,
    endpoint: str,
    api_key: str,
    params: dict[str, Any],
) -> dict[str, Any]:
    response = session.get(
        f"{API_ROOT}/{endpoint}",
        params={**params, "key": api_key},
        timeout=30,
    )
    if not response.ok:
        try:
            error = response.json().get("error", {}).get("message", "")
        except ValueError:
            error = ""
        detail = f": {error}" if error else ""
        raise RuntimeError(
            f"YouTube API {endpoint} returned HTTP {response.status_code}{detail}. "
            "The API key is omitted from this message."
        )
    return response.json()


def search_videos(
    session: requests.Session,
    api_key: str,
    query: str,
    max_results: int,
    published_after: str | None,
) -> list[dict[str, Any]]:
    params: dict[str, Any] = {
        "part": "snippet",
        "q": query,
        "type": "video",
        "order": "date",
        "maxResults": min(max_results, 50),
        "regionCode": "NG",
        "relevanceLanguage": "en",
        "safeSearch": "none",
    }
    if published_after:
        params["publishedAfter"] = published_after
    payload = api_get(session, "search", api_key, params)
    results = []
    for item in payload.get("items", []):
        video_id = item.get("id", {}).get("videoId")
        snippet = item.get("snippet", {})
        if video_id:
            results.append(
                {
                    "video_id": video_id,
                    "video_title": snippet.get("title", ""),
                    "channel_title": snippet.get("channelTitle", ""),
                    "video_published_at": snippet.get("publishedAt", ""),
                    "search_query": query,
                }
            )
    return results


def fetch_video_comments(
    session: requests.Session,
    api_key: str,
    video: dict[str, Any],
    max_comments: int,
) -> list[dict[str, Any]]:
    comments: list[dict[str, Any]] = []
    page_token = None
    while len(comments) < max_comments:
        params: dict[str, Any] = {
            "part": "snippet",
            "videoId": video["video_id"],
            "maxResults": min(100, max_comments - len(comments)),
            "order": "time",
            "textFormat": "plainText",
        }
        if page_token:
            params["pageToken"] = page_token
        try:
            payload = api_get(session, "commentThreads", api_key, params)
        except RuntimeError as exc:
            if "disabled comments" in str(exc).lower():
                return comments
            raise

        for item in payload.get("items", []):
            thread = item.get("snippet", {})
            comment = thread.get("topLevelComment", {})
            snippet = comment.get("snippet", {})
            comments.append(
                {
                    "comment_id": comment.get("id", ""),
                    "comment": snippet.get("textOriginal", snippet.get("textDisplay", "")),
                    "comment_published_at": snippet.get("publishedAt", ""),
                    "like_count": snippet.get("likeCount", 0),
                    "reply_count": thread.get("totalReplyCount", 0),
                    **video,
                    "video_url": f"https://www.youtube.com/watch?v={video['video_id']}",
                    "source": "youtube",
                }
            )

        page_token = payload.get("nextPageToken")
        if not page_token or not payload.get("items"):
            break
        time.sleep(0.1)
    return comments


def collect_youtube_comments(
    api_key: str | None = None,
    max_videos_per_query: int = 10,
    max_comments_per_video: int = 100,
    published_after: str | None = None,
    output_path: Path = OUTPUT_PATH,
) -> pd.DataFrame:
    """Search current NGX-related videos and collect public top-level comments.

    The default run uses six search requests and collects up to 60 videos x
    100 comments, within YouTube's default separate search quota bucket.
    """
    if max_videos_per_query < 1 or max_videos_per_query > 50:
        raise ValueError("max_videos_per_query must be between 1 and 50.")
    if max_comments_per_video < 1 or max_comments_per_video > 100:
        raise ValueError("max_comments_per_video must be between 1 and 100.")

    key = api_key or get_api_key()
    session = requests.Session()
    session.headers.update({"User-Agent": USER_AGENT})

    videos_by_id: dict[str, dict[str, Any]] = {}
    for query in SEARCH_QUERIES:
        results = search_videos(
            session, key, query, max_videos_per_query, published_after
        )
        for video in results:
            videos_by_id.setdefault(video["video_id"], video)
        print(f"Search returned {len(results)} videos: {query}")
        time.sleep(0.1)

    rows = []
    total_videos = len(videos_by_id)
    for index, video in enumerate(videos_by_id.values(), start=1):
        try:
            rows.extend(
                fetch_video_comments(
                    session, key, video, max_comments_per_video
                )
            )
        except RuntimeError as exc:
            print(f"Skipping comments for video {video['video_id']}: {exc}")
        if index % 10 == 0 or index == total_videos:
            print(f"Collected comments from {index}/{total_videos} videos")
        time.sleep(0.1)

    comments = pd.DataFrame(rows)
    if comments.empty:
        comments = pd.DataFrame(
            columns=[
                "comment_id", "comment", "comment_published_at", "like_count",
                "reply_count", "video_id", "video_title", "channel_title",
                "video_published_at", "search_query", "video_url", "source",
            ]
        )
    else:
        comments = comments.drop_duplicates(subset="comment_id")
        comments["comment_published_at"] = pd.to_datetime(
            comments["comment_published_at"], utc=True, errors="coerce"
        )
        comments["video_published_at"] = pd.to_datetime(
            comments["video_published_at"], utc=True, errors="coerce"
        )

    output_path = Path(output_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    comments.to_csv(output_path, index=False)
    print(f"Saved {len(comments)} unique public comments to {output_path}")
    if not comments.empty:
        print(
            "Comment date range: "
            f"{comments['comment_published_at'].min()} to "
            f"{comments['comment_published_at'].max()}"
        )
        print(f"Videos represented: {comments['video_id'].nunique()}")
    return comments


if __name__ == "__main__":
    collect_youtube_comments()