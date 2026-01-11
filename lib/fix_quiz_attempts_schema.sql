-- ============================================
-- Fix for Anonymous Research Data
-- Allows quiz_attempts to record anonymous data
-- ============================================

-- Make user_id nullable in quiz_attempts table
ALTER TABLE quiz_attempts ALTER COLUMN user_id DROP NOT NULL;

-- Optionally, you can add an anonymous_id column to link to study_sessions if needed
-- ALTER TABLE quiz_attempts ADD COLUMN IF NOT EXISTS anonymous_id TEXT;
