import os
from supabase import create_client

# Configuration
SUPABASE_URL = os.environ.get("SUPABASE_URL", "https://hdhytostmmrvwuluogpq.supabase.co")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY", "your_supabase_service_role_key_here")

def clean_data():
    print("🧹 Starting cleanup of synthetic data...")
    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
    
    # 1. Delete Quiz Attempts (Simulation type)
    print("   Deleting 'simulation' quiz attempts...")
    try:
        # Delete in chunks if too many, but for now simple delete
        response = supabase.table("quiz_attempts").delete().eq("quiz_type", "simulation").execute()
        # Since we use execute, we might not get count directly in all SDK versions, but let's assume it works or throws
        print("   ✅ Simulation attempts deleted.")
    except Exception as e:
        print(f"   ❌ Error deleting attempts: {e}")

    # 2. Delete Bot Sessions (Anonymous IDs starting with 'bot_')
    print("   Deleting bot study sessions...")
    try:
        # We can't use 'like' easily with delete in some client versions without filters
        # But we can try using a filter. 
        # Ideally: .like("anonymous_id", "bot_%")
        response = supabase.table("study_sessions").delete().like("anonymous_id", "bot_%").execute()
        print("   ✅ Bot sessions deleted.")
    except Exception as e:
        print(f"   ❌ Error deleting sessions: {e}")

    print("✨ Cleanup complete!")

if __name__ == "__main__":
    clean_data()
