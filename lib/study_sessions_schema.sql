-- ============================================
-- Study Sessions Table for Academic Research
-- Add this to your existing database_schema.sql
-- Run in Supabase SQL Editor
-- ============================================

-- ============================================
-- Study Sessions Table
-- Tracks user sessions for academic analysis
-- ============================================
CREATE TABLE IF NOT EXISTS study_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- User identification (one of these should be populated)
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    anonymous_id TEXT,
    
    -- Session timing
    session_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    session_end TIMESTAMPTZ,
    duration_seconds INTEGER DEFAULT 0,
    
    -- Activity metrics
    page_views INTEGER DEFAULT 1,
    quiz_attempts INTEGER DEFAULT 0,
    
    -- Device information
    device_type TEXT CHECK (device_type IN ('mobile', 'tablet', 'desktop', 'unknown')),
    user_agent TEXT,
    
    -- Consent tracking (GDPR/Ethics compliance)
    consent_given BOOLEAN DEFAULT false,
    consent_timestamp TIMESTAMPTZ,
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_study_sessions_user_id ON study_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_study_sessions_anonymous_id ON study_sessions(anonymous_id);
CREATE INDEX IF NOT EXISTS idx_study_sessions_start ON study_sessions(session_start);
-- Index on session_start is sufficient for range queries
-- CREATE INDEX IF NOT EXISTS idx_study_sessions_date ON study_sessions(DATE(session_start));

-- Enable Row Level Security
ALTER TABLE study_sessions ENABLE ROW LEVEL SECURITY;

-- ============================================
-- RLS Policies for study_sessions
-- ============================================

-- Users can view their own sessions
DROP POLICY IF EXISTS "Users can view own sessions" ON study_sessions;
CREATE POLICY "Users can view own sessions"
    ON study_sessions FOR SELECT
    USING (
        auth.uid() = user_id 
        OR (user_id IS NULL AND anonymous_id IS NOT NULL)
    );

-- Anyone can insert sessions (for anonymous tracking)
DROP POLICY IF EXISTS "Anyone can insert sessions" ON study_sessions;
CREATE POLICY "Anyone can insert sessions"
    ON study_sessions FOR INSERT
    WITH CHECK (true);

-- Users can update their own sessions
DROP POLICY IF EXISTS "Users can update own sessions" ON study_sessions;
CREATE POLICY "Users can update own sessions"
    ON study_sessions FOR UPDATE
    USING (
        auth.uid() = user_id 
        OR (user_id IS NULL AND anonymous_id IS NOT NULL)
    );

-- ============================================
-- Analytical Views (for research queries)
-- ============================================

-- View: Daily session statistics
CREATE OR REPLACE VIEW daily_session_stats AS
SELECT 
    DATE(session_start) as study_date,
    COUNT(*) as total_sessions,
    COUNT(DISTINCT COALESCE(user_id::text, anonymous_id)) as unique_users,
    AVG(duration_seconds) as avg_duration_seconds,
    SUM(page_views) as total_page_views,
    SUM(quiz_attempts) as total_quiz_attempts,
    COUNT(CASE WHEN device_type = 'mobile' THEN 1 END) as mobile_sessions,
    COUNT(CASE WHEN device_type = 'desktop' THEN 1 END) as desktop_sessions,
    COUNT(CASE WHEN device_type = 'tablet' THEN 1 END) as tablet_sessions
FROM study_sessions
WHERE consent_given = true
GROUP BY DATE(session_start)
ORDER BY study_date DESC;

-- View: Quiz performance by term
CREATE OR REPLACE VIEW term_performance_stats AS
SELECT 
    term_id,
    COUNT(*) as total_attempts,
    SUM(CASE WHEN is_correct THEN 1 ELSE 0 END) as correct_count,
    ROUND(AVG(CASE WHEN is_correct THEN 1.0 ELSE 0.0 END) * 100, 2) as accuracy_percent,
    AVG(response_time_ms) as avg_response_time_ms,
    MIN(response_time_ms) as min_response_time_ms,
    MAX(response_time_ms) as max_response_time_ms,
    STDDEV(response_time_ms) as stddev_response_time_ms
FROM quiz_attempts
GROUP BY term_id
ORDER BY total_attempts DESC;

-- View: User learning progress
CREATE OR REPLACE VIEW user_learning_stats AS
SELECT 
    COALESCE(user_id::text, 'anonymous') as user_identifier,
    COUNT(*) as total_quiz_attempts,
    SUM(CASE WHEN is_correct THEN 1 ELSE 0 END) as correct_answers,
    ROUND(AVG(CASE WHEN is_correct THEN 1.0 ELSE 0.0 END) * 100, 2) as overall_accuracy,
    AVG(response_time_ms) as avg_response_time_ms,
    COUNT(DISTINCT term_id) as unique_terms_practiced,
    MIN(created_at) as first_attempt,
    MAX(created_at) as last_attempt
FROM quiz_attempts
GROUP BY COALESCE(user_id::text, 'anonymous')
ORDER BY total_quiz_attempts DESC;

-- ============================================
-- Success message
-- ============================================
SELECT 'Study Sessions schema created successfully!' as message;
