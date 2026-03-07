"""
FinTechTerms Bot — Database Layer
Connects to Supabase for stateless term lookup only.
All database operations are moved to a thread pool to avoid blocking the asyncio event loop.
"""

from __future__ import annotations

import asyncio
import json
import logging
import random
import re
from typing import Any, Optional

from supabase import create_client, Client

from bot.config import config, SUPPORTED_LANGUAGES

logger = logging.getLogger(__name__)

VALID_REGIONAL_MARKETS = {"MOEX", "BIST", "GLOBAL"}
ACADEMIC_SEARCH_FILTERS: tuple[tuple[str, dict[str, Any]], ...] = (
    ("moex", {"regional_market": "MOEX"}),
    ("мосбиржа", {"regional_market": "MOEX"}),
    ("мосбир", {"regional_market": "MOEX"}),
    ("moscow exchange", {"regional_market": "MOEX"}),
    ("bist", {"regional_market": "BIST"}),
    ("borsa istanbul", {"regional_market": "BIST"}),
    ("economics", {"context_tags": {"disciplines": ["economics"]}}),
    ("экономика", {"context_tags": {"disciplines": ["economics"]}}),
    ("ekonomi", {"context_tags": {"disciplines": ["economics"]}}),
    ("mis", {"context_tags": {"disciplines": ["mis"]}}),
    ("management information systems", {"context_tags": {"disciplines": ["mis"]}}),
    ("управленческие информационные системы", {"context_tags": {"disciplines": ["mis"]}}),
    ("yonetim bilisim sistemleri", {"context_tags": {"disciplines": ["mis"]}}),
    ("yönetim bilişim sistemleri", {"context_tags": {"disciplines": ["mis"]}}),
    ("spbu", {"context_tags": {"target_universities": ["SPbU"]}}),
    ("спбгу", {"context_tags": {"target_universities": ["SPbU"]}}),
    ("hse", {"context_tags": {"target_universities": ["HSE"]}}),
    ("вшэ", {"context_tags": {"target_universities": ["HSE"]}}),
)

# ── Supabase Clients ────────────────────────────────────────
_public_client: Optional[Client] = None


def _normalize_language(language: Any) -> str:
    if isinstance(language, str) and language in SUPPORTED_LANGUAGES:
        return language

    if config.default_language in SUPPORTED_LANGUAGES:
        return config.default_language

    return "ru"


def _normalize_regional_market(value: Any) -> str:
    if isinstance(value, str):
        normalized = value.strip().upper()
        if normalized in VALID_REGIONAL_MARKETS:
            return normalized
    return "GLOBAL"


def _normalize_context_tags(value: Any) -> dict[str, Any]:
    if isinstance(value, str):
        stripped = value.strip()
        if not stripped:
            return {}

        try:
            value = json.loads(stripped)
        except json.JSONDecodeError:
            return {}

    if not isinstance(value, dict):
        return {}

    normalized: dict[str, Any] = {}
    for key, raw_value in value.items():
        if not isinstance(key, str) or not key.strip():
            continue

        if isinstance(raw_value, (list, tuple, set)):
            cleaned = [
                str(item).strip()
                for item in raw_value
                if str(item).strip()
            ]
            if cleaned:
                normalized[key] = cleaned
            continue

        if isinstance(raw_value, str):
            cleaned = raw_value.strip()
            if cleaned:
                normalized[key] = cleaned
            continue

        if isinstance(raw_value, (int, float, bool)):
            normalized[key] = raw_value

    return normalized


def normalize_term_payload(term: Any) -> dict[str, Any]:
    if not isinstance(term, dict):
        return {
            "regional_market": "GLOBAL",
            "context_tags": {},
        }

    normalized = dict(term)
    normalized["regional_market"] = _normalize_regional_market(normalized.get("regional_market"))
    normalized["context_tags"] = _normalize_context_tags(normalized.get("context_tags"))
    return normalized


def _tokenize_query(query: str) -> set[str]:
    return {token for token in re.split(r"[^\w]+", query.casefold()) if token}


def build_academic_search_filters(query: str) -> list[dict[str, Any]]:
    normalized_query = (query or "").casefold()
    if not normalized_query:
        return []

    tokens = _tokenize_query(normalized_query)
    filters: list[dict[str, Any]] = []
    seen: set[str] = set()

    for needle, filter_spec in ACADEMIC_SEARCH_FILTERS:
        matches = needle in normalized_query if " " in needle else needle in tokens
        if not matches:
            continue

        signature = json.dumps(filter_spec, sort_keys=True)
        if signature in seen:
            continue

        seen.add(signature)
        filters.append(filter_spec)

    return filters

