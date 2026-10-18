
# ---------- Stage 1: build the React interface ----------
FROM node:20-alpine AS frontend-build

WORKDIR /frontend

# package-lock.json is used when present (reproducible install).
COPY frontend/package.json frontend/package-lock.json* ./
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi

COPY frontend/ ./
RUN npm run build


# ---------- Stage 2: Python runtime (API + built interface) ----------

# 1. Base Python image
FROM python:3.11-slim
# Apply available Debian security updates for liblzma5.
RUN apt-get update \
    && apt-get install -y --no-install-recommends --only-upgrade liblzma5 \
    && rm -rf /var/lib/apt/lists/*

# 2. Set the working directory
WORKDIR /app

# 3. Python environment settings
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# 4. Copy dependency manifests
COPY requirements.txt requirements-runtime.txt ./

# 5. Install runtime dependencies only
# Install runtime dependencies, then remove packaging tools.
RUN python -m pip install --no-cache-dir -r requirements-runtime.txt \
    && python -m pip uninstall -y pip setuptools wheel

# 6. Copy application code and the built interface (served at /app)
COPY app/ ./app/
COPY --from=frontend-build /frontend/dist ./frontend/dist

# 7. Create a non-root user

# Create a non-root user and persistent data directory
RUN useradd --create-home --uid 10001 appuser \
    && mkdir -p /app/data \
    && chown -R appuser:appuser /app

# SQLite database location inside Docker
ENV SECURESHIP_DB_PATH=/app/data/secureship.db

USER appuser

# 8. Document application port
EXPOSE 8000

# Container health, based on the API health endpoint
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/health', timeout=3)"

# 9. Start SecureShip
CMD ["python", "-m", "uvicorn", "app.main:app", \
     "--host", "0.0.0.0", "--port", "8000"]
