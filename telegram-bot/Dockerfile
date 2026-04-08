# FinTechTerms Telegram Bot — Docker Image
# Python 3.13 slim to match the compiled lockfile target

FROM python:3.13-slim AS base

# Set working directory
WORKDIR /app

ENV PORT=8080

# Install system dependencies for edge-tts audio generation
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first for better layer caching
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Create audio cache directory
RUN mkdir -p audio_cache

EXPOSE 8080

# Health check for container orchestrators
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD python -c "import os, urllib.request; urllib.request.urlopen(f'http://127.0.0.1:{os.environ.get(\"PORT\", \"8080\")}/health', timeout=2)" || exit 1

# Run the bot
CMD ["python", "-m", "bot"]