def get_public_client() -> Client:
    """Lazy-initialise public Supabase client (anon key preferred, service-role fallback)."""
    global _public_client
    if _public_client is None:
        public_key = config.supabase_key or config.supabase_service_role_key
        _public_client = create_client(config.supabase_url, public_key)
    return _public_client


def get_client() -> Client:
    """Backward-compatible alias for term lookup call sites."""
    return get_public_client()

# ── Term Queries ───────────────────────────────────────────
async def fetch_all_terms() -> list[dict[str, Any]]:
    """Fetch all terms from the Supabase `terms` table."""
    def _fetch():
        return get_public_client().table("terms").select("*").execute()
    try:
        response = await asyncio.to_thread(_fetch)
        return [normalize_term_payload(row) for row in (response.data or [])]
    except Exception as e:
        logger.error("Failed to fetch all terms (Database Unreachable): %s", e)
        raise ConnectionError("VERİTABANI_BAĞLANTISI_YOK")

async def fetch_term_by_id(term_id: str) -> Optional[dict[str, Any]]:
    """Fetch a single term by its ID."""
    def _fetch():
        return get_public_client().table("terms").select("*").eq("id", term_id).limit(1).execute()
    try:
        response = await asyncio.to_thread(_fetch)
        data = response.data
        return normalize_term_payload(data[0]) if data else None
    except Exception as e:
        logger.error("Failed to fetch term %s (Database Unreachable): %s", term_id, e)
        raise ConnectionError("VERİTABANI_BAĞLANTISI_YOK")

async def search_terms(query: str, limit: int = 10) -> list[dict[str, Any]]:
    """
    Search terms across all three languages using Trigram (pg_trgm) fuzzy search RPC.
    Complexity: O(log N) due to GIN Indexes in DB.
    """
    academic_filters = build_academic_search_filters(query)
    safe_limit = max(1, min(int(limit), 25))

    def _search():
        client = get_public_client()
        merged_rows: dict[str, dict[str, Any]] = {}

        trigram_response = client.rpc(
            "search_terms_trigram",
            {"search_query": query, "max_limit": safe_limit},
        ).execute()

        trigram_rows = trigram_response.data if isinstance(trigram_response.data, list) else []
        for row in trigram_rows:
            normalized = normalize_term_payload(row)
            term_id = normalized.get("id")
            if isinstance(term_id, str) and term_id:
                merged_rows[term_id] = normalized

        for filter_spec in academic_filters:
            query_builder = client.table("terms").select("*")

            if filter_spec.get("regional_market"):
                query_builder = query_builder.eq(
                    "regional_market",
                    filter_spec["regional_market"],
                )

            if filter_spec.get("context_tags"):
                query_builder = query_builder.contains(
                    "context_tags",
                    filter_spec["context_tags"],
                )

            filtered_response = query_builder.limit(safe_limit).execute()
            filtered_rows = filtered_response.data if isinstance(filtered_response.data, list) else []
            for row in filtered_rows:
                normalized = normalize_term_payload(row)
                term_id = normalized.get("id")
                if isinstance(term_id, str) and term_id:
                    merged_rows.setdefault(term_id, normalized)

        return list(merged_rows.values())[:safe_limit]
    try:
        return await asyncio.to_thread(_search)
    except Exception as e:
        logger.error("Search failed for '%s' (Database Unreachable): %s", query, e)
        raise ConnectionError("VERİTABANI_BAĞLANTISI_YOK")

async def get_random_term() -> Optional[dict[str, Any]]:
    """Return a random term for the Daily Term feature."""
    def _get():
        return get_public_client().table("terms").select("id").execute()
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
        return get_public_client().table("terms").select("*").eq("category", category).execute()
    try:
        response = await asyncio.to_thread(_fetch)
        return [normalize_term_payload(row) for row in (response.data or [])]
    except Exception as e:
        logger.error("Failed to fetch terms for category %s: %s", category, e)
        return []

# ── Stats ──────────────────────────────────────────────────
async def get_term_count() -> int:
    """Return total number of terms in the database."""
    def _count():
        return get_public_client().table("terms").select("id", count="exact").execute()
    try:
        response = await asyncio.to_thread(_count)
        return response.count or 0
    except Exception as e:
        logger.error("Failed to get term count: %s", e)
        return 0

async def get_category_counts() -> dict[str, int]:
    """Return term counts per category."""
    def _counts():
        return get_public_client().table("terms").select("category").execute()
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
