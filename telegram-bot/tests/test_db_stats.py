from __future__ import annotations

import asyncio
from dataclasses import dataclass
from typing import Any

from bot import db_stats


@dataclass
class DummyResponse:
    data: Any


class DummyRpcQuery:
    def __init__(self, response: DummyResponse) -> None:
        self._response = response

    def execute(self) -> DummyResponse:
        return self._response


class DummyClient:
    def __init__(self, response: DummyResponse) -> None:
        self._response = response
        self.rpc_calls: list[str] = []

    def rpc(self, name: str) -> DummyRpcQuery:
        self.rpc_calls.append(name)
        return DummyRpcQuery(self._response)


async def _execute_immediately(operation):
    return operation()


def test_get_category_counts_uses_aggregate_rpc(
    monkeypatch,
) -> None:
    client = DummyClient(DummyResponse([
        {"category": "Finance", "count": 20},
        {"category": "Technology", "count": "22"},
    ]))

    monkeypatch.setattr(db_stats, "get_public_client", lambda: client)
    monkeypatch.setattr(db_stats, "execute_public_query", _execute_immediately)

    result = asyncio.run(db_stats.get_category_counts())

    assert result == {
        "Finance": 20,
        "Technology": 22,
    }
    assert client.rpc_calls == ["get_public_term_category_counts"]


def test_get_term_count_uses_public_count_rpc(
    monkeypatch,
) -> None:
    client = DummyClient(DummyResponse(42))

    monkeypatch.setattr(db_stats, "get_public_client", lambda: client)
    monkeypatch.setattr(db_stats, "execute_public_query", _execute_immediately)

    result = asyncio.run(db_stats.get_term_count())

    assert result == 42
    assert client.rpc_calls == ["get_public_term_count"]
