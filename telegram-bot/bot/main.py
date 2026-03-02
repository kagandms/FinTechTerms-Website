"""
FinTechTerms Telegram Bot — Main Entry Point
Supports both local development (polling) and Render production (polling + health check).

Usage:
    Local:  python -m bot
    Render: Start command → python -m bot  (PORT env set automatically)
"""

from __future__ import annotations

import asyncio
import logging
import os
import sys

from telegram.ext import (
    ApplicationBuilder,
    CommandHandler,
    CallbackQueryHandler,
    MessageHandler,
    filters,
)

from bot.config import config
from bot.handlers import (
    start_handler,
    search_handler,
    daily_handler,
    quiz_handler,
    lang_handler,
    stats_handler,
    help_handler,
    report_handler,
    link_handler,
    callback_handler,
    text_handler,
)

# ── Logging ────────────────────────────────────────────────
logging.basicConfig(
    format="%(asctime)s [%(name)s] %(levelname)s: %(message)s",
    level=logging.INFO,
    handlers=[logging.StreamHandler(sys.stdout)],
)
logger = logging.getLogger("ftt_bot")

# Reduce noise from httpx / telegram library
logging.getLogger("httpx").setLevel(logging.WARNING)
logging.getLogger("telegram").setLevel(logging.WARNING)


def main() -> None:
    """Build and run the Telegram bot application."""

    # Validate configuration
    try:
        config.validate()
    except ValueError as e:
        logger.critical("Configuration error: %s", e)
        sys.exit(1)

    # Detect Render production environment
    is_production = bool(os.environ.get("RENDER"))
    webhook_url = os.environ.get("RENDER_EXTERNAL_URL", "")

    if is_production:
        logger.info("🚀 PRODUCTION MODE — Render detected")
        logger.info("   Supabase URL: %s", config.supabase_url)
        
        logger.info("   Starting keep_alive health check server on polling mode…")
        # Start Flask health check in background thread for polling to bind PORT
        from bot.keep_alive import keep_alive
        keep_alive()
    else:
        logger.info("📡 LOCAL MODE — Development")
        logger.info("   Supabase URL: %s", config.supabase_url)
        logger.info("   Default language: %s", config.default_language)

    # Build application
    app = ApplicationBuilder().token(config.bot_token).build()

    app.add_handler(CommandHandler("start", start_handler))
    app.add_handler(CommandHandler("search", search_handler))
    app.add_handler(CommandHandler("daily", daily_handler))
    app.add_handler(CommandHandler("quiz", quiz_handler))
    app.add_handler(CommandHandler("lang", lang_handler))
    app.add_handler(CommandHandler("stats", stats_handler))
    app.add_handler(CommandHandler("help", help_handler))
    app.add_handler(CommandHandler("report", report_handler))
    app.add_handler(CommandHandler("link", link_handler))
    app.add_handler(CommandHandler("bagla", link_handler))

    # ── Register callback query handler ──
    app.add_handler(CallbackQueryHandler(callback_handler))

    # ── Register text message handler (search by text) ──
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, text_handler))

    # ── Start Server ──
    if is_production:
        # We enforce polling in production to allow Flask to bind to PORT and keep the bot awake on free tier
        logger.info("✅ Bot is now running (Polling Mode on Render).")
        
        try:
            asyncio.get_event_loop()
        except RuntimeError:
            asyncio.set_event_loop(asyncio.new_event_loop())

        app.run_polling(
            drop_pending_updates=True,
            allowed_updates=["message", "callback_query"],
        )
    else:
        logger.info("✅ Bot is now running (Polling). Press Ctrl+C to stop.")

        try:
            asyncio.get_event_loop()
        except RuntimeError:
            asyncio.set_event_loop(asyncio.new_event_loop())

        app.run_polling(
            drop_pending_updates=True,
            allowed_updates=["message", "callback_query"],
        )



if __name__ == "__main__":
    main()
