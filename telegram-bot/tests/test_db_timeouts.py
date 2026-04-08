from __future__ import annotations

import asyncio
import time

import pytest

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
