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

import sentry_sdk
from sentry_sdk.integrations.flask import FlaskIntegration
from sentry_sdk.integrations.logging import LoggingIntegration
from telegram.ext import (
    ApplicationBuilder,
    CommandHandler,
    CallbackQueryHandler,
    MessageHandler,
    filters,
    Application,
)
from telegram import BotCommand, BotCommandScopeDefault
from bot.runtime_state import (
    configure_runtime_state,
    mark_bot_not_ready,
    mark_bot_ready,
    record_bot_heartbeat,
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


def configure_sentry() -> None:
    """Initialize bot-side error capture when BOT_SENTRY_DSN is configured."""
    from bot.config import config

    if not config.sentry_dsn:
        return

    sentry_sdk.init(
        dsn=config.sentry_dsn,
        integrations=[
            FlaskIntegration(),
            LoggingIntegration(
                level=logging.INFO,
                event_level=logging.ERROR,
            ),
        ],
        send_default_pii=False,
        environment=os.environ.get("SENTRY_ENVIRONMENT", os.environ.get("NODE_ENV", "production")),
    )


async def post_init(application: Application) -> None:
    """Sync bot commands to Telegram Servers dynamically per language."""
    commands_en = [
        BotCommand("start", "Main menu"),
        BotCommand("menu", "Menu"),
        BotCommand("search", "Search a term"),
        BotCommand("daily", "Term of the day"),
        BotCommand("quiz", "Quick quiz"),
        BotCommand("lang", "Change language"),
        BotCommand("stats", "Statistics"),
        BotCommand("help", "Help")
    ]
    commands_ru = [
        BotCommand("start", "Главное меню"),
        BotCommand("menu", "Меню"),
        BotCommand("search", "Поиск термина"),
        BotCommand("daily", "Термин дня"),
        BotCommand("quiz", "Быстрый тест"),
        BotCommand("lang", "Сменить язык"),
        BotCommand("stats", "Статистика"),
        BotCommand("help", "Помощь")
    ]
    commands_tr = [
        BotCommand("start", "Ana menü"),
        BotCommand("menu", "Menü"),
        BotCommand("search", "Terim ara"),
        BotCommand("daily", "Günün terimi"),
        BotCommand("quiz", "Hızlı test"),
        BotCommand("lang", "Dil değiştir"),
        BotCommand("stats", "İstatistikler"),
        BotCommand("help", "Yardım")
    ]
    
    await application.bot.set_my_commands(commands_en, scope=BotCommandScopeDefault())
    await application.bot.set_my_commands(commands_ru, scope=BotCommandScopeDefault(), language_code="ru")
    await application.bot.set_my_commands(commands_tr, scope=BotCommandScopeDefault(), language_code="tr")
    record_bot_heartbeat()
    mark_bot_ready()


async def heartbeat_job(_context: object) -> None:
    """Emit a lightweight heartbeat so the readiness endpoint reflects bot liveness."""
    record_bot_heartbeat()


def main() -> None:
    """Build and run the Telegram bot application."""

    # Validate configuration
    try:
        from bot.config import config
        from bot.handlers import (
            start_handler,
            menu_handler,
            search_handler,
            daily_handler,
            quiz_handler,
            lang_handler,
            stats_handler,
            help_handler,
            callback_handler,
            text_handler,
        )

        config.validate()
        configure_sentry()
        configure_runtime_state(
            sentry_enabled=bool(config.sentry_dsn),
            redis_rate_limit_enabled=bool(config.redis_url),
        )
        mark_bot_not_ready()
    except EnvironmentError as e:
        logger.critical("Configuration error: %s", e)
        sys.exit(1)

    # Detect Render production environment
    is_production = bool(os.environ.get("RENDER"))
    should_start_healthcheck = bool(os.environ.get("PORT"))

    if is_production:
        logger.info("🚀 PRODUCTION MODE — Render detected")
        logger.info("   Supabase URL: %s", config.supabase_url)
        if not config.sentry_dsn:
            logger.critical("Configuration error: BOT_SENTRY_DSN is required in production.")
            sys.exit(1)
    else:
        logger.info("📡 LOCAL MODE — Development")
        logger.info("   Supabase URL: %s", config.supabase_url)
        logger.info("   Default language: %s", config.default_language)

    if should_start_healthcheck:
        logger.info("   Starting keep_alive health check server…")
        from bot.keep_alive import keep_alive
        keep_alive()

    # Build application
    app = ApplicationBuilder().token(config.bot_token).post_init(post_init).build()
    if app.job_queue is not None:
        app.job_queue.run_repeating(heartbeat_job, interval=30, first=0)

    app.add_handler(CommandHandler("start", start_handler))
    app.add_handler(CommandHandler("menu", menu_handler))
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

    # ── Start Server ──
    if is_production:
        # We enforce polling in production to allow Flask to bind to PORT and keep the bot awake on free tier
        logger.info("✅ Bot is now running (Polling Mode on Render).")
        
        try:
            asyncio.get_event_loop()
        except RuntimeError:
            asyncio.set_event_loop(asyncio.new_event_loop())

        try:
            app.run_polling(
                drop_pending_updates=True,
                allowed_updates=["message", "callback_query"],
            )
        finally:
            mark_bot_not_ready()
    else:
        logger.info("✅ Bot is now running (Polling). Press Ctrl+C to stop.")

        try:
            asyncio.get_event_loop()
        except RuntimeError:
            asyncio.set_event_loop(asyncio.new_event_loop())

        try:
            app.run_polling(
                drop_pending_updates=True,
                allowed_updates=["message", "callback_query"],
            )
        finally:
            mark_bot_not_ready()



if __name__ == "__main__":
    main()
