from __future__ import annotations

from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parent.parent.parent
BOT_ENV_EXAMPLE = REPO_ROOT / "telegram-bot" / ".env.example"
BOT_VALIDATE_RUNTIME = REPO_ROOT / "telegram-bot" / "bot" / "validate_runtime.py"
BOT_MAIN = REPO_ROOT / "telegram-bot" / "bot" / "main.py"


def test_bot_env_example_matches_render_sentry_runtime_contract() -> None:
    env_example = BOT_ENV_EXAMPLE.read_text(encoding="utf-8")
    validate_runtime = BOT_VALIDATE_RUNTIME.read_text(encoding="utf-8")
    main_source = BOT_MAIN.read_text(encoding="utf-8")

    assert "Required when RENDER=1" in env_example
    assert "BOT_SENTRY_DSN is required when RENDER=1." in validate_runtime
    assert "BOT_SENTRY_DSN is required in production." in main_source
