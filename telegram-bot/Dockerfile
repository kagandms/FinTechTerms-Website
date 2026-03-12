# FinTechTerms Telegram Bot — Docker Image
# Python 3.11 slim for minimal footprint

FROM python:3.11-slim AS base

# Set working directory
WORKDIR /app

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

# Health check for container orchestrators
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD python -c "import os, socket; s=socket.create_connection(('localhost', int(os.environ.get('PORT', '8080'))), timeout=2); s.close()" || exit 1

# Run the bot
CMD ["python", "-m", "bot"]
