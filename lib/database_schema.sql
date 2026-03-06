-- ============================================
-- FinTechTerms Database Schema
-- Run this in Supabase SQL Editor
-- ============================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- User Progress Table
-- Stores user learning progress and preferences
-- ============================================
CREATE TABLE IF NOT EXISTS user_progress (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    favorites TEXT[] DEFAULT '{}',
    current_streak INTEGER DEFAULT 0,
    last_study_date TIMESTAMPTZ,
    total_words_learned INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT user_progress_user_id_unique UNIQUE(user_id)
);

-- ============================================
-- Quiz Attempts Table
-- Records individual quiz answers for analytics
-- ============================================
CREATE TABLE IF NOT EXISTS quiz_attempts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    term_id TEXT NOT NULL,
    is_correct BOOLEAN NOT NULL DEFAULT false,
    response_time_ms INTEGER DEFAULT 0,
    quiz_type TEXT DEFAULT 'daily',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_user_id ON quiz_attempts(user_id);
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_term_id ON quiz_attempts(term_id);

-- ============================================
-- User Term SRS Data
-- Per-user spaced repetition data for each term
-- ============================================
CREATE TABLE IF NOT EXISTS user_term_srs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    term_id TEXT NOT NULL,
    srs_level INTEGER DEFAULT 1,
    next_review_date TIMESTAMPTZ DEFAULT NOW(),
    last_reviewed TIMESTAMPTZ,
    difficulty_score REAL DEFAULT 2.5,
    retention_rate REAL DEFAULT 0,
    times_reviewed INTEGER DEFAULT 0,
    times_correct INTEGER DEFAULT 0,
    CONSTRAINT user_term_srs_unique UNIQUE(user_id, term_id)
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_user_term_srs_user_id ON user_term_srs(user_id);
CREATE INDEX IF NOT EXISTS idx_user_term_srs_next_review ON user_term_srs(next_review_date);

-- ============================================
-- Row Level Security (RLS) Policies
-- Ensures users can only access their own data
-- ============================================

-- Enable RLS on all tables
ALTER TABLE user_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_term_srs ENABLE ROW LEVEL SECURITY;

-- User Progress Policies
DROP POLICY IF EXISTS "Users can view own progress" ON user_progress;
CREATE POLICY "Users can view own progress"
    ON user_progress FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own progress" ON user_progress;
CREATE POLICY "Users can insert own progress"
    ON user_progress FOR INSERT
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own progress" ON user_progress;
CREATE POLICY "Users can update own progress"
    ON user_progress FOR UPDATE
    USING (auth.uid() = user_id);

-- Quiz Attempts Policies
DROP POLICY IF EXISTS "Users can view own quiz attempts" ON quiz_attempts;
CREATE POLICY "Users can view own quiz attempts"
    ON quiz_attempts FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own quiz attempts" ON quiz_attempts;
CREATE POLICY "Users can insert own quiz attempts"
    ON quiz_attempts FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- User Term SRS Policies
DROP POLICY IF EXISTS "Users can view own SRS data" ON user_term_srs;
CREATE POLICY "Users can view own SRS data"
    ON user_term_srs FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own SRS data" ON user_term_srs;
CREATE POLICY "Users can insert own SRS data"
    ON user_term_srs FOR INSERT
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own SRS data" ON user_term_srs;
CREATE POLICY "Users can update own SRS data"
    ON user_term_srs FOR UPDATE
    USING (auth.uid() = user_id);

-- ============================================
-- Auto-update updated_at trigger
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_user_progress_updated_at ON user_progress;
CREATE TRIGGER update_user_progress_updated_at
    BEFORE UPDATE ON user_progress
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- User Achievements Table (Gamification)
-- Tracks user badges and milestones
-- ============================================
CREATE TABLE IF NOT EXISTS user_achievements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    achievement_type TEXT NOT NULL, -- '7_day_streak', 'first_100_words', 'all_categories_mastered', etc.
    earned_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT user_achievements_unique UNIQUE(user_id, achievement_type)
);

CREATE INDEX IF NOT EXISTS idx_user_achievements_user_id ON user_achievements(user_id);

-- ============================================
-- User Settings Table (Preferences Sync)
-- Stores user preferences across devices
-- ============================================
CREATE TABLE IF NOT EXISTS user_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    preferred_language TEXT DEFAULT 'ru', -- 'ru', 'en', 'tr'
    theme TEXT DEFAULT 'system', -- 'light', 'dark', 'system'
    daily_goal INTEGER DEFAULT 10, -- Daily word goal
    notification_enabled BOOLEAN DEFAULT true,
    sound_enabled BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT user_settings_user_id_unique UNIQUE(user_id)
);

-- ============================================
-- Daily Learning Log Table (Analytics)
-- Tracks daily learning statistics for graphs
-- ============================================
CREATE TABLE IF NOT EXISTS daily_learning_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    log_date DATE NOT NULL DEFAULT CURRENT_DATE,
    words_reviewed INTEGER DEFAULT 0,
    words_correct INTEGER DEFAULT 0,
    words_incorrect INTEGER DEFAULT 0,
    new_words_learned INTEGER DEFAULT 0,
    time_spent_seconds INTEGER DEFAULT 0,
    session_count INTEGER DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT daily_learning_log_unique UNIQUE(user_id, log_date)
);

CREATE INDEX IF NOT EXISTS idx_daily_learning_log_user_id ON daily_learning_log(user_id);
CREATE INDEX IF NOT EXISTS idx_daily_learning_log_date ON daily_learning_log(log_date);

-- ============================================
-- Enable RLS on new tables
-- ============================================
ALTER TABLE user_achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_learning_log ENABLE ROW LEVEL SECURITY;

