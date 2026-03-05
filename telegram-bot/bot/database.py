"""
FinTechTerms Bot — Database Layer
Connects to the same Supabase instance as the web app for full data sync.
All database operations are moved to a thread pool to avoid blocking the asyncio event loop.
"""

from __future__ import annotations

import asyncio
import logging
import random
from typing import Any, Optional

from supabase import create_client, Client

from bot.config import config, SUPPORTED_LANGUAGES

logger = logging.getLogger(__name__)

# ── Supabase Client ────────────────────────────────────────
_client: Optional[Client] = None


def _normalize_language(language: Any) -> str:
    if isinstance(language, str) and language in SUPPORTED_LANGUAGES:
        return language

    if config.default_language in SUPPORTED_LANGUAGES:
        return config.default_language

    return "ru"

def get_client() -> Client:
    """Lazy-initialise and return the Supabase client."""
    global _client
    if _client is None:
        _client = create_client(config.supabase_url, config.supabase_key)
    return _client

# ── Term Queries ───────────────────────────────────────────
async def fetch_all_terms() -> list[dict[str, Any]]:
    """Fetch all terms from the Supabase `terms` table."""
    def _fetch():
        return get_client().table("terms").select("*").execute()
    try:
        response = await asyncio.to_thread(_fetch)
        return response.data or []
    except Exception as e:
        logger.error("Failed to fetch all terms (Database Unreachable): %s", e)
        raise ConnectionError("VERİTABANI_BAĞLANTISI_YOK")

async def fetch_term_by_id(term_id: str) -> Optional[dict[str, Any]]:
    """Fetch a single term by its ID."""
    def _fetch():
        return get_client().table("terms").select("*").eq("id", term_id).limit(1).execute()
    try:
        response = await asyncio.to_thread(_fetch)
        data = response.data
        return data[0] if data else None
    except Exception as e:
        logger.error("Failed to fetch term %s (Database Unreachable): %s", term_id, e)
        raise ConnectionError("VERİTABANI_BAĞLANTISI_YOK")

async def search_terms(query: str, limit: int = 10) -> list[dict[str, Any]]:
    """
    Search terms across all three languages using Trigram (pg_trgm) fuzzy search RPC.
    Complexity: O(log N) due to GIN Indexes in DB.
    """
    def _search():
        return get_client().rpc("search_terms_trigram", {"search_query": query, "max_limit": limit}).execute()
    try:
        response = await asyncio.to_thread(_search)
        return response.data or []
    except Exception as e:
        logger.error("Search failed for '%s' (Database Unreachable): %s", query, e)
        raise ConnectionError("VERİTABANI_BAĞLANTISI_YOK")

async def get_random_term() -> Optional[dict[str, Any]]:
    """Return a random term for the Daily Term feature."""
    def _get():
        return get_client().table("terms").select("id").execute()
    try:
        response = await asyncio.to_thread(_get)
        ids = [row["id"] for row in (response.data or [])]
        if not ids:
            return None
        chosen_id = random.choice(ids)
        return await fetch_term_by_id(chosen_id)
    except Exception as e:
        logger.error("Failed to get random term (Database Unreachable): %s", e)
        raise ConnectionError("VERİTABANI_BAĞLANTISI_YOK")

async def get_terms_by_category(category: str) -> list[dict[str, Any]]:
    """Fetch terms filtered by category (Fintech / Finance / Technology)."""
    def _fetch():
        return get_client().table("terms").select("*").eq("category", category).execute()
    try:
        response = await asyncio.to_thread(_fetch)
        return response.data or []
    except Exception as e:
        logger.error("Failed to fetch terms for category %s: %s", category, e)
        return []

# ══════════════════════════════════════════════════════════
#  USER PREFERENCES & ACTIVITY — Asynchronous & DB-Backed
# ══════════════════════════════════════════════════════════

async def sync_user(telegram_id: int, username: str | None = None) -> dict[str, Any]:
    """Ensures Telegram user is synced via RPC. Returns dict with user_id and language."""
    def _sync():
        return get_client().rpc("sync_telegram_user", {
            "p_telegram_id": telegram_id,
            "p_username": username,
            "p_default_language": config.default_language
        }).execute()
        
    try:
        response = await asyncio.to_thread(_sync)
        if response.data:
            return dict(response.data)
    except Exception as e:
        logger.error("Failed to sync user %s: %s", telegram_id, e)
        
    return {"user_id": None, "language": config.default_language}

async def get_user_language(telegram_id: int) -> str:
    """Get the user's preferred language."""
    data = await sync_user(telegram_id)
    return data.get("language", config.default_language)

async def set_user_language(telegram_id: int, language: str) -> None:
    """Set the user's preferred language and persist."""
    def _set():
        # First ensure they exist and get UUID
        rpc = get_client().rpc("sync_telegram_user", {
            "p_telegram_id": telegram_id,
            "p_default_language": config.default_language
        }).execute()
        
        if rpc.data and rpc.data.get("user_id"):
            get_client().table("user_settings").update(
                {"preferred_language": language}
            ).eq("user_id", rpc.data["user_id"]).execute()
            
    try:
        await asyncio.to_thread(_set)
    except Exception as e:
        logger.error("Failed to set language for %s: %s", telegram_id, e)

