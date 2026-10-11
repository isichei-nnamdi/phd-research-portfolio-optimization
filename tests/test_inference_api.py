import unittest

from fastapi.testclient import TestClient

from api.main import app


class InferenceApiTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)

    def test_health_reports_available_fold_artifacts(self):
        response = self.client.get("/health")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["status"], "ok")
        self.assertTrue(response.json()["models"]["2025"])

    def test_latest_inference_returns_rankings_and_valid_weights(self):
        response = self.client.get("/v1/inference/latest?model_year=2025")
        self.assertEqual(response.status_code, 200, response.text)
        payload = response.json()
        self.assertEqual(payload["model_year"], 2025)
        self.assertGreaterEqual(payload["eligible_assets"], 5)
        self.assertGreater(len(payload["gat_rankings"]), 0)
        self.assertGreaterEqual(len(payload["ppo_allocations"]), 5)
        weights = [allocation["weight"] for allocation in payload["ppo_allocations"]]
        self.assertAlmostEqual(sum(weights), 1.0, places=6)
        self.assertLessEqual(max(weights), 0.200001)

    def test_unknown_model_year_is_rejected(self):
        response = self.client.get("/v1/inference/latest?model_year=2018")
        self.assertEqual(response.status_code, 422)


if __name__ == "__main__":
    unittest.main()