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
