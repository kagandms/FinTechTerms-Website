from __future__ import annotations

import os
from urllib.parse import urlparse

ALLOW_REMOTE_DESTRUCTIVE_SCRIPTS_ENV = "ALLOW_REMOTE_DESTRUCTIVE_SCRIPTS"
LOCAL_HOSTNAMES = {
    "localhost",
    "127.0.0.1",
    "0.0.0.0",
    "host.docker.internal",
}


def is_local_supabase_url(url: str) -> bool:
    parsed_url = urlparse(url)
    hostname = (parsed_url.hostname or "").strip().lower()

    if not hostname:
        return False

    if hostname in LOCAL_HOSTNAMES:
        return True

    return hostname.endswith(".local")


def assert_safe_destructive_target(supabase_url: str, script_name: str) -> None:
    if is_local_supabase_url(supabase_url):
        return

    if os.environ.get(ALLOW_REMOTE_DESTRUCTIVE_SCRIPTS_ENV, "").strip() == "1":
        return

    raise EnvironmentError(
        f"{script_name} refused to run against remote Supabase target {supabase_url!r}. "
        f"Set {ALLOW_REMOTE_DESTRUCTIVE_SCRIPTS_ENV}=1 to acknowledge destructive remote changes."
    )
