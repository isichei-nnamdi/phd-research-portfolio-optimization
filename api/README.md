# GAT + PPO Inference API

FastAPI loads the annual GAT `.pt` bundles and PPO `.zip` policies from `results/models/` in this repository. Fold metadata is required alongside each checkpoint: GAT bundles include ticker order, feature names, training-fold scaler, and graph settings; PPO policies have matching JSON sidecars.

## Run locally

From the repository root, using the project environment:

```powershell
.\.venv\Scripts\python.exe -m uvicorn api.main:app --host 127.0.0.1 --port 8000
```

Open `http://127.0.0.1:8000/docs` for the interactive schema. `GET /health` reports which annual artifacts are available. `GET /v1/inference/latest?model_year=2025` loads the latest prepared in-repository feature snapshot and returns GAT rankings and PPO weights. `POST /v1/inference` accepts caller-supplied point-in-time features and recent daily simple returns.

## Container deployment

Build from the repository root so Docker can copy the model checkpoints and prepared inputs:

```powershell
docker build -f api/Dockerfile -t ngx-inference:local .
docker run --rm -p 8000:8000 ngx-inference:local
```

For a hosted deployment, push the image to your container registry and deploy it to a private service. Configure `INFERENCE_API_URL` in the Next.js host to the API's HTTPS address. Do not put a model API key in a `NEXT_PUBLIC_` variable; the Next.js route makes the request server-side. Configure `CORS_ORIGINS` only if browsers will call FastAPI directly; the included Next.js proxy does not require browser-to-FastAPI CORS.

The POST request must include all ticker symbols and features in the chosen fold's metadata, a common chronological return history of at least 30 observations for each ticker (60 is preferred), point-in-time active flags, and the signal date. The service deliberately rejects missing or unknown tickers and fewer than five eligible assets. Input features are normalized using the scaler saved with the selected training fold.

## Next.js

The `ngx-advisor` Next route proxies requests server-to-server. Start FastAPI, then configure this environment variable for Next.js:

```text
INFERENCE_API_URL=http://127.0.0.1:8000
```

The default is already `http://127.0.0.1:8000` for local development. Deployments should set `INFERENCE_API_URL` to a reachable private API host; do not expose the model service publicly without authentication, rate limiting, TLS, and an operational model/data update plan.

## Important model/data caveat

The currently prepared latest snapshot is dated 2025-11-28, and the underlying observed price data ends in 2025. This API is therefore a historical research demonstration, not a live trading or current market recommendation service. The API reports `signal_date` and `stale_days` so clients can display this explicitly. Updating prices/features and rerunning the preparation pipeline is required before each new inference date. Model fold year selects which saved annual policy/checkpoint is used; it does not change the signal date.

The weights are experimental single-seed prototypes trained on price-based simple returns, not verified dividend-adjusted total returns. They are not financial advice. Keep checkpoint files, inference metadata, and their training code versioned together.