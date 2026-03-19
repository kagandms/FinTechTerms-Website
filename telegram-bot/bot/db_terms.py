"""
FinTechTerms Bot — Term lookup helpers.
"""

from __future__ import annotations

import asyncio
import json
import logging
import random
import re
from time import monotonic
from typing import Any, Optional

from bot.config import SUPPORTED_LANGUAGES, config
from bot.db_client import apply_academic_quarantine, get_public_client

logger = logging.getLogger(__name__)

TERM_ID_CACHE_TTL_SECONDS = 15 * 60
QUIZ_TERM_FETCH_LIMIT = 64
_TERM_ID_CACHE: list[str] = []
_TERM_ID_CACHE_LOADED_AT = 0.0

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


def is_public_term(term: Any) -> bool:
    """Mirror web-side academic quarantine logic from lib/academicQuarantine.ts."""
    return not isinstance(term, dict) or term.get("is_academic") is not False


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


def normalize_public_terms(rows: list[dict[str, Any]] | None) -> list[dict[str, Any]]:
    return [normalize_term_payload(row) for row in (rows or []) if is_public_term(row)]


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


async def fetch_all_terms() -> list[dict[str, Any]]:
    """Fetch all public terms from the Supabase `terms` table."""
    return await fetch_all_terms_limited(limit=None)


async def fetch_all_terms_limited(limit: int | None) -> list[dict[str, Any]]:
    """Fetch public terms, optionally using a bounded candidate set for quiz flows."""
    if limit is not None:
        return await fetch_quiz_candidate_terms(limit=limit)

    def _fetch():
        return apply_academic_quarantine(
            get_public_client().table("terms").select("*")
        ).execute()

    try:
        response = await asyncio.to_thread(_fetch)
        return normalize_public_terms(response.data)
    except Exception as e:
        logger.error("Failed to fetch all terms (Database Unreachable): %s", e)
        raise ConnectionError("VERİTABANI_BAĞLANTISI_YOK")


async def fetch_quiz_candidate_terms(limit: int = QUIZ_TERM_FETCH_LIMIT) -> list[dict[str, Any]]:
    """Fetch a bounded random subset of public terms for quiz generation."""
    safe_limit = max(4, min(int(limit), QUIZ_TERM_FETCH_LIMIT))

    def _fetch_term_ids() -> list[str]:
        response = apply_academic_quarantine(
            get_public_client().table("terms").select("id")
        ).execute()
        return [
            row["id"]
            for row in (response.data or [])
            if isinstance(row, dict) and isinstance(row.get("id"), str) and row["id"].strip()
        ]

    def _fetch_terms(sample_ids: list[str]) -> list[dict[str, Any]]:
        response = apply_academic_quarantine(
            get_public_client()
            .table("terms")
            .select("id,term_en,term_ru,term_tr,definition_en,definition_ru,definition_tr,is_academic")
            .in_("id", sample_ids)
        ).execute()
        return normalize_public_terms(response.data)

    try:
        global _TERM_ID_CACHE, _TERM_ID_CACHE_LOADED_AT

        now = monotonic()
        if not _TERM_ID_CACHE or (now - _TERM_ID_CACHE_LOADED_AT) > TERM_ID_CACHE_TTL_SECONDS:
            _TERM_ID_CACHE = await asyncio.to_thread(_fetch_term_ids)
            _TERM_ID_CACHE_LOADED_AT = now

        if not _TERM_ID_CACHE:
            return []

        sample_size = min(safe_limit, len(_TERM_ID_CACHE))
        sample_ids = random.sample(_TERM_ID_CACHE, sample_size)
        return await asyncio.to_thread(_fetch_terms, sample_ids)
    except Exception as e:
        logger.error("Failed to fetch bounded quiz terms (Database Unreachable): %s", e)
        raise ConnectionError("VERİTABANI_BAĞLANTISI_YOK")


async def fetch_term_by_id(term_id: str) -> Optional[dict[str, Any]]:
    """Fetch a single public term by its ID."""
    def _fetch():
        return apply_academic_quarantine(
            get_public_client().table("terms").select("*")
        ).eq("id", term_id).limit(1).execute()

    try:
        response = await asyncio.to_thread(_fetch)
        data = normalize_public_terms(response.data)
        return data[0] if data else None
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

        for normalized in normalize_public_terms(
            trigram_response.data if isinstance(trigram_response.data, list) else []
        ):
            term_id = normalized.get("id")
            if isinstance(term_id, str) and term_id:
                merged_rows[term_id] = normalized

        for filter_spec in academic_filters:
            query_builder = apply_academic_quarantine(
                client.table("terms").select("*")
            )

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
            for normalized in normalize_public_terms(
                filtered_response.data if isinstance(filtered_response.data, list) else []
            ):
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
    """Return a random public term for the Daily Term feature."""
    def _get():
        return apply_academic_quarantine(
            get_public_client().table("terms").select("id")
        ).execute()

    try:
        response = await asyncio.to_thread(_get)
        ids = [row["id"] for row in (response.data or []) if isinstance(row, dict) and row.get("id")]
        if not ids:
            return None
        chosen_id = random.choice(ids)
        return await fetch_term_by_id(chosen_id)
    except Exception as e:
        logger.error("Failed to get random term (Database Unreachable): %s", e)
        raise ConnectionError("VERİTABANI_BAĞLANTISI_YOK")


async def get_terms_by_category(category: str) -> list[dict[str, Any]]:
    """Fetch public terms filtered by category (Fintech / Finance / Technology)."""
    def _fetch():
        return apply_academic_quarantine(
            get_public_client().table("terms").select("*")
        ).eq("category", category).execute()

    try:
        response = await asyncio.to_thread(_fetch)
        return normalize_public_terms(response.data)
    except Exception as e:
        logger.error("Failed to fetch terms for category %s: %s", category, e)
        return []
