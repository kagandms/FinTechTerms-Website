from __future__ import annotations

from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parent.parent.parent
BOT_ENV_EXAMPLE = REPO_ROOT / "telegram-bot" / ".env.example"
BOT_VALIDATE_RUNTIME = REPO_ROOT / "telegram-bot" / "bot" / "validate_runtime.py"
BOT_MAIN = REPO_ROOT / "telegram-bot" / "bot" / "main.py"
BOT_PYTHON_VERSION = REPO_ROOT / "telegram-bot" / ".python-version"
BOT_REQUIREMENTS = REPO_ROOT / "telegram-bot" / "requirements.txt"
RENDER_BLUEPRINT = REPO_ROOT / "render.yaml"


def test_bot_env_example_matches_render_sentry_runtime_contract() -> None:
    env_example = BOT_ENV_EXAMPLE.read_text(encoding="utf-8")
    validate_runtime = BOT_VALIDATE_RUNTIME.read_text(encoding="utf-8")
    main_source = BOT_MAIN.read_text(encoding="utf-8")

    assert "Required when RENDER=1" in env_example
    assert "BOT_SENTRY_DSN is required when RENDER=1." in validate_runtime
    assert "BOT_SENTRY_DSN is required in production." in main_source


def test_bot_env_example_matches_render_redis_runtime_contract() -> None:
    env_example = BOT_ENV_EXAMPLE.read_text(encoding="utf-8")
    validate_runtime = BOT_VALIDATE_RUNTIME.read_text(encoding="utf-8")
    main_source = BOT_MAIN.read_text(encoding="utf-8")

    assert "required when RENDER=1" in env_example
    assert "REDIS_URL is required when RENDER=1." in validate_runtime
    assert "REDIS_URL is required in production." in main_source


def test_render_blueprint_deploys_bot_from_docker_root() -> None:
    blueprint = RENDER_BLUEPRINT.read_text(encoding="utf-8")

    assert "runtime: docker" in blueprint
    assert "rootDir: telegram-bot" in blueprint
    assert "healthCheckPath: /health" in blueprint
    assert "BOT_TOKEN" in blueprint
    assert "SUPABASE_ANON_KEY" in blueprint
    assert "REDIS_URL" in blueprint
    assert "BOT_SENTRY_DSN" in blueprint


def test_native_python_version_pin_matches_lockfile_target() -> None:
    python_version = BOT_PYTHON_VERSION.read_text(encoding="utf-8").strip()
    requirements = BOT_REQUIREMENTS.read_text(encoding="utf-8")

    assert python_version == "3.13"
    assert "pip-compile with Python 3.13" in requirements
