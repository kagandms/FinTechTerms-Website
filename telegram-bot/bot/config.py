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


@dataclass(frozen=True)
class Config:
    """Immutable bot configuration loaded from environment."""

    # Telegram
    bot_token: str = field(default_factory=lambda: os.getenv("BOT_TOKEN", ""))

    # Supabase (same DB as the web app)
    supabase_url: str = field(
        default_factory=lambda: os.getenv(
            "SUPABASE_URL", "https://hdhytostmmrvwuluogpq.supabase.co"
        )
    )
    supabase_key: str = field(
        default_factory=lambda: os.getenv("SUPABASE_KEY", "")
    )
    supabase_service_role_key: str = field(
        default_factory=lambda: os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
    )

    # Redis (Rate Limiting)
    redis_url: str = field(
        default_factory=lambda: os.getenv("REDIS_URL", "")
    )

    # Admin
    admin_user_id: int = field(
        default_factory=lambda: int(os.getenv("ADMIN_USER_ID", "0"))
    )

    # Defaults
    default_language: str = field(
        default_factory=lambda: os.getenv("DEFAULT_LANGUAGE", "ru")
    )
    daily_term_hour: int = field(
        default_factory=lambda: int(os.getenv("DAILY_TERM_HOUR", "9"))
    )

    # Paths
    audio_cache_dir: Path = field(
        default_factory=lambda: Path(__file__).resolve().parent.parent / "audio_cache"
    )

    def validate(self) -> None:
        """Raise ValueError if critical config is missing."""
        if not self.bot_token:
            raise ValueError("BOT_TOKEN is required. Get one from @BotFather.")
        if not self.supabase_service_role_key:
            raise ValueError("SUPABASE_SERVICE_ROLE_KEY is required for secure bot sync and unified writes.")


# Singleton instance
config = Config()

# ── Constants ──────────────────────────────────────────────
SUPPORTED_LANGUAGES = ("ru", "en", "tr")

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

WEB_APP_URL = "https://fintechterms.com"
