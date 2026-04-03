"""
FinTechTerms Bot — Production runtime contract validator.
"""

from __future__ import annotations

import os
import sys
from urllib.parse import urlparse

from bot.config import Config


def _validate_absolute_url(name: str, value: str) -> None:
    parsed = urlparse(value)
    if parsed.scheme not in ("http", "https") or not parsed.netloc:
        raise EnvironmentError(f"{name} must be an absolute http(s) URL.")


def main() -> None:
    config = Config()
    config.validate()

    _validate_absolute_url("SUPABASE_URL", config.supabase_url)
    _validate_absolute_url("WEB_APP_URL", config.web_app_url)

    if os.environ.get("RENDER", "").strip() and not config.sentry_dsn:
        raise EnvironmentError("BOT_SENTRY_DSN is required when RENDER=1.")

    print("Bot runtime configuration is valid.")


if __name__ == "__main__":
    try:
        main()
    except EnvironmentError as exc:
        print(str(exc), file=sys.stderr)
        sys.exit(1)
