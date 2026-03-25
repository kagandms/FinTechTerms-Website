import os
from pathlib import Path

from dotenv import load_dotenv

PROJECT_ROOT = Path(__file__).resolve().parent.parent

for env_file in (PROJECT_ROOT / ".env.local", PROJECT_ROOT / ".env"):
    if env_file.exists():
        load_dotenv(env_file, override=False)

SUPABASE_SERVICE_KEY = (
    os.environ.get("SUPABASE_SERVICE_KEY")
    or os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
)

if not SUPABASE_SERVICE_KEY:
    raise RuntimeError(
        "Missing SUPABASE_SERVICE_KEY or SUPABASE_SERVICE_ROLE_KEY. Set one of them "
        "in your shell or add it to .env.local (preferred) or .env "
        "before running scripts/run_schema_update.py."
    )

def run_sql():
    print("⚠️  Direct legacy SQL execution is disabled.")
    print("👉 Apply shared schema changes only through supabase/migrations/ using `supabase db push` or the repo release scripts.")
    
if __name__ == "__main__":
    run_sql()
