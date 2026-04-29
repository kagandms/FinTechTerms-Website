from __future__ import annotations

import pytest

from bot import validate_runtime


def test_validate_runtime_requires_redis_on_render(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("RENDER", "1")
    monkeypatch.setenv("BOT_SENTRY_DSN", "https://example@sentry.io/1")
    monkeypatch.delenv("REDIS_URL", raising=False)

    with pytest.raises(EnvironmentError, match="REDIS_URL is required when RENDER=1."):
        validate_runtime.main()


def test_validate_runtime_accepts_redis_on_render(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("RENDER", "1")
    monkeypatch.setenv("BOT_SENTRY_DSN", "https://example@sentry.io/1")
    monkeypatch.setenv("REDIS_URL", "redis://localhost:6379/0")

    validate_runtime.main()
