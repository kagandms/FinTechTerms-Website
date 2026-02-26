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

logger = logging.getLogger(__name__)

app = Flask(__name__)


@app.route("/")
def health() -> str:
    """Root health check endpoint for UptimeRobot."""
    logger.info("Health check pinged at %s", datetime.now(timezone.utc).isoformat())
    return jsonify({
        "status": "alive",
        "service": "FinTechTerms Telegram Bot",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    })


@app.route("/health")
def health_detailed() -> str:
    """Detailed health check with Supabase connectivity test."""
    db_ok = False
    try:
        from bot.database import get_client
        result = get_client().table("terms").select("id").limit(1).execute()
        db_ok = bool(result.data)
    except Exception as e:
        logger.warning("DB health check failed: %s", e)

    return jsonify({
        "status": "alive",
        "database": "connected" if db_ok else "unreachable",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    })


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
