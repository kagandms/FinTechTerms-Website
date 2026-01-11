
import os
from supabase import create_client, Client

# ==========================================
# CONFIGURATION
# ==========================================
SUPABASE_URL = os.environ.get("SUPABASE_URL", "https://hdhytostmmrvwuluogpq.supabase.co")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY", "sb_secret_fju53ntrI24ye_B00RX3CA_KBanYNHF")

def init_supabase() -> Client:
    return create_client(SUPABASE_URL, SUPABASE_KEY)


def clean_data():
    supabase = init_supabase()
    print("🧹 Starting cleanup of synthetic data...")

    # 1. Delete quiz_attempts with quiz_type = 'simulation'
    print("Deleting 'quiz_attempts' (simulation)...")
    try:
        total_deleted_attempts = 0
        while True:
            # Check count first
            res = supabase.table("quiz_attempts").select("id", count="exact").eq("quiz_type", "simulation").execute()
            count = res.count
            if count is None or count == 0:
                break
                
            print(f"  - Found {count} records to delete...")
            # Delete in batches if needed, but eq() + delete() should handle it.
            # However, if RLS blocks delete, this will fail. 
            # If RLS is enabled, and we are Anon, we cannot delete others' data.
            # We are assuming SUPABASE_KEY is a SERVICE_ROLE key which bypasses RLS.
            res = supabase.table("quiz_attempts").delete().eq("quiz_type", "simulation").execute()
            if len(res.data) == 0 and count > 0:
                 print("  ⚠️ Warning: Delete returned 0 records but count was > 0. RLS might be blocking deletion.")
                 print("  👉 Check policies or use a Service Role Key.")
                 break
            total_deleted_attempts += len(res.data)
            
        print(f"✅ Deleted {total_deleted_attempts} simulation quiz attempts.")
    except Exception as e:
        print(f"❌ Error deleting quiz_attempts: {e}")

    # 2. Delete study_sessions where anonymous_id starts with 'bot_'
    print("Deleting 'study_sessions' (bots)...")
    try:
        total_deleted_sessions = 0
        while True:
            res = supabase.table("study_sessions").select("id", count="exact").like("anonymous_id", "bot_%").execute()
            count = res.count
            if count is None or count == 0:
                break
            
            print(f"  - Found {count} records to delete...")
            res = supabase.table("study_sessions").delete().like("anonymous_id", "bot_%").execute()
            if len(res.data) == 0 and count > 0:
                 print("  ⚠️ Warning: Delete returned 0 records but count was > 0. RLS might be blocking deletion.")
                 break
            total_deleted_sessions += len(res.data)

        print(f"✅ Deleted {total_deleted_sessions} bot study sessions.")
    except Exception as e:
        print(f"❌ Error deleting study_sessions: {e}")

    print("\n🎉 Cleanup Process Finished.")

if __name__ == "__main__":
    confirm = input("Are you sure you want to delete all synthetic data? (yes/no): ")
    if confirm.lower() == "yes":
        clean_data()
    else:
        print("Operation cancelled.")