async def track_activity(telegram_id: int, action: str, **kwargs: Any) -> None:
    """Track a user action and persist to Supabase."""
    data = await sync_user(telegram_id)
    user_id = data.get("user_id")
    if not user_id:
        return

    def _track():
        if action == "quiz_taken":
            is_correct = kwargs.get("correct", False)
            get_client().table("quiz_attempts").insert({
                "user_id": user_id,
                "term_id": kwargs.get("term_id", ""),
                "is_correct": is_correct,
                "quiz_type": "telegram_bot"
            }).execute()
            
            get_client().rpc("log_daily_learning", {
                "p_user_id": user_id,
                "p_words_reviewed": 1,
                "p_words_correct": 1 if is_correct else 0,
                "p_words_incorrect": 0 if is_correct else 1,
                "p_new_words_learned": 0
            }).execute()
            
        elif action == "term_viewed":
            get_client().rpc("log_daily_learning", {
                "p_user_id": user_id,
                "p_words_reviewed": 1,
                "p_words_correct": 0,
                "p_words_incorrect": 0,
                "p_new_words_learned": 1
            }).execute()
            
    try:
        await asyncio.to_thread(_track)
    except Exception as e:
        logger.error("Failed to track %s for %s: %s", action, telegram_id, e)

async def save_username(telegram_id: int, username: str | None) -> None:
    """Save Telegram username for admin visibility."""
    if username:
        await sync_user(telegram_id, username)


async def get_linked_profile_context(telegram_id: int, username: str | None = None) -> dict[str, Any]:
    """
    Resolve Telegram -> Web profile linkage using the single source of truth.
    Linked state requires BOTH telegram_users.user_id and profiles.id match.
    """

    def _resolve() -> dict[str, Any]:
        client = get_client()

        mapping_res = (
            client.table("telegram_users")
            .select("user_id, telegram_username")
            .eq("telegram_id", telegram_id)
            .limit(1)
            .execute()
        )
        mapping_rows = mapping_res.data or []
        if not mapping_rows:
            return {
                "is_linked": False,
                "user_id": None,
                "full_name": None,
                "language": _normalize_language(config.default_language),
            }

        mapping = mapping_rows[0]
        user_id = mapping.get("user_id")
        if not user_id:
            return {
                "is_linked": False,
                "user_id": None,
                "full_name": None,
                "language": _normalize_language(config.default_language),
            }

        if username and username != mapping.get("telegram_username"):
            (
                client.table("telegram_users")
                .update({"telegram_username": username})
                .eq("telegram_id", telegram_id)
                .execute()
            )

        settings_res = (
            client.table("user_settings")
            .select("preferred_language")
            .eq("user_id", user_id)
            .limit(1)
            .execute()
        )
        settings_rows = settings_res.data or []
        preferred_language = (
            settings_rows[0].get("preferred_language")
            if settings_rows
            else config.default_language
        )
        language = _normalize_language(preferred_language)

        profile_res = (
            client.table("profiles")
            .select("full_name")
            .eq("id", user_id)
            .limit(1)
            .execute()
        )
        profile_rows = profile_res.data or []
        if not profile_rows:
            return {
                "is_linked": False,
                "user_id": None,
                "full_name": None,
                "language": language,
            }

        full_name = (profile_rows[0].get("full_name") or "").strip() or None
        return {
            "is_linked": True,
            "user_id": user_id,
            "full_name": full_name,
            "language": language,
        }

    try:
        return await asyncio.to_thread(_resolve)
    except Exception as e:
        logger.exception("Failed to resolve linked profile for %s: %s", telegram_id, e)
        raise ConnectionError("VERITABANI_BAGLANTI_HATASI")

async def generate_link_token(telegram_id: int) -> str | None:
    """Generate a 6-digit OTP for linking the Telegram bot account to a Web account."""
    def _generate():
        return get_client().rpc("generate_telegram_link_token", {
            "p_telegram_id": telegram_id
        }).execute()
        
    try:
        response = await asyncio.to_thread(_generate)
        return response.data if response.data else None
    except Exception as e:
        logger.error("Failed to generate link token for %s: %s", telegram_id, e)
        return None

async def get_user_report(telegram_id: int) -> dict[str, Any]:
    """Get user activity summary for the report."""
    data = await sync_user(telegram_id)
    user_id = data.get("user_id")
    if not user_id:
        return {}

    def _report():
        attempts_res = get_client().table("quiz_attempts").select("is_correct").eq("user_id", user_id).execute()
        attempts = attempts_res.data or []
        tot_quiz = len(attempts)
        tot_correct = sum(1 for a in attempts if a.get("is_correct"))
        accuracy = round((tot_correct / tot_quiz) * 100) if tot_quiz > 0 else 0
        
        daily_logs = get_client().table("daily_learning_log").select("words_reviewed", "new_words_learned").eq("user_id", user_id).execute()
        words_reviewed = sum(row.get("words_reviewed", 0) for row in daily_logs.data or [])
        new_words = sum(row.get("new_words_learned", 0) for row in daily_logs.data or [])
        
        return {
            "searches": 0,
            "quizzes_taken": tot_quiz,
            "quizzes_correct": tot_correct,
            "accuracy": accuracy,
            "terms_viewed": words_reviewed,
            "daily_used": 0,
            "tts_used": 0,
            "categories_explored": 0,
            "session_start": "",
        }
    try:
        return await asyncio.to_thread(_report)
    except Exception as e:
        logger.error("Failed to get report for %s: %s", telegram_id, e)
        return {}

