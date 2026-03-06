-- DEPRECATED: superseded by supabase/migrations/20260306170000_phase1_database_unification_lockdown.sql.
-- This migration creates bot-only user state and open access policies that violate the unified data model.

-- FinTechTerms Bot — User Activity Stats Table
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor → New Query)

CREATE TABLE IF NOT EXISTS bot_user_stats (
    telegram_id  BIGINT PRIMARY KEY,
    username     TEXT,
    language     TEXT DEFAULT 'en',
    searches     INTEGER DEFAULT 0,
    quizzes_taken    INTEGER DEFAULT 0,
    quizzes_correct  INTEGER DEFAULT 0,
    terms_viewed     INTEGER DEFAULT 0,
    daily_used       INTEGER DEFAULT 0,
    tts_used         INTEGER DEFAULT 0,
    categories_explored TEXT[] DEFAULT '{}',
    first_seen   TIMESTAMPTZ DEFAULT NOW(),
    last_active  TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE bot_user_stats ENABLE ROW LEVEL SECURITY;

-- Allow the anon key full access (bot operates server-side, not user-facing)
CREATE POLICY "Bot full access" ON bot_user_stats
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_bot_user_stats_last_active
    ON bot_user_stats (last_active DESC);
