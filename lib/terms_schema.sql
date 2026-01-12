-- ============================================
-- Terms Table Schema
-- Stores static content for the dictionary
-- ============================================

CREATE TABLE IF NOT EXISTS terms (
    id TEXT PRIMARY KEY, -- 'term_001', etc.
    
    -- Content
    term_en TEXT NOT NULL,
    term_ru TEXT NOT NULL,
    term_tr TEXT NOT NULL,
    
    phonetic_en TEXT,
    phonetic_ru TEXT,
    phonetic_tr TEXT,
    
    category TEXT NOT NULL,
    
    definition_en TEXT NOT NULL,
    definition_ru TEXT NOT NULL,
    definition_tr TEXT NOT NULL,
    
    example_sentence_en TEXT NOT NULL,
    example_sentence_ru TEXT NOT NULL,
    example_sentence_tr TEXT NOT NULL,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE terms ENABLE ROW LEVEL SECURITY;

-- Policies
-- Everyone can read terms
DROP POLICY IF EXISTS "Public read access" ON terms;
CREATE POLICY "Public read access"
    ON terms FOR SELECT
    USING (true);

-- Only service role can insert/update (implicit)
