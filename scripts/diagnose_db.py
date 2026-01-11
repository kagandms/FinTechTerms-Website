
import os
from supabase import create_client

# Use the same config as the main script
SUPABASE_URL = os.environ.get("SUPABASE_URL", "https://hdhytostmmrvwuluogpq.supabase.co")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY", "your_supabase_service_role_key_here")

def test_insert():
    print(f"Connecting to {SUPABASE_URL}...")
    try:
        supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
    except Exception as e:
        print(f"❌ Client Init Failed: {e}")
        return

    print("Attempting to insert 1 simulation record...")
    
    data = {
        "user_id": None,
        "term_id": "test_term",
        "session_id": "123e4567-e89b-12d3-a456-426614174000", # UUID test
        "is_correct": True,
        "response_time_ms": 1000,
        "quiz_type": "simulation",
        # created_at defaults to now
    }
    
    try:
        response = supabase.table("quiz_attempts").insert(data).execute()
        print("✅ Insert SUCCESS!")
        print(response)
    except Exception as e:
        print(f"❌ Insert FAILED: {e}")
        print("\nReason: Likely RLS Policy blocking 'user_id=None' or Invalid API Key.")

if __name__ == "__main__":
    test_insert()