-- ============================================
-- User Achievements Policies
-- ============================================
DROP POLICY IF EXISTS "Users can view own achievements" ON user_achievements;
CREATE POLICY "Users can view own achievements"
    ON user_achievements FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own achievements" ON user_achievements;
CREATE POLICY "Users can insert own achievements"
    ON user_achievements FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- ============================================
-- User Settings Policies
-- ============================================
DROP POLICY IF EXISTS "Users can view own settings" ON user_settings;
CREATE POLICY "Users can view own settings"
    ON user_settings FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own settings" ON user_settings;
CREATE POLICY "Users can insert own settings"
    ON user_settings FOR INSERT
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own settings" ON user_settings;
CREATE POLICY "Users can update own settings"
    ON user_settings FOR UPDATE
    USING (auth.uid() = user_id);

-- ============================================
-- Daily Learning Log Policies
-- ============================================
DROP POLICY IF EXISTS "Users can view own daily logs" ON daily_learning_log;
CREATE POLICY "Users can view own daily logs"
    ON daily_learning_log FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own daily logs" ON daily_learning_log;
CREATE POLICY "Users can insert own daily logs"
    ON daily_learning_log FOR INSERT
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own daily logs" ON daily_learning_log;
CREATE POLICY "Users can update own daily logs"
    ON daily_learning_log FOR UPDATE
    USING (auth.uid() = user_id);

-- ============================================
-- Auto-update triggers for new tables
-- ============================================
DROP TRIGGER IF EXISTS update_user_settings_updated_at ON user_settings;
CREATE TRIGGER update_user_settings_updated_at
    BEFORE UPDATE ON user_settings
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_daily_learning_log_updated_at ON daily_learning_log;
CREATE TRIGGER update_daily_learning_log_updated_at
    BEFORE UPDATE ON daily_learning_log
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- Contest-Ready Term Taxonomy & Academic Decks
-- ============================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_type t
        JOIN pg_namespace n
            ON n.oid = t.typnamespace
        WHERE t.typname = 'regional_market'
          AND n.nspname = 'public'
    ) THEN
        CREATE TYPE public.regional_market AS ENUM ('MOEX', 'BIST', 'GLOBAL');
    END IF;
END
$$;

ALTER TABLE terms
    ADD COLUMN IF NOT EXISTS context_tags JSONB NOT NULL DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS regional_market public.regional_market NOT NULL DEFAULT 'GLOBAL';

ALTER TABLE terms
    DROP CONSTRAINT IF EXISTS terms_context_tags_object_check;

ALTER TABLE terms
    ADD CONSTRAINT terms_context_tags_object_check
    CHECK (jsonb_typeof(context_tags) = 'object');

CREATE INDEX IF NOT EXISTS idx_terms_regional_market
    ON terms (regional_market);

CREATE INDEX IF NOT EXISTS idx_terms_context_tags
    ON terms
    USING GIN (context_tags jsonb_path_ops);

CREATE TABLE IF NOT EXISTS academic_decks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    slug TEXT NOT NULL UNIQUE,
    title_ru TEXT NOT NULL,
    title_en TEXT NOT NULL,
    title_tr TEXT NOT NULL,
    description_ru TEXT NOT NULL,
    description_en TEXT NOT NULL,
    description_tr TEXT NOT NULL,
    program_track TEXT NOT NULL,
    target_universities TEXT[] NOT NULL DEFAULT '{}'::text[],
    focus_markets public.regional_market[] NOT NULL DEFAULT ARRAY['GLOBAL'::public.regional_market],
    context_profile JSONB NOT NULL DEFAULT '{}'::jsonb,
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT academic_decks_program_track_check CHECK (
        program_track IN ('Economics', 'MIS', 'Finance', 'Cross-disciplinary')
    ),
    CONSTRAINT academic_decks_focus_markets_nonempty CHECK (
        coalesce(array_length(focus_markets, 1), 0) > 0
    ),
    CONSTRAINT academic_decks_context_profile_object_check CHECK (
        jsonb_typeof(context_profile) = 'object'
    )
);

CREATE TABLE IF NOT EXISTS academic_deck_terms (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    deck_id UUID NOT NULL REFERENCES academic_decks(id) ON DELETE CASCADE,
    term_id TEXT NOT NULL REFERENCES terms(id) ON DELETE CASCADE,
    sort_order INTEGER NOT NULL DEFAULT 0,
    required_for_track BOOLEAN NOT NULL DEFAULT true,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT academic_deck_terms_unique UNIQUE (deck_id, term_id),
    CONSTRAINT academic_deck_terms_metadata_object_check CHECK (
        jsonb_typeof(metadata) = 'object'
    )
);

CREATE INDEX IF NOT EXISTS idx_academic_decks_program_track_sort
    ON academic_decks (program_track, sort_order, slug);

CREATE INDEX IF NOT EXISTS idx_academic_deck_terms_deck_sort
    ON academic_deck_terms (deck_id, sort_order, term_id);

CREATE INDEX IF NOT EXISTS idx_academic_deck_terms_term_id
    ON academic_deck_terms (term_id);

ALTER TABLE academic_decks ENABLE ROW LEVEL SECURITY;
ALTER TABLE academic_deck_terms ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can read academic decks" ON academic_decks;
CREATE POLICY "Public can read academic decks"
    ON academic_decks FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "Public can read academic deck terms" ON academic_deck_terms;
CREATE POLICY "Public can read academic deck terms"
    ON academic_deck_terms FOR SELECT
    USING (true);

-- ============================================
-- Success message
-- ============================================
SELECT 'Database schema created successfully!' as message;
