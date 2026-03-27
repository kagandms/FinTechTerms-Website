"""
FinTechTerms Bot — Configuration Module
Loads environment variables and defines bot-wide constants.
"""

import os
from dataclasses import dataclass, field
from pathlib import Path

from dotenv import load_dotenv

# Load .env from the telegram-bot directory
_env_path = Path(__file__).resolve().parent.parent / ".env"
load_dotenv(_env_path)

SUPPORTED_LANGUAGES = ("ru", "en", "tr")


def _require_env(name: str, description: str) -> str:
    value = os.environ.get(name, "").strip()
    if value:
        return value

    raise EnvironmentError(
        f"Missing required environment variable {name}: {description}."
    )


def _get_int_env(name: str, default: int) -> int:
    raw_value = os.environ.get(name)
    if raw_value is None or not raw_value.strip():
        return default

    try:
        return int(raw_value)
    except ValueError as exc:
        raise EnvironmentError(
            f"Invalid environment variable {name}: expected an integer, got {raw_value!r}."
        ) from exc


@dataclass(frozen=True)
class Config:
    """Immutable bot configuration loaded from environment."""

    # Telegram
    bot_token: str = field(
        default_factory=lambda: _require_env(
            "BOT_TOKEN", "set the Telegram bot token from @BotFather"
        )
    )

    # Supabase (same DB as the web app)
    supabase_url: str = field(
        default_factory=lambda: _require_env(
            "SUPABASE_URL", "set the Supabase project URL for the shared FinTechTerms database"
        )
    )
    supabase_anon_key: str = field(
        default_factory=lambda: _require_env(
            "SUPABASE_ANON_KEY", "set the Supabase anon key used for bot term lookups"
        )
    )
    # Web app deep links shown in bot messages
    web_app_url: str = field(
        default_factory=lambda: _require_env(
            "WEB_APP_URL", "set the public FinTechTerms web app URL used for bot deep links"
        )
    )

    # Redis (Rate Limiting)
    redis_url: str = field(
        default_factory=lambda: os.environ.get("REDIS_URL", "").strip()
    )

    sentry_dsn: str = field(
        default_factory=lambda: os.environ.get("BOT_SENTRY_DSN", "").strip()
    )

    # Admin
    admin_user_id: int = field(
        default_factory=lambda: _get_int_env("ADMIN_USER_ID", 0)
    )

    # Defaults
    default_language: str = field(
        default_factory=lambda: os.environ.get("DEFAULT_LANGUAGE", "ru").strip() or "ru"
    )
    daily_term_hour: int = field(
        default_factory=lambda: _get_int_env("DAILY_TERM_HOUR", 9)
    )

    # Paths
    audio_cache_dir: Path = field(
        default_factory=lambda: Path(__file__).resolve().parent.parent / "audio_cache"
    )

    def validate(self) -> None:
        """Raise EnvironmentError if config values are invalid."""
        if self.default_language not in SUPPORTED_LANGUAGES:
            raise EnvironmentError(
                f"Invalid DEFAULT_LANGUAGE {self.default_language!r}. Expected one of {SUPPORTED_LANGUAGES}."
            )
        if not 0 <= self.daily_term_hour <= 23:
            raise EnvironmentError(
                f"Invalid DAILY_TERM_HOUR {self.daily_term_hour}. Expected a value from 0 to 23."
            )


# Singleton instance
config = Config()

# ── Constants ──────────────────────────────────────────────
CATEGORY_EMOJI = {
    "Fintech": "💳",
    "Finance": "💰",
    "Technology": "💻",
}

SRS_LEVEL_LABELS = {
    "ru": ["Новое", "Изучение", "Развитие", "Повторение", "Освоено"],
    "en": ["New", "Learning", "Developing", "Reviewing", "Mastered"],
    "tr": ["Yeni", "Öğrenme", "Geliştirme", "Pekiştirme", "Ustalaşmış"],
}

WEB_APP_URL = config.web_app_url
