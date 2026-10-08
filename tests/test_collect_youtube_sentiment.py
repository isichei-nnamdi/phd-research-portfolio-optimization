import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import pandas as pd

from scripts import collect_youtube_sentiment as collector


class YouTubeCollectorTests(unittest.TestCase):
    def test_api_key_is_required_without_echoing_a_value(self):
        with patch.dict(os.environ, {}, clear=True):
            with self.assertRaisesRegex(RuntimeError, "YOUTUBE_API_KEY"):
                collector.get_api_key()

    def test_collection_deduplicates_videos_and_comments(self):
        videos = [
            {
                "video_id": "video-1",
                "video_title": "NGX market update",
                "channel_title": "Market channel",
                "video_published_at": "2026-10-01T10:00:00Z",
                "search_query": "query-one",
            },
            {
                "video_id": "video-1",
                "video_title": "NGX market update",
                "channel_title": "Market channel",
                "video_published_at": "2026-10-01T10:00:00Z",
                "search_query": "query-two",
            },
        ]
        comment = {
            "comment_id": "comment-1",
            "comment": "Market sentiment text",
            "comment_published_at": "2026-10-02T10:00:00Z",
            "like_count": 2,
            "reply_count": 0,
            **videos[0],
            "video_url": "https://www.youtube.com/watch?v=video-1",
            "source": "youtube",
        }

        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory) / "comments.csv"
            with (
                patch.object(collector, "SEARCH_QUERIES", ("query-one", "query-two")),
                patch.object(collector, "search_videos", side_effect=[videos[:1], videos[1:]]),
                patch.object(collector, "fetch_video_comments", return_value=[comment, comment]) as fetch,
                patch("builtins.print"),
            ):
                result = collector.collect_youtube_comments(
                    api_key="test-key",
                    max_videos_per_query=1,
                    max_comments_per_video=2,
                    output_path=output,
                )

            self.assertEqual(fetch.call_count, 1)
            self.assertEqual(len(result), 1)
            self.assertEqual(result.iloc[0]["comment_id"], "comment-1")
            self.assertEqual(len(pd.read_csv(output)), 1)


if __name__ == "__main__":
    unittest.main()