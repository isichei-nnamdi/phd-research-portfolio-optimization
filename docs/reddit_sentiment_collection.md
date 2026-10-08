# Reddit Sentiment Collection

The project includes a read-only Reddit API collector at `scripts/collect_reddit_sentiment.py`. It uses OAuth and searches recent public Reddit posts for the 39 tickers in the processed NGX return panel.

## Local Setup

Create or register an application through Reddit's developer/app settings and use credentials only for API access permitted by Reddit's current terms. Configure these variables in the local environment that will run the script:

- `REDDIT_CLIENT_ID`
- `REDDIT_CLIENT_SECRET`
- `REDDIT_USER_AGENT`, using a descriptive application identifier and contact handle

Do not put credentials in source files, notebooks, chat, or version control. The collector checks for missing values without printing any credential contents.

Run from the repository root in PowerShell:

```powershell
.\.venv\Scripts\python.exe scripts\collect_reddit_sentiment.py
```

The collector saves `scripts/ngx_research_data/raw/sentiment/reddit_posts.csv`. It retains the ticker and search query, post ID, timestamp, title, body text, subreddit, score, comment count, permalink, and URL. Duplicate posts returned for more than one ticker query are deduplicated by Reddit post ID; the first matching ticker assignment is retained.

## Coverage Limitations

Reddit search is not a complete historical archive. The current collector requests the most recent year, with a maximum of 100 posts per ticker query, and only public posts discoverable by Reddit search. Sparse or zero results for a ticker are possible. Record the collection date and query configuration when interpreting results. This source adds Reddit posts; it does not represent all Nigerian social media, and it should not be described as a full social-media census.

After collection, inspect post relevance and coverage before including the data in portfolio evaluation. Sentiment labels and strategy choices should be fixed before a held-out test to reduce selection bias.