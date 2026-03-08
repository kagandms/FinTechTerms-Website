"""
FinTechTerms Bot — Backward-compatible database exports.
"""

from bot.db_client import get_client, get_public_client
from bot.db_stats import get_category_counts, get_term_count
from bot.db_terms import (
    build_academic_search_filters,
    fetch_all_terms,
    fetch_term_by_id,
    get_random_term,
    get_terms_by_category,
    is_public_term,
    normalize_public_terms,
    normalize_term_payload,
    search_terms,
)

__all__ = [
    "build_academic_search_filters",
    "fetch_all_terms",
    "fetch_term_by_id",
    "get_category_counts",
    "get_client",
    "get_public_client",
    "get_random_term",
    "get_term_count",
    "get_terms_by_category",
    "is_public_term",
    "normalize_public_terms",
    "normalize_term_payload",
    "search_terms",
]
