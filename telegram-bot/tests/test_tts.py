from __future__ import annotations

import asyncio
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest

from bot import tts


@pytest.mark.asyncio
async def test_generate_tts_audio_times_out_and_removes_partial_file(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
) -> None:
    class SlowCommunicate:
        def __init__(self, _text: str, _voice: str) -> None:
            pass

        async def save(self, path: str) -> None:
            Path(path).write_bytes(b"partial-audio")
            await asyncio.sleep(0.05)

    monkeypatch.setitem(__import__("sys").modules, "edge_tts", SimpleNamespace(Communicate=SlowCommunicate))
    monkeypatch.setattr(tts, "config", SimpleNamespace(audio_cache_dir=tmp_path))
    monkeypatch.setattr(tts, "TTS_GENERATION_TIMEOUT_SECONDS", 0.01)

    with pytest.raises(asyncio.TimeoutError):
        await tts.generate_tts_audio("Hello", "en")

    assert list(tmp_path.glob("*.mp3")) == []


@pytest.mark.asyncio
async def test_generate_tts_audio_triggers_cache_cleanup_after_new_file(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
) -> None:
    class FastCommunicate:
        def __init__(self, _text: str, _voice: str) -> None:
            pass

        async def save(self, path: str) -> None:
            Path(path).write_bytes(b"audio")

    cleanup_mock = AsyncMock(return_value=0)

    monkeypatch.setitem(__import__("sys").modules, "edge_tts", SimpleNamespace(Communicate=FastCommunicate))
    monkeypatch.setattr(tts, "config", SimpleNamespace(audio_cache_dir=tmp_path))
    monkeypatch.setattr(tts, "cleanup_cache", cleanup_mock)

    audio_path = await tts.generate_tts_audio("Hello", "en")

    assert audio_path is not None
    assert audio_path.exists()
    cleanup_mock.assert_awaited_once()
