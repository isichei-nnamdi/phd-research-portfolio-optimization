# GAT + PPO Inference API

FastAPI loads the annual GAT `.pt` bundles and PPO `.zip` policies from `results/models/` in this repository. Fold metadata is required alongside each checkpoint: GAT bundles include ticker order, feature names, training-fold scaler, and graph settings; PPO policies have matching JSON sidecars.

## Run locally

From the repository root, using the project environment:

```powershell
.\.venv\Scripts\python.exe -m uvicorn api.main:app --host 127.0.0.1 --port 8000
```

Open `http://127.0.0.1:8000/docs` for the interactive schema. `GET /health` reports which annual artifacts are available. `GET /v1/inference/latest?model_year=2025` loads the latest prepared in-repository feature snapshot and returns GAT rankings and PPO weights. `GET /v1/recommend?sector=All` runs the same models and returns the advisor's Conservative (10 stocks), Moderate (8) and Aggressive (5) portfolios; the rule lives in `api/profiles.py`. `sector` is one of `All`, `Financial`, `Oil & Gas`, `Consumer`, `ICT`. `POST /v1/inference` accepts caller-supplied point-in-time features and recent daily simple returns.

## Container deployment

Build from the repository root so Docker can copy the model checkpoints and prepared inputs:

```powershell
docker build -f api/Dockerfile -t ngx-inference:local .
docker run --rm -p 7860:7860 ngx-inference:local
```

For a hosted deployment, push the image to your container registry and deploy it to a private service. Configure `INFERENCE_API_URL` in the Next.js host to the API's HTTPS address. Do not put a model API key in a `NEXT_PUBLIC_` variable; the Next.js route makes the request server-side. Configure `CORS_ORIGINS` only if browsers will call FastAPI directly; the included Next.js proxy does not require browser-to-FastAPI CORS.

The POST request must include all ticker symbols and features in the chosen fold's metadata, a common chronological return history of at least 30 observations for each ticker (60 is preferred), point-in-time active flags, and the signal date. The service deliberately rejects missing or unknown tickers and fewer than five eligible assets. Input features are normalized using the scaler saved with the selected training fold.

## Hugging Face Space

1. Create a new Space with the **Docker** SDK.
2. Push these paths to the Space repository, keeping the same layout: `api/`, `results/models/gat_walkforward/`, `results/models/ppo_walkforward/`, and the four files `monthly_stock_snapshots.csv`, `simple_returns_pit_daily.csv`, `active_mask_daily.csv`, `volume_pit_daily.csv` under `data/processed/model_inputs/`. Copy `api/Dockerfile` to the Space root as `Dockerfile`.
3. Add this header to the Space's `README.md`:

   ```yaml
   ---
   title: NGX Inference
   sdk: docker
   app_port: 7860
   ---
   ```
4. Choose one way to protect the API:
   - **Private Space:** set `INFERENCE_API_TOKEN` in the Next.js host to a Hugging Face read token. Leave `API_TOKEN` unset on the Space.
   - **Public Space:** add a Space secret `API_TOKEN` and set the same value as `INFERENCE_API_TOKEN` in the Next.js host.
5. Set `INFERENCE_API_URL` in the Next.js host to the Space URL, e.g. `https://<user>-ngx-inference.hf.space`.

Free Spaces sleep when idle, so the first request can take 30 to 60 seconds. The Next.js route allows up to 55 seconds and otherwise falls back to the saved snapshot output, labelled as such in the UI.

After retraining models or refreshing data, rerun `scripts/build_profile_backtests.py` so the web app's estimates and saved snapshot match the deployed models.

## Next.js

The `ngx-advisor` Next route proxies requests server-to-server. Start FastAPI, then configure this environment variable for Next.js:

```text
INFERENCE_API_URL=http://127.0.0.1:8000
INFERENCE_API_TOKEN=   # optional, see the Hugging Face section
```

If `INFERENCE_API_URL` is not set, or the service is unreachable, the advisor shows the saved model output for the latest snapshot and says so. Deployments should set `INFERENCE_API_URL` to a reachable private API host; do not expose the model service publicly without authentication, rate limiting, TLS, and an operational model/data update plan.

## Important model/data caveat

The currently prepared latest snapshot is dated 2025-11-28, and the underlying observed price data ends in 2025. This API is therefore a historical research demonstration, not a live trading or current market recommendation service. The API reports `signal_date` and `stale_days` so clients can display this explicitly. Updating prices/features and rerunning the preparation pipeline is required before each new inference date. Model fold year selects which saved annual policy/checkpoint is used; it does not change the signal date.

The weights are experimental single-seed prototypes trained on price-based simple returns, not verified dividend-adjusted total returns. They are not financial advice. Keep checkpoint files, inference metadata, and their training code versioned together.