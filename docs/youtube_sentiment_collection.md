# YouTube Comment Collection

The project includes a public-comment collector at `scripts/collect_youtube_sentiment.py`. It uses the YouTube Data API v3 with an API key; OAuth and Reddit credentials are not required for public video search and public top-level comments.

## Create an API Key

1. Sign in to the [Google Cloud Console](https://console.cloud.google.com/).
2. Create or select a Google Cloud project.
3. Open **APIs & Services > Library**, find **YouTube Data API v3**, and enable it.
4. Open **APIs & Services > Credentials > Create credentials > API key**.
5. Restrict the key to the YouTube Data API v3 where possible. Keep it private and do not commit it.

Google may require billing profile setup even when using free quota. Check the project quota page before collection. The collector performs six `search.list` requests by default and then at most one comment-page request per video, up to 60 unique videos and 100 top-level comments per video. Search uses YouTube's separately limited search quota; comment requests consume the normal API quota. Do not increase these limits without checking current quotas.

## Run in PowerShell

Open PowerShell and run this block. It first changes to the repository root, so it works even if PowerShell opens in `C:\Windows\System32`. The key prompt is hidden:

```powershell
$projectRoot = "C:\Users\hp\Documents\Other_documents\PhD_files\PhD Thesis\phd-research-portfolio-optimization"
Set-Location $projectRoot

$secureKey = Read-Host "YouTube API key" -AsSecureString
$keyPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureKey)
try {
    $env:YOUTUBE_API_KEY = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($keyPointer)
} finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($keyPointer)
}
.\.venv\Scripts\python.exe scripts\collect_youtube_sentiment.py
Remove-Item Env:YOUTUBE_API_KEY
```

The key is read from `YOUTUBE_API_KEY`; the script does not print it or include it in error messages. If execution is interrupted before cleanup, close that terminal session to discard the variable.

## Output and Interpretation

The collector writes `scripts/ngx_research_data/raw/sentiment/youtube_comments.csv`. The CSV contains the comment text and timestamp, video title and channel, video publication date, search query, comment likes/replies, and video URL. Only public top-level comments are collected; replies are not currently fetched. Comments may be disabled, removed, unavailable, or limited by the API.

YouTube results are a discoverable sample of discussion on videos returned for the configured Nigerian market queries, not a census of Nigerian social media. They are not automatically attributed to individual listed stocks. Treat this as a separate market-level social signal unless comments are reliably and explicitly ticker-attributed, and check relevance/coverage before using it in the portfolio backtest. Follow Google's YouTube API Services Terms and Developer Policies when storing, refreshing, or using API data.