from __future__ import annotations

from dataclasses import dataclass, asdict
from datetime import datetime, timedelta, timezone
from threading import Lock
from typing import Any


HEARTBEAT_TTL_SECONDS = 90


@dataclass
class RuntimeState:
    bot_ready: bool = False
    last_bot_heartbeat_at: str | None = None
    sentry_enabled: bool = False
    redis_rate_limit_enabled: bool = False


_state = RuntimeState()
_state_lock = Lock()


def configure_runtime_state(
    *,
    sentry_enabled: bool,
    redis_rate_limit_enabled: bool,
) -> None:
    with _state_lock:
        _state.sentry_enabled = sentry_enabled
        _state.redis_rate_limit_enabled = redis_rate_limit_enabled


def mark_bot_ready() -> None:
    with _state_lock:
        _state.bot_ready = True
        _state.last_bot_heartbeat_at = datetime.now(timezone.utc).isoformat()


def mark_bot_not_ready() -> None:
    with _state_lock:
        _state.bot_ready = False


def record_bot_heartbeat() -> None:
    with _state_lock:
        _state.last_bot_heartbeat_at = datetime.now(timezone.utc).isoformat()


def get_runtime_health() -> dict[str, Any]:
    with _state_lock:
        snapshot = RuntimeState(**asdict(_state))

    last_heartbeat = (
        datetime.fromisoformat(snapshot.last_bot_heartbeat_at)
        if snapshot.last_bot_heartbeat_at
        else None
    )
    is_heartbeat_fresh = (
        last_heartbeat is not None
        and (datetime.now(timezone.utc) - last_heartbeat) <= timedelta(seconds=HEARTBEAT_TTL_SECONDS)
    )

    return {
        "ready": snapshot.bot_ready and is_heartbeat_fresh,
        "bot_ready": snapshot.bot_ready,
        "last_bot_heartbeat_at": snapshot.last_bot_heartbeat_at,
        "sentry_enabled": snapshot.sentry_enabled,
        "redis_rate_limit_enabled": snapshot.redis_rate_limit_enabled,
        "heartbeat_ttl_seconds": HEARTBEAT_TTL_SECONDS,
    }
