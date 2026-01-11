
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
SUPABASE_URL = os.environ.get("SUPABASE_URL", "https://hdhytostmmrvwuluogpq.supabase.co")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY", "sb_secret_fju53ntrI24ye_B00RX3CA_KBanYNHF")

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

    def calculate_human_response(self, term_id: str, is_fatigued: bool) -> tuple[bool, int]:
        state = self.term_states[term_id]
        
        # Base probability calculation based on SRS Level
        # Level 1: 50%, Level 5: 95%
        base_correct_prob = 0.5 + (state.level * 0.1) 
        
        # Adjust for user intelligence and term difficulty bias
        adjusted_prob = base_correct_prob * self.intelligence / state.difficulty_bias
        
        # Fatigue penalty
        if is_fatigued:
            adjusted_prob -= 0.15
            
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
        
        session_id = str(uuid.uuid4())
        session_attempts = 0
        
        for i, term_id in enumerate(study_queue):
            # Fatigue Check
            is_fatigued = i > 15 # After 15 cards, fatigue starts setting in
            
            is_correct, response_ms = self.calculate_human_response(term_id, is_fatigued)
            
            # Record Attempt
            attempt_time = session_start + timedelta(seconds=session_attempts * (response_ms/1000 + 2))
            
            attempt_data = {
                "user_id": None, # Maps to anonymous user
                "session_id": session_id, # Link to session for analytics
                "term_id": term_id,
                "is_correct": is_correct,
                "response_time_ms": response_ms,
                "quiz_type": "simulation",
                "created_at": attempt_time.isoformat()
            }
            
            try:
                # Batch insert is better but row-by-row for simplicity in logic
                supabase.table("quiz_attempts").insert(attempt_data).execute()
                
                # Update Internal Memory
                self.update_srs(term_id, is_correct, attempt_time)
                
                session_attempts += 1
                
            except Exception as e:
                pass # Ignore occasional DB glitches

        # Log Session
        if session_attempts > 0:
            duration_seconds = int((session_attempts * 5) + (sum([random.randint(1,4) for _ in range(session_attempts)]))) 
            
            session_data = {
                "id": session_id,
                "anonymous_id": self.id,
                "session_start": session_start.isoformat(),
                "session_end": (session_start + timedelta(seconds=duration_seconds)).isoformat(),
                "duration_seconds": duration_seconds,
                "page_views": session_attempts + random.randint(1, 10),
                "quiz_attempts": session_attempts,
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
                total_attempts += session_attempts
            except:
                pass

def main():
    print(f"🚀 ULTRA SIMULATION STARTED")
    print(f"Configurations:")
    print(f" - Bots: {NUM_BOTS}")
    print(f" - Days: {DAYS_TO_SIMULATE}")
    print(f" - Total Terms Pool: {TOTAL_TERMS}")
    print(f" - Behavior: Human-like (Fatigue, Weekends, Variable Intelligence)")
    
    fake = Faker()
    supabase = init_supabase()
    
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
