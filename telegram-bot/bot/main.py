"""
FinTechTerms Telegram Bot — Main Entry Point
Connects all modules and starts the bot with polling.

Usage:
    python -m bot.main
"""

from __future__ import annotations

import logging
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

    logger.info("Starting FinTechTerms Bot…")
    logger.info("  Supabase URL: %s", config.supabase_url)
    logger.info("  Default language: %s", config.default_language)

    # Build application
    app = ApplicationBuilder().token(config.bot_token).build()

    # ── Register command handlers ──
    app.add_handler(CommandHandler("start", start_handler))
    app.add_handler(CommandHandler("search", search_handler))
    app.add_handler(CommandHandler("daily", daily_handler))
    app.add_handler(CommandHandler("quiz", quiz_handler))
    app.add_handler(CommandHandler("lang", lang_handler))
    app.add_handler(CommandHandler("stats", stats_handler))
    app.add_handler(CommandHandler("help", help_handler))

    # ── Register callback query handler ──
    app.add_handler(CallbackQueryHandler(callback_handler))

    # ── Register text message handler (search by text) ──
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, text_handler))

    # ── Start polling ──
    logger.info("Bot is now running. Press Ctrl+C to stop.")
    app.run_polling(
        drop_pending_updates=True,
        allowed_updates=["message", "callback_query"],
    )


if __name__ == "__main__":
    main()
