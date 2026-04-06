"""
FinTechTerms Bot — Statistics helpers.
"""

from __future__ import annotations

import logging

from bot.db_client import execute_public_query, get_public_client

logger = logging.getLogger(__name__)


class StatsUnavailableError(RuntimeError):
    """Raised when public statistics cannot be loaded from the database."""


async def get_term_count() -> int:
    """Return total number of public terms in the database."""
    def _count():
        return get_public_client().rpc("get_public_term_count").execute()

    try:
        response = await execute_public_query(_count)
        if response.data is None:
            return 0

        return int(response.data)
    except Exception as e:
        logger.error("Failed to get term count: %s", e)
        raise StatsUnavailableError("Term count is temporarily unavailable.") from e


async def get_category_counts() -> dict[str, int]:
    """Return public term counts per category."""
    def _counts():
        return get_public_client().rpc("get_public_term_category_counts").execute()

    try:
        response = await execute_public_query(_counts)
        counts: dict[str, int] = {}
        for row in response.data or []:
            category = row.get("category", "Unknown")
            raw_count = row.get("count", 0)

            try:
                counts[str(category)] = int(raw_count)
            except (TypeError, ValueError):
                counts[str(category)] = 0
        return counts
    except Exception as e:
        logger.error("Failed to get category counts: %s", e)
        raise StatsUnavailableError("Category counts are temporarily unavailable.") from e
