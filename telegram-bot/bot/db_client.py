"""
FinTechTerms Bot — Supabase client helpers.
"""

from __future__ import annotations

from typing import Any, Optional

from supabase import create_client, Client

from bot.config import config

_public_client: Optional[Client] = None
ACADEMIC_QUARANTINE_FILTER = "is_academic.is.null,is_academic.neq.false"


def get_public_client() -> Client:
    """Lazy-initialise the bot's public Supabase client with the required anon key."""
    global _public_client
    if _public_client is None:
        _public_client = create_client(config.supabase_url, config.supabase_anon_key)
    return _public_client


def get_client() -> Client:
    """Backward-compatible alias for term lookup call sites."""
    return get_public_client()


def apply_academic_quarantine(query_builder: Any) -> Any:
    """
    Mirror the web filter in lib/academicQuarantine.ts:
    only rows with is_academic explicitly set to false are hidden.
    """
    return query_builder.or_(ACADEMIC_QUARANTINE_FILTER)
