"""
FinTechTerms Bot — Database Layer
Connects to the same Supabase instance as the web app for full data sync.
Activity tracking persisted to Supabase `bot_user_stats` table.
"""

from __future__ import annotations

import logging
import random
from datetime import datetime, timezone
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


# ══════════════════════════════════════════════════════════
#  USER PREFERENCES & ACTIVITY — Supabase-persisted
# ══════════════════════════════════════════════════════════

# In-memory cache to avoid hitting DB on every call
_user_cache: dict[int, dict[str, Any]] = {}

_STATS_TABLE = "bot_user_stats"


def _get_cached(user_id: int) -> dict[str, Any]:
    """Return cached user data, loading from Supabase if needed."""
    if user_id not in _user_cache:
        try:
            resp = (
                get_client()
                .table(_STATS_TABLE)
                .select("*")
                .eq("telegram_id", user_id)
                .limit(1)
                .execute()
            )
            if resp.data:
                _user_cache[user_id] = resp.data[0]
            else:
                # New user — create row
                new_row = {
                    "telegram_id": user_id,
                    "language": config.default_language,
                    "searches": 0,
                    "quizzes_taken": 0,
                    "quizzes_correct": 0,
                    "terms_viewed": 0,
                    "daily_used": 0,
                    "tts_used": 0,
                    "categories_explored": [],
                }
                get_client().table(_STATS_TABLE).insert(new_row).execute()
                _user_cache[user_id] = new_row
        except Exception as e:
            logger.warning("DB read failed for user %s, using defaults: %s", user_id, e)
            _user_cache[user_id] = {
                "language": config.default_language,
                "searches": 0,
                "quizzes_taken": 0,
                "quizzes_correct": 0,
                "terms_viewed": 0,
                "daily_used": 0,
                "tts_used": 0,
                "categories_explored": [],
            }
    return _user_cache[user_id]


def _persist(user_id: int) -> None:
    """Write cached user data back to Supabase (fire-and-forget)."""
    data = _user_cache.get(user_id)
    if not data:
        return
    try:
        update = {
            "language": data.get("language", config.default_language),
            "searches": data.get("searches", 0),
            "quizzes_taken": data.get("quizzes_taken", 0),
            "quizzes_correct": data.get("quizzes_correct", 0),
            "terms_viewed": data.get("terms_viewed", 0),
            "daily_used": data.get("daily_used", 0),
            "tts_used": data.get("tts_used", 0),
            "categories_explored": list(data.get("categories_explored", [])),
            "last_active": datetime.now(timezone.utc).isoformat(),
        }
        get_client().table(_STATS_TABLE).update(update).eq("telegram_id", user_id).execute()
    except Exception as e:
        logger.warning("DB write failed for user %s: %s", user_id, e)


# ── Language ──────────────────────────────────────────────
def get_user_language(user_id: int) -> str:
    """Get the user's preferred language (cached + Supabase-backed)."""
    return _get_cached(user_id).get("language", config.default_language)


def set_user_language(user_id: int, language: str) -> None:
    """Set the user's preferred language and persist."""
    data = _get_cached(user_id)
    data["language"] = language
    _persist(user_id)


# ── Activity Tracking ────────────────────────────────────
def track_activity(user_id: int, action: str, **kwargs: Any) -> None:
    """Track a user action and persist to Supabase."""
    data = _get_cached(user_id)

    if action == "search":
        data["searches"] = data.get("searches", 0) + 1
    elif action == "quiz_taken":
        data["quizzes_taken"] = data.get("quizzes_taken", 0) + 1
        if kwargs.get("correct"):
            data["quizzes_correct"] = data.get("quizzes_correct", 0) + 1
    elif action == "term_viewed":
        data["terms_viewed"] = data.get("terms_viewed", 0) + 1
        cat = kwargs.get("category")
        if cat:
            cats = data.get("categories_explored", [])
            if isinstance(cats, set):
                cats = list(cats)
            if cat not in cats:
                cats.append(cat)
                data["categories_explored"] = cats
    elif action == "daily":
        data["daily_used"] = data.get("daily_used", 0) + 1
    elif action == "tts":
        data["tts_used"] = data.get("tts_used", 0) + 1

    _persist(user_id)


def get_user_report(user_id: int) -> dict[str, Any]:
    """Get user activity summary for the report."""
    data = _get_cached(user_id)
    quizzes = data.get("quizzes_taken", 0)
    correct = data.get("quizzes_correct", 0)
    accuracy = round((correct / quizzes) * 100) if quizzes > 0 else 0

    cats = data.get("categories_explored", [])
    if isinstance(cats, set):
        cats = list(cats)

    return {
        "searches": data.get("searches", 0),
        "quizzes_taken": quizzes,
        "quizzes_correct": correct,
        "accuracy": accuracy,
        "terms_viewed": data.get("terms_viewed", 0),
        "daily_used": data.get("daily_used", 0),
        "tts_used": data.get("tts_used", 0),
        "categories_explored": len(cats),
        "session_start": data.get("first_seen", ""),
    }


def save_username(user_id: int, username: str | None) -> None:
    """Save Telegram username for admin visibility."""
    if not username:
        return
    data = _get_cached(user_id)
    data["username"] = username
    try:
        get_client().table(_STATS_TABLE).update(
            {"username": username}
        ).eq("telegram_id", user_id).execute()
    except Exception:
        pass


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


async def get_bot_user_count() -> int:
    """Return total number of bot users."""
    try:
        response = (
            get_client()
            .table(_STATS_TABLE)
            .select("telegram_id", count="exact")
            .execute()
        )
        return response.count or 0
    except Exception as e:
        logger.error("Failed to get bot user count: %s", e)
        return 0
