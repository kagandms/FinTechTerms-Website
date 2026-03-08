"""
FinTechTerms Bot — Statistics helpers.
"""

from __future__ import annotations

import asyncio
import logging

from bot.db_client import apply_academic_quarantine, get_public_client

logger = logging.getLogger(__name__)


async def get_term_count() -> int:
    """Return total number of public terms in the database."""
    def _count():
        return apply_academic_quarantine(
            get_public_client().table("terms").select("id", count="exact")
        ).execute()

    try:
        response = await asyncio.to_thread(_count)
        return response.count or 0
    except Exception as e:
        logger.error("Failed to get term count: %s", e)
        return 0


async def get_category_counts() -> dict[str, int]:
    """Return public term counts per category."""
    def _counts():
        return apply_academic_quarantine(
            get_public_client().table("terms").select("category")
        ).execute()

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
