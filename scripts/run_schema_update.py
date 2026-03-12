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
    # Since we can't easily run raw SQL via the JS/Python client without a specific RPC function
    # or direct connection, and we don't have the user's postgres password, 
    # we usually rely on the user to run SQL in the dashboard.
    
    # However, if we have a service role key, we might have privileges?
    # Actually, the standard Supabase client doesn't expose a generic "query" method for raw SQL 
    # unless enabled via an RPC.
    
    print("⚠️  Cannot run raw SQL automatically via basic client.")
    print("👉 Please run the content of 'lib/add_session_id.sql' in your Supabase SQL Editor.")
    
if __name__ == "__main__":
    run_sql()
