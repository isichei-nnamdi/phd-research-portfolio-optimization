"""Collect recent NGX-related Reddit posts through Reddit's OAuth API."""

from __future__ import annotations

import os
import time
from pathlib import Path

import pandas as pd
import requests
from requests.auth import HTTPBasicAuth


ROOT = Path(__file__).resolve().parents[1]
OUTPUT_PATH = (
    ROOT
    / "scripts"
    / "ngx_research_data"
    / "raw"
    / "sentiment"
    / "reddit_posts.csv"
)
TOKEN_URL = "https://www.reddit.com/api/v1/access_token"
SEARCH_URL = "https://oauth.reddit.com/r/all/search"

TICKER_NAMES = {
    "ZENITHBANK": "Zenith Bank",
    "GTCO": "GTCO OR Guaranty Trust",
    "ACCESSCORP": "Access Holdings",
    "FBNH": "FBNH OR First HoldCo",
    "UBA": "UBA OR United Bank for Africa",
    "STANBIC": "Stanbic IBTC",
    "FIDELITYBK": "Fidelity Bank Nigeria",
    "FCMB": "FCMB Group",
    "ETI": "Ecobank Nigeria",
    "WEMABANK": "Wema Bank",
    "NESTLE": "Nestle Nigeria",
    "DANGSUGAR": "Dangote Sugar",
    "NB": "Nigerian Breweries",
    "INTBREW": "International Breweries Nigeria",
    "BUAFOODS": "BUA Foods",
    "SEPLAT": "Seplat Energy",
    "OANDO": "Oando Nigeria",
    "TOTAL": "TotalEnergies Nigeria",
    "ARADEL": "Aradel Holdings",
    "DANGCEM": "Dangote Cement",
    "BUACEMENT": "BUA Cement Nigeria",
    "WAPCO": "Lafarge Africa Nigeria",
    "GEREGU": "Geregu Power",
    "PRESCO": "Presco Nigeria",
    "MTNN": "MTN Nigeria",
    "AIRTELAFRI": "Airtel Africa Nigeria",
    "TRANSCORP": "Transcorp Nigeria",
    "NASCON": "NASCON Nigeria",
    "OKOMUOIL": "Okomu Oil Palm",
    "LIVESTOCK": "Livestock Feeds Nigeria",
    "CONOIL": "Conoil Nigeria",
    "JBERGER": "Julius Berger Nigeria",
    "FLOURMILLS": "Flour Mills Nigeria",
    "STERLINGNG": "Sterling Financial Nigeria",
    "UNILEVE": "Unilever Nigeria",
    "PZ": "PZ Cussons Nigeria",
    "CADBURY": "Cadbury Nigeria",
    "GSK": "GSK Nigeria",
    "HONYFLOUR": "Honeywell Flour Mills",
}


def get_access_token(session: requests.Session) -> str:
    client_id = os.getenv("REDDIT_CLIENT_ID")
    client_secret = os.getenv("REDDIT_CLIENT_SECRET")
    user_agent = os.getenv("REDDIT_USER_AGENT")
    missing = [
        name
        for name, value in (
            ("REDDIT_CLIENT_ID", client_id),
            ("REDDIT_CLIENT_SECRET", client_secret),
            ("REDDIT_USER_AGENT", user_agent),
        )
        if not value
    ]
    if missing:
        raise RuntimeError(
            "Configure these local environment variables before collection: "
            + ", ".join(missing)
            + ". Do not paste credentials into chat or commit them to the repository."
        )

    response = session.post(
        TOKEN_URL,
        auth=HTTPBasicAuth(client_id, client_secret),
        data={"grant_type": "client_credentials"},
        headers={"User-Agent": user_agent},
        timeout=30,
    )
    response.raise_for_status()
    token = response.json().get("access_token")
    if not token:
        raise RuntimeError("Reddit OAuth response did not include an access token.")
    return token


def search_posts(
    session: requests.Session,
    token: str,
    ticker: str,
    query: str,
    max_posts: int,
) -> list[dict[str, object]]:
    posts: list[dict[str, object]] = []
    after = None
    while len(posts) < max_posts:
        params: dict[str, object] = {
            "q": query,
            "sort": "new",
            "t": "year",
            "limit": min(100, max_posts - len(posts)),
            "type": "link",
            "restrict_sr": "false",
        }
        if after:
            params["after"] = after

        response = session.get(
            SEARCH_URL,
            params=params,
            headers={"Authorization": f"bearer {token}"},
            timeout=30,
        )
        if response.status_code == 429:
            retry_after = float(response.headers.get("Retry-After", "10"))
            time.sleep(max(retry_after, 1.0))
            continue
        response.raise_for_status()
        payload = response.json().get("data", {})
        children = payload.get("children", [])
        for child in children:
            data = child.get("data", {})
            posts.append(
                {
                    "ticker": ticker,
                    "query": query,
                    "post_id": data.get("id", ""),
                    "created_utc": data.get("created_utc"),
                    "title": data.get("title", ""),
                    "selftext": data.get("selftext", ""),
                    "subreddit": data.get("subreddit", ""),
                    "score": data.get("score"),
                    "num_comments": data.get("num_comments"),
                    "permalink": "https://www.reddit.com" + data.get("permalink", ""),
                    "url": data.get("url", ""),
                    "source": "reddit",
                }
            )

        after = payload.get("after")
        if not after or not children:
            break
        time.sleep(1.0)
    return posts


def collect_reddit_posts(
    max_posts_per_ticker: int = 100,
    output_path: Path = OUTPUT_PATH,
) -> pd.DataFrame:
    """Search recent public Reddit posts mentioning NGX stocks."""
    session = requests.Session()
    user_agent = os.getenv("REDDIT_USER_AGENT", "")
    token = get_access_token(session)
    session.headers.update({"User-Agent": user_agent})
    rows = []
    for ticker, name_query in TICKER_NAMES.items():
        query = f'({ticker} OR "{name_query}") Nigeria stock OR NGX'
        try:
            ticker_rows = search_posts(
                session, token, ticker, query, max_posts_per_ticker
            )
            rows.extend(ticker_rows)
            print(f"{ticker}: {len(ticker_rows)} posts")
        except requests.RequestException as exc:
            print(f"{ticker}: request failed ({exc})")
        time.sleep(1.0)

    posts = pd.DataFrame(rows)
    if posts.empty:
        posts = pd.DataFrame(
            columns=[
                "ticker", "query", "post_id", "created_utc", "title", "selftext",
                "subreddit", "score", "num_comments", "permalink", "url", "source",
            ]
        )
    else:
        posts = posts.drop_duplicates(subset="post_id")
        posts["created_at"] = pd.to_datetime(
            posts["created_utc"], unit="s", utc=True, errors="coerce"
        )

    output_path = Path(output_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    posts.to_csv(output_path, index=False)
    print(f"Saved {len(posts)} unique Reddit posts to {output_path}")
    if not posts.empty:
        print(f"Date range: {posts['created_at'].min()} to {posts['created_at'].max()}")
        print("Posts by subreddit:")
        print(posts.groupby("subreddit").size().sort_values(ascending=False).head(15))
    return posts


if __name__ == "__main__":
    collect_reddit_posts()