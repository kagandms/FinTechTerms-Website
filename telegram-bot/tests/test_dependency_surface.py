from __future__ import annotations

from pathlib import Path


BOT_ROOT = Path(__file__).resolve().parent.parent / "bot"


def test_runtime_code_does_not_import_accepted_risk_dependencies() -> None:
    disallowed_imports = ("pyiceberg", "rich", "pygments")

    for file_path in BOT_ROOT.rglob("*.py"):
        source = file_path.read_text(encoding="utf-8")
        for dependency in disallowed_imports:
            assert f"import {dependency}" not in source
            assert f"from {dependency} import" not in source
