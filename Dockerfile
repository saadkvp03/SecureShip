
# 1. Base Python image
FROM python:3.11-slim

# 2. Set the working directory
WORKDIR /app

# 3. Python environment settings
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# 4. Copy dependencies
COPY requirements.txt .

# 5. Install Python packages
RUN pip install --no-cache-dir -r requirements.txt

# 6. Copy application code
COPY app/ ./app/

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

# 9. Start SecureShip
CMD ["python", "-m", "uvicorn", "app.main:app", \
     "--host", "0.0.0.0", "--port", "8000"]