# ── Stats ──────────────────────────────────────────────────
async def get_term_count() -> int:
    """Return total number of terms in the database."""
    def _count():
        return get_client().table("terms").select("id", count="exact").execute()
    try:
        response = await asyncio.to_thread(_count)
        return response.count or 0
    except Exception as e:
        logger.error("Failed to get term count: %s", e)
        return 0

async def get_category_counts() -> dict[str, int]:
    """Return term counts per category."""
    def _counts():
        return get_client().table("terms").select("category").execute()
    try:
        response = await asyncio.to_thread(_counts)
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
    def _count():
        return get_client().table("telegram_users").select("telegram_id", count="exact").execute()
    try:
        response = await asyncio.to_thread(_count)
        return response.count or 0
    except Exception as e:
        logger.error("Failed to get bot user count: %s", e)
        return 0


async def get_user_favorites(telegram_id: int) -> list[dict[str, Any]]:
    """
    Fetch the linked user's favorite terms from the `favorites` table in realtime.
    """
    linked = await get_linked_profile_context(telegram_id)
    user_id = linked.get("user_id")
    if not linked.get("is_linked") or not user_id:
        return []

    return await get_favorites_by_user_id(str(user_id))


async def get_favorites_by_user_id(user_id: str, limit: int = 25) -> list[dict[str, Any]]:
    """Fetch favorites directly from `favorites` and hydrate term payload from `terms`."""

    def _fetch_favorites() -> list[dict[str, Any]]:
        client = get_client()
        favorites_res = (
            client.table("favorites")
            .select("term_id, created_at")
            .eq("user_id", user_id)
            .order("created_at", desc=True)
            .limit(limit)
            .execute()
        )
        favorite_rows = favorites_res.data or []
        if not favorite_rows:
            return []

        term_ids: list[str] = [
            row["term_id"]
            for row in favorite_rows
            if isinstance(row.get("term_id"), str) and row["term_id"]
        ]
        if not term_ids:
            return []

        terms_res = (
            client.table("terms")
            .select("id, term_ru, term_en, term_tr, category")
            .in_("id", term_ids)
            .execute()
        )
        terms_by_id = {
            row.get("id"): row
            for row in (terms_res.data or [])
            if isinstance(row.get("id"), str)
        }

        ordered_terms: list[dict[str, Any]] = []
        for favorite_row in favorite_rows:
            term = terms_by_id.get(favorite_row.get("term_id"))
            if term:
                ordered_terms.append(term)
        return ordered_terms

    try:
        return await asyncio.to_thread(_fetch_favorites)
    except Exception as e:
        logger.exception("Failed to fetch favorites for user_id %s: %s", user_id, e)
        raise


async def get_activity_stats_by_user_id(user_id: str) -> dict[str, Any]:
    """Fetch user activity stats for the Telegram account dashboard."""

    def _fetch_stats() -> dict[str, Any]:
        client = get_client()

        attempts_res = (
            client.table("quiz_attempts")
            .select("is_correct")
            .eq("user_id", user_id)
            .execute()
        )
        attempts = attempts_res.data or []
        quizzes_taken = len(attempts)
        quizzes_correct = sum(1 for row in attempts if row.get("is_correct"))
        accuracy = round((quizzes_correct / quizzes_taken) * 100) if quizzes_taken else 0

        learning_res = (
            client.table("daily_learning_log")
            .select("log_date, words_reviewed, new_words_learned")
            .eq("user_id", user_id)
            .execute()
        )
        learning_rows = learning_res.data or []
        words_reviewed = sum(int(row.get("words_reviewed") or 0) for row in learning_rows)
        words_added = sum(int(row.get("new_words_learned") or 0) for row in learning_rows)
        active_days = len({row.get("log_date") for row in learning_rows if row.get("log_date")})

        favorites_res = (
            client.table("favorites")
            .select("term_id", count="exact")
            .eq("user_id", user_id)
            .execute()
        )
        favorites_count = int(favorites_res.count or 0)

        return {
            "quizzes_taken": quizzes_taken,
            "quizzes_correct": quizzes_correct,
            "accuracy": accuracy,
            "words_reviewed": words_reviewed,
            "words_added": words_added,
            "favorites_count": favorites_count,
            "active_days": active_days,
        }

    try:
        return await asyncio.to_thread(_fetch_stats)
    except Exception as e:
        logger.exception("Failed to fetch activity stats for user_id %s: %s", user_id, e)
        raise
