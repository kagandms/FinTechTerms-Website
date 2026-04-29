"""
FinTechTerms Bot — Distributed Rate Limiter
Uses Redis for cross-server rate limiting. Falls back to an in-memory dictionary
if REDIS_URL is not configured (e.g., local development).
"""

import logging
import os
import time
from typing import Optional

try:
    from redis import asyncio as aioredis
except ImportError:
    aioredis = None

from bot.config import config

logger = logging.getLogger(__name__)

# Configurable rate limit (1 request per second)
RATE_LIMIT_SECONDS = 1.0
SEARCH_RATE_LIMIT_SECONDS = 5.0

# Redis client singleton
_redis_client: Optional['aioredis.Redis'] = None

# Fallback memory cache if Redis is not available
_MEMORY_CACHE: dict[int, float] = {}
_SEARCH_MEMORY_CACHE: dict[int, float] = {}


def _requires_distributed_rate_limit() -> bool:
    return bool(os.environ.get("RENDER", "").strip())


def _cleanup_memory_cache(cache: dict[int, float], now: float, limit_seconds: float) -> None:
    expired_user_ids = [
        user_id
        for user_id, last_request_at in cache.items()
        if now - last_request_at >= limit_seconds
    ]

    for user_id in expired_user_ids:
        cache.pop(user_id, None)


def _is_memory_rate_limited(
    user_id: int,
    *,
    cache: dict[int, float],
    limit_seconds: float,
) -> bool:
    now = time.time()
    _cleanup_memory_cache(cache, now, limit_seconds)
    last_request_at = cache.get(user_id, 0)
    if now - last_request_at < limit_seconds:
        return True

    cache[user_id] = now
    return False

def get_redis() -> Optional['aioredis.Redis']:
    """Lazy-initialize Redis connection pool."""
    global _redis_client
    if _redis_client is None and config.redis_url and aioredis:
        try:
            _redis_client = aioredis.from_url(
                config.redis_url, 
                decode_responses=True,
                socket_timeout=2.0
            )
            logger.info("✅ Redis connected for distributed rate-limiting.")
        except Exception as e:
            logger.error("❌ Failed to connect to Redis: %s", e)
    if _redis_client is None and _requires_distributed_rate_limit():
        raise RuntimeError("Redis is required for production rate limiting.")
    return _redis_client


def _get_redis_or_fail_closed() -> Optional['aioredis.Redis']:
    try:
        return get_redis()
    except RuntimeError as e:
        logger.error("Production rate limiter unavailable: %s", e)
        return None


async def is_rate_limited(user_id: int) -> bool:
    """
    Check if the user is sending requests too fast.
    Uses Redis `SETNX` or `SET` with `EX` (Expiration) for atomic, distributed locks.
    """
    redis = _get_redis_or_fail_closed()
    
    if redis:
        key = f"rate_limit:{user_id}"
        try:
            # Atomic set with 1 second expiry. If it sets, they aren't limited.
            # If it fails to set (already exists), they are limited.
            added = await redis.set(key, "1", nx=True, ex=int(RATE_LIMIT_SECONDS) or 1)
            return not bool(added)
        except Exception as e:
            if _requires_distributed_rate_limit():
                logger.error("Redis rate limit failed in production: %s", e)
                return True
            logger.warning("Redis rate limit failed, falling back to memory: %s", e)
            # Fall through to memory cache if Redis error occurs

    if _requires_distributed_rate_limit():
        return True
    
    # ── Fallback Memory Cache ──
    return _is_memory_rate_limited(
        user_id,
        cache=_MEMORY_CACHE,
        limit_seconds=RATE_LIMIT_SECONDS,
    )


async def is_search_rate_limited(user_id: int) -> bool:
    """Apply a stricter per-user limiter to database-backed search requests."""
    redis = _get_redis_or_fail_closed()

    if redis:
        key = f"rate_limit:search:{user_id}"
        try:
            added = await redis.set(
                key,
                "1",
                nx=True,
                ex=max(1, int(SEARCH_RATE_LIMIT_SECONDS)),
            )
            return not bool(added)
        except Exception as e:
            if _requires_distributed_rate_limit():
                logger.error("Redis search rate limit failed in production: %s", e)
                return True
            logger.warning("Redis search rate limit failed, falling back to memory: %s", e)

    if _requires_distributed_rate_limit():
        return True

    return _is_memory_rate_limited(
        user_id,
        cache=_SEARCH_MEMORY_CACHE,
        limit_seconds=SEARCH_RATE_LIMIT_SECONDS,
    )
