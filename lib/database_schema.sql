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
-- Success message
-- ============================================
SELECT 'Database schema created successfully!' as message;
