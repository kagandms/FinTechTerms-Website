"""
FinTechTerms Bot — Health Check Server
Flask server that responds to UptimeRobot pings to prevent Render free tier spin-down.
Runs in a background thread alongside the bot's polling loop.
"""

import os
import logging
from datetime import datetime, timezone
from threading import Thread

from flask import Flask, jsonify
from bot.runtime_state import get_runtime_health

logger = logging.getLogger(__name__)

app = Flask(__name__)


@app.route("/", methods=["GET"])
@app.route("/health", methods=["GET"])
def health() -> str:
    """Root health check endpoint for Render/Uptime monitors."""
    timestamp = datetime.now(timezone.utc).isoformat()
    runtime_health = get_runtime_health()
    is_ready = runtime_health["ready"] is True
    status_code = 200 if is_ready else 503

    logger.info("Health check pinged at %s (ready=%s)", timestamp, is_ready)
    return jsonify({
        "status": "alive" if is_ready else "degraded",
        "service": "FinTechTerms Telegram Bot",
        "timestamp": timestamp,
        **runtime_health,
    }), status_code


def keep_alive() -> None:
    """Start the Flask health check server in a daemon thread."""
    port = int(os.environ.get("PORT", 8080))

    def _run() -> None:
        # Suppress Flask's default request logs to reduce noise
        flask_log = logging.getLogger("werkzeug")
        flask_log.setLevel(logging.WARNING)
        app.run(host="0.0.0.0", port=port)

    thread = Thread(target=_run, daemon=True)
    thread.start()
    logger.info("🌐 Health check server started on port %d", port)
