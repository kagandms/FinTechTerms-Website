"""
FinTechTerms Bot — Text-to-Speech Module
Generates audio pronunciation for terms using edge-tts.
"""

from __future__ import annotations

import hashlib
import logging
from pathlib import Path
from typing import Optional

from bot.config import config

logger = logging.getLogger(__name__)

# Language → edge-tts voice mapping
VOICE_MAP: dict[str, str] = {
    "en": "en-US-AriaNeural",
    "ru": "ru-RU-SvetlanaNeural",
    "tr": "tr-TR-EmelNeural",
}


async def generate_tts_audio(text: str, lang: str = "en") -> Optional[Path]:
    """
    Generate a TTS audio file (.mp3) for the given text and language.
    Files are cached by content hash to avoid redundant generation.

    Returns the path to the audio file, or None on failure.
    """
    try:
        import edge_tts  # type: ignore[import-untyped]
    except ImportError:
        logger.warning("edge-tts not installed, TTS disabled.")
        return None

    # Ensure cache dir exists
    cache_dir = config.audio_cache_dir
    cache_dir.mkdir(parents=True, exist_ok=True)

    # Generate deterministic filename from content
    content_hash = hashlib.md5(f"{text}:{lang}".encode()).hexdigest()[:12]
    audio_path = cache_dir / f"{content_hash}.mp3"

    # Return cached file if it exists
    if audio_path.exists():
        return audio_path

    # Select voice
    voice = VOICE_MAP.get(lang, VOICE_MAP["en"])

    try:
        communicate = edge_tts.Communicate(text, voice)
        await communicate.save(str(audio_path))
        logger.info("Generated TTS: '%s' [%s] → %s", text, lang, audio_path.name)
        return audio_path
    except Exception as e:
        logger.error("TTS generation failed for '%s' [%s]: %s", text, lang, e)
        return None


async def cleanup_cache(max_files: int = 500) -> int:
    """
    Remove oldest cached audio files if the cache exceeds max_files.
    Returns the number of files deleted.
    """
    cache_dir = config.audio_cache_dir
    if not cache_dir.exists():
        return 0

    files = sorted(cache_dir.glob("*.mp3"), key=lambda f: f.stat().st_mtime)
    if len(files) <= max_files:
        return 0

    to_delete = files[: len(files) - max_files]
    for f in to_delete:
        f.unlink(missing_ok=True)

    logger.info("Cleaned up %d cached TTS files.", len(to_delete))
    return len(to_delete)
