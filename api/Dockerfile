# Works locally and as a Hugging Face Docker Space (Spaces route traffic to port 7860).
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    OMP_NUM_THREADS=1 \
    MKL_NUM_THREADS=1 \
    PORT=7860

WORKDIR /app

COPY api/requirements.txt /app/requirements.txt
# CPU-only PyTorch wheels keep the image far smaller than the default CUDA build.
RUN pip install --no-cache-dir --extra-index-url https://download.pytorch.org/whl/cpu -r /app/requirements.txt

COPY api /app/api
COPY results/models/gat_walkforward /app/results/models/gat_walkforward
COPY results/models/ppo_walkforward /app/results/models/ppo_walkforward
# Only the inputs the API reads (features_pit_daily.csv is not needed and exceeds 10 MB).
COPY data/processed/model_inputs/monthly_stock_snapshots.csv \
     data/processed/model_inputs/simple_returns_pit_daily.csv \
     data/processed/model_inputs/active_mask_daily.csv \
     data/processed/model_inputs/volume_pit_daily.csv \
     /app/data/processed/model_inputs/

# Hugging Face runs containers as user 1000.
RUN useradd -m -u 1000 user && chown -R user /app
USER user

EXPOSE 7860

CMD ["sh", "-c", "uvicorn api.main:app --host 0.0.0.0 --port ${PORT}"]
