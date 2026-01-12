
import os
import time
import random
import uuid
import math
from datetime import datetime, timedelta
from typing import List, Dict, Optional

# 3rd party libs (pip install faker supabase numpy)
from faker import Faker
from supabase import create_client, Client

# ==========================================
# CONFIGURATION
# ==========================================
# Helper to load .env.local manually (avoids python-dotenv dependency if not installed)
def load_env_local():
    # Look for .env.local in current or parent dirs
    current_dir = os.path.dirname(os.path.abspath(__file__)) # scripts/
    parent_dir = os.path.dirname(current_dir) # root/
    
    env_path = os.path.join(parent_dir, '.env.local')
    if not os.path.exists(env_path):
        env_path = os.path.join(current_dir, '.env.local')
        
    if os.path.exists(env_path):
        print(f"📖 Loading credentials from {env_path}")
        with open(env_path, 'r') as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith('#'): continue
                if '=' in line:
                    key, val = line.split('=', 1)
                    # Remove quotes if present
                    val = val.strip().strip("'").strip('"')
                    os.environ[key] = val
    else:
        print("⚠️ .env.local not found. Relying on existing environment variables.")

load_env_local()

# ==========================================
# CONFIGURATION
# ==========================================
# Try standard names first, then Next.js specific names
SUPABASE_URL = os.environ.get("SUPABASE_URL") or os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or os.environ.get("SUPABASE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    print("❌ ERROR: Missing Supabase Credentials.")
    print("Please ensure .env.local exists in the project root with NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.")
    exit(1)

NUM_BOTS = 50
DAYS_TO_SIMULATE = 30
TOTAL_TERMS = 505  # Updated to match actual count
NEW_TERMS_PER_DAY_LIMIT = 15

# Terms to simulate: term_001 ... term_500
TERM_IDS = [f"term_{i:03d}" for i in range(1, TOTAL_TERMS + 1)]

# Statistics trackers
total_sessions = 0
total_attempts = 0

def init_supabase() -> Client:
    return create_client(SUPABASE_URL, SUPABASE_KEY)

class SRSState:
    def __init__(self):
        self.level = 1  # 1 to 5
        self.next_review = None # datetime
        self.last_reviewed = None # datetime
        self.difficulty_bias = random.uniform(0.8, 1.2) # Some terms are harder for specific users

class Bot:
    def __init__(self, fake: Faker):
        self.id = f"bot_{uuid.uuid4()}"
        self.name = fake.name()
        self.device = random.choice(['mobile', 'mobile', 'mobile', 'desktop', 'tablet']) # Mobile heavy
        self.user_agent = fake.user_agent()
        
        # Human Characteristics
        self.intelligence = random.gauss(1.0, 0.15) # Multiplier for accuracy
        self.speed_factor = random.gauss(1.0, 0.2)  # Multiplier for response time
        self.dedication = random.uniform(0.4, 0.95) # Chance to study on a given day
        self.fatigue_rate = random.uniform(0.01, 0.05) # Accuracy drop per question in session
        
        # Knowledge State
        self.term_states: Dict[str, SRSState] = {}
        self.start_date = datetime.now() - timedelta(days=DAYS_TO_SIMULATE)

    def get_due_terms(self, current_date: datetime) -> List[str]:
        # 1. New terms (if we haven't seen all 500)
        seen_count = len(self.term_states)
        new_terms_needed = 0
        
        # If we have seen few, add more. If we saw many, add fewer.
        if seen_count < TOTAL_TERMS:
            new_terms_needed = random.randint(5, NEW_TERMS_PER_DAY_LIMIT)
            for _ in range(new_terms_needed):
                if len(self.term_states) >= TOTAL_TERMS: break
                # Pick a random term strictly not in states
                # Optimization: simplistic approach for simulation
                # In real app, IDs are fixed.
                new_id = TERM_IDS[len(self.term_states)] 
                self.term_states[new_id] = SRSState()
                # Initial review is Today
                self.term_states[new_id].next_review = current_date 

        # 2. Collect Due Terms
        due = []
        for tid, state in self.term_states.items():
            if state.next_review and state.next_review <= current_date:
                due.append(tid)
        
        return due

    def calculate_human_response(self, term_id: str, fatigue_idx: int) -> tuple[bool, int]:
        state = self.term_states[term_id]
        
        # Base probability calculation based on SRS Level
        # Level 1: 60%, Level 5: 95% (Increased base from 50% to 60% for better visual)
        base_correct_prob = 0.6 + (state.level * 0.08) 
        
        # Adjust for user intelligence and term difficulty bias
        adjusted_prob = base_correct_prob * self.intelligence / state.difficulty_bias
        
        # Gradual Fatigue penalty
        # e.g. fatigue_idx=5 (Question 15) * 0.02 (rate) = 10% penalty
        penalty = fatigue_idx * self.fatigue_rate
        adjusted_prob -= penalty
            
        # Cap probability
        adjusted_prob = max(0.2, min(0.99, adjusted_prob))
        
        is_correct = random.random() < adjusted_prob
        
        # Response Time Calculation
        # Harder/Newer terms take longer. Wrong answers usually take longer (hesitation).
        # Base: 2000ms. Level 1 adds 3000ms. Level 5 adds 0ms.
        difficulty_ms = (6 - state.level) * 800
        
        base_ms = 1500 + difficulty_ms
        if not is_correct:
            base_ms += 1000 # Hesitation on wrong answer
            
        # Random variance
        final_ms = int(random.gauss(base_ms, 500) * self.speed_factor)
        final_ms = max(600, final_ms) # Minimum human reaction limit
        
        return is_correct, final_ms

    def update_srs(self, term_id: str, is_correct: bool, current_date: datetime):
        state = self.term_states[term_id]
        state.last_reviewed = current_date
        
        if is_correct:
            # Promote
            if state.level < 5: state.level += 1
        else:
            # Demote (Punish)
            state.level = max(1, state.level - 2)
            
        # Leitner Intervals: 1, 3, 7, 14, 30
        intervals = [1, 3, 7, 14, 30]
        days_to_add = intervals[state.level - 1]
        
        # Add slight fuzz to interval (humans don't review at exact hour)
        days_to_add += random.uniform(-0.2, 0.5)
        
        state.next_review = current_date + timedelta(days=days_to_add)

    def simulate_day(self, day_offset: int, supabase: Client):
        current_date_base = self.start_date + timedelta(days=day_offset)
        
        # Skip days based on dedication (Weekends, lazy days)
        # Weekday check: 0=Mon, 6=Sun. 
        is_weekend = current_date_base.weekday() >= 5
        skip_chance = (1 - self.dedication) + (0.3 if is_weekend else 0)
        
        if random.random() < skip_chance:
            return # Skip studying today

        # Determine Session Time (Evening vs Morning person)
        if random.random() > 0.5:
            # Evening: 18:00 - 23:00
            hour = random.randint(18, 23)
        else:
            # Morning/Day: 08:00 - 14:00
            hour = random.randint(8, 14)
            
        session_start = current_date_base.replace(hour=hour, minute=random.randint(0, 59))
        
        # Get Terms to Study
        study_queue = self.get_due_terms(session_start)
        if not study_queue:
            return # Nothing due, and no new terms added
            
        # Limit session length (humans get bored)
        # Max 40 terms per session usually
        max_session_terms = random.randint(10, 50)
        study_queue = study_queue[:max_session_terms]
        
        # Shuffle to mix New Terms (hard) with Reviews (easier)
        # This prevents the "20th question cliff" where all new terms appear at the end
        random.shuffle(study_queue)
        
        session_id = str(uuid.uuid4())
        
        # Pre-calculate session stats so we can insert Parent first (FK Constraint)
        actual_attempts_count = len(study_queue)
        duration_seconds = int((actual_attempts_count * 5) + (sum([random.randint(1,4) for _ in range(actual_attempts_count)])))
        session_end = session_start + timedelta(seconds=duration_seconds)

        # 1. Insert SESSION first (Parent)
        session_data = {
            "id": session_id,
            "anonymous_id": self.id,
            "session_start": session_start.isoformat(),
            "session_end": session_end.isoformat(),
            "duration_seconds": duration_seconds,
            "page_views": actual_attempts_count + random.randint(1, 10),
            "quiz_attempts": actual_attempts_count,
            "device_type": self.device,
            "user_agent": self.user_agent,
            "consent_given": True,
            "consent_timestamp": self.start_date.isoformat(),
            "created_at": session_start.isoformat()
        }
        
        try:
             supabase.table("study_sessions").insert(session_data).execute()
             global total_sessions, total_attempts
             total_sessions += 1
             total_attempts += actual_attempts_count
        except Exception as e:
             print(f"❌ Error inserting session: {e}")
             return # If session fails, don't try to insert attempts
        
        # 2. Insert ATTEMPTS (Children)
        session_attempts = 0
        for i, term_id in enumerate(study_queue):
            # Gradual Fatigue: Starts kicking in after question 10
            # Increases by 'fatigue_rate' per question
            fatigue_idx = max(0, i - 10)
            
            is_correct, response_ms = self.calculate_human_response(term_id, fatigue_idx)
            
            # Record Attempt
            attempt_time = session_start + timedelta(seconds=i * (response_ms/1000 + 2))
            
            attempt_data = {
                "user_id": None, 
                "session_id": session_id, 
                "term_id": term_id,
                "is_correct": is_correct,
                "response_time_ms": response_ms,
                "quiz_type": "simulation",
                "created_at": attempt_time.isoformat()
            }
            
            try:
                supabase.table("quiz_attempts").insert(attempt_data).execute()
                self.update_srs(term_id, is_correct, attempt_time)
                session_attempts += 1
            except Exception as e:
                print(f"❌ Error inserting attempt: {e}")
                pass

def clean_db(supabase: Client):
    print("🧹 Cleaning database (removing old simulation data)...")
    try:
        # Delete children first (FK constraint)
        supabase.table("quiz_attempts").delete().eq("quiz_type", "simulation").execute()
        # Delete parents (only those created by bots in this simulation config would be ideal, 
        # but for simplicity in this script we delete based on our bot prefix or just clean all if it's a dev env)
        # Note: supabase-js delete needs a filter. We'll use the fact that our bots have specific IDs or just clean all sessions for safety if user wants a full reset.
        # For safety, let's only delete sessions where anonymous_id starts with 'bot_'
        supabase.table("study_sessions").delete().like("anonymous_id", "bot_%").execute()
        print("✅ Database cleaned.")
    except Exception as e:
        print(f"⚠️ Warning during cleanup: {e}")

def main():
    print(f"🚀 ULTRA SIMULATION STARTED")
    print(f"Configurations:")
    print(f" - Bots: {NUM_BOTS}")
    print(f" - Days: {DAYS_TO_SIMULATE}")
    print(f" - Total Terms Pool: {TOTAL_TERMS}")
    print(f" - Behavior: Human-like (Fatigue, Weekends, Variable Intelligence)")
    
    fake = Faker()
    supabase = init_supabase()
    
    # 0. Clean old data
    clean_db(supabase)
    
    bots = [Bot(fake) for _ in range(NUM_BOTS)]
    
    for day in range(DAYS_TO_SIMULATE):
        print(f"📅 Simulating Day {day+1}/{DAYS_TO_SIMULATE}...", end="\r")
        for bot in bots:
            bot.simulate_day(day, supabase)
            
    print("\n\n✅ Simulation Complete!")
    print(f"Total Sessions Generated: {total_sessions}")
    print(f"Total Quiz Attempts: {total_attempts}")

if __name__ == "__main__":
    main()
