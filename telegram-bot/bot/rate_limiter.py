"""
FinTechTerms Bot — Distributed Rate Limiter
Uses Redis for cross-server rate limiting. Falls back to an in-memory dictionary
if REDIS_URL is not configured (e.g., local development).
"""

import logging
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

# Redis client singleton
_redis_client: Optional['aioredis.Redis'] = None

# Fallback memory cache if Redis is not available
_MEMORY_CACHE: dict[int, float] = {}

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
    return _redis_client

async def is_rate_limited(user_id: int) -> bool:
    """
    Check if the user is sending requests too fast.
    Uses Redis `SETNX` or `SET` with `EX` (Expiration) for atomic, distributed locks.
    """
    redis = get_redis()
    
    if redis:
        key = f"rate_limit:{user_id}"
        try:
            # Atomic set with 1 second expiry. If it sets, they aren't limited.
            # If it fails to set (already exists), they are limited.
            added = await redis.set(key, "1", nx=True, ex=int(RATE_LIMIT_SECONDS) or 1)
            return not bool(added)
        except Exception as e:
            logger.warning("Redis rate limit failed, falling back to memory: %s", e)
            # Fall through to memory cache if Redis error occurs
    
    # ── Fallback Memory Cache ──
    now = time.time()
    last_req = _MEMORY_CACHE.get(user_id, 0)
    if now - last_req < RATE_LIMIT_SECONDS:
        return True
    _MEMORY_CACHE[user_id] = now
    return False
