from __future__ import annotations

import asyncio
import time
from types import SimpleNamespace

import pytest

from bot import db_client, rate_limiter
from bot.db_client import execute_public_query


@pytest.mark.anyio
async def test_execute_public_query_returns_result_before_timeout() -> None:
    result = await execute_public_query(lambda: "ok", timeout_seconds=0.1)
    assert result == "ok"


@pytest.mark.anyio
async def test_execute_public_query_times_out_blocking_calls() -> None:
    with pytest.raises(asyncio.TimeoutError):
        await execute_public_query(
            lambda: time.sleep(0.05),
            timeout_seconds=0.01,
        )


def test_get_public_client_configures_sdk_postgrest_timeout(monkeypatch: pytest.MonkeyPatch) -> None:
    db_client._public_client = None
    recorded: dict[str, object] = {}

    def fake_create_client(url: str, key: str, *, options: object) -> object:
        recorded["url"] = url
        recorded["key"] = key
        recorded["options"] = options
        return object()

    monkeypatch.setattr(db_client, "create_client", fake_create_client)

    client = db_client.get_public_client()

    assert client is not None
    assert recorded["url"] == db_client.config.supabase_url
    assert recorded["key"] == db_client.config.supabase_anon_key
    assert getattr(recorded["options"], "postgrest_client_timeout") == db_client.SUPABASE_REQUEST_TIMEOUT_SECONDS


@pytest.mark.anyio
async def test_rate_limiter_fails_closed_without_redis_in_render(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("RENDER", "1")
    monkeypatch.setattr(rate_limiter, "_redis_client", None)
    monkeypatch.setattr(rate_limiter, "config", SimpleNamespace(redis_url=""))

    assert await rate_limiter.is_rate_limited(123) is True
    assert await rate_limiter.is_search_rate_limited(123) is True
