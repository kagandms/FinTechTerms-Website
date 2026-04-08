"""Shared pytest bootstrap for Telegram bot tests."""

from __future__ import annotations

import os
import sys
from pathlib import Path

import pytest

BOT_ROOT = Path(__file__).resolve().parents[1]

if str(BOT_ROOT) not in sys.path:
    sys.path.insert(0, str(BOT_ROOT))

os.environ.setdefault("BOT_TOKEN", "test-bot-token")
os.environ.setdefault("SUPABASE_URL", "https://example.supabase.co")
os.environ.setdefault("SUPABASE_ANON_KEY", "test-supabase-key")
os.environ.setdefault("WEB_APP_URL", "https://fintechterms.example.com")


@pytest.fixture
def anyio_backend() -> str:
    """Pin async Telegram bot tests to asyncio via pytest-anyio."""
    return "asyncio"
