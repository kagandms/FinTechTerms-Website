"""
FinTechTerms Bot — Database Layer
Connects to the same Supabase instance as the web app for full data sync.
"""

from __future__ import annotations

import logging
import random
from typing import Any, Optional

from supabase import create_client, Client

from bot.config import config

logger = logging.getLogger(__name__)

# ── Supabase Client ────────────────────────────────────────
_client: Optional[Client] = None


def get_client() -> Client:
    """Lazy-initialise and return the Supabase client."""
    global _client
    if _client is None:
        _client = create_client(config.supabase_url, config.supabase_key)
    return _client


# ── Term Queries ───────────────────────────────────────────
async def fetch_all_terms() -> list[dict[str, Any]]:
    """Fetch all terms from the Supabase `terms` table."""
    try:
        response = get_client().table("terms").select("*").execute()
        return response.data or []
    except Exception as e:
        logger.error("Failed to fetch terms: %s", e)
        return []


async def fetch_term_by_id(term_id: str) -> Optional[dict[str, Any]]:
    """Fetch a single term by its ID."""
    try:
        response = (
            get_client()
            .table("terms")
            .select("*")
            .eq("id", term_id)
            .limit(1)
            .execute()
        )
        data = response.data
        return data[0] if data else None
    except Exception as e:
        logger.error("Failed to fetch term %s: %s", term_id, e)
        return None


async def search_terms(query: str, limit: int = 10) -> list[dict[str, Any]]:
    """
    Search terms across all three languages.
    Uses Supabase `ilike` for flexible matching.
    """
    try:
        q = f"%{query}%"
        response = (
            get_client()
            .table("terms")
            .select("*")
            .or_(
                f"term_en.ilike.{q},"
                f"term_ru.ilike.{q},"
                f"term_tr.ilike.{q},"
                f"definition_en.ilike.{q},"
                f"definition_ru.ilike.{q},"
                f"definition_tr.ilike.{q}"
            )
            .limit(limit)
            .execute()
        )
        return response.data or []
    except Exception as e:
        logger.error("Search failed for '%s': %s", query, e)
        return []


async def get_random_term() -> Optional[dict[str, Any]]:
    """Return a random term for the Daily Term feature."""
    try:
        response = get_client().table("terms").select("id").execute()
        ids = [row["id"] for row in (response.data or [])]
        if not ids:
            return None
        chosen_id = random.choice(ids)
        return await fetch_term_by_id(chosen_id)
    except Exception as e:
        logger.error("Failed to get random term: %s", e)
        return None


async def get_terms_by_category(category: str) -> list[dict[str, Any]]:
    """Fetch terms filtered by category (Fintech / Finance / Technology)."""
    try:
        response = (
            get_client()
            .table("terms")
            .select("*")
            .eq("category", category)
            .execute()
        )
        return response.data or []
    except Exception as e:
        logger.error("Failed to fetch terms for category %s: %s", category, e)
        return []


# ── User Preferences ──────────────────────────────────────
_user_prefs: dict[int, dict[str, Any]] = {}


def get_user_language(user_id: int) -> str:
    """Get the user's preferred language (in-memory cache)."""
    return _user_prefs.get(user_id, {}).get("language", config.default_language)


def set_user_language(user_id: int, language: str) -> None:
    """Set the user's preferred language."""
    if user_id not in _user_prefs:
        _user_prefs[user_id] = {}
    _user_prefs[user_id]["language"] = language


# ── Stats ──────────────────────────────────────────────────
async def get_term_count() -> int:
    """Return total number of terms in the database."""
    try:
        response = (
            get_client()
            .table("terms")
            .select("id", count="exact")
            .execute()
        )
        return response.count or 0
    except Exception as e:
        logger.error("Failed to get term count: %s", e)
        return 0


async def get_category_counts() -> dict[str, int]:
    """Return term counts per category."""
    try:
        response = get_client().table("terms").select("category").execute()
        counts: dict[str, int] = {}
        for row in response.data or []:
            cat = row.get("category", "Unknown")
            counts[cat] = counts.get(cat, 0) + 1
        return counts
    except Exception as e:
        logger.error("Failed to get category counts: %s", e)
        return {}
