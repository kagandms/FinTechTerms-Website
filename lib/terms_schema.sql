-- ============================================
-- Terms Table Schema
-- Stores static content for the dictionary
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

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_type t
        JOIN pg_namespace n
            ON n.oid = t.typnamespace
        WHERE t.typname = 'difficulty_level'
          AND n.nspname = 'public'
    ) THEN
        CREATE TYPE public.difficulty_level AS ENUM ('basic', 'intermediate', 'advanced');
    END IF;
END
$$;

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

    context_tags JSONB NOT NULL DEFAULT '{}'::jsonb,
    regional_market public.regional_market NOT NULL DEFAULT 'GLOBAL',
    is_academic BOOLEAN NOT NULL DEFAULT true,
    difficulty_level public.difficulty_level NOT NULL DEFAULT 'intermediate',
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT terms_context_tags_object_check CHECK (
        jsonb_typeof(context_tags) = 'object'
    )
);

CREATE INDEX IF NOT EXISTS idx_terms_regional_market
    ON terms (regional_market);

CREATE INDEX IF NOT EXISTS idx_terms_context_tags
    ON terms
    USING GIN (context_tags jsonb_path_ops);

CREATE INDEX IF NOT EXISTS idx_terms_is_academic
    ON terms (is_academic);

CREATE INDEX IF NOT EXISTS idx_terms_difficulty_level
    ON terms (difficulty_level);

-- Enable RLS
ALTER TABLE terms ENABLE ROW LEVEL SECURITY;

-- Policies
-- Everyone can read terms
DROP POLICY IF EXISTS "Public read access" ON terms;
CREATE POLICY "Public read access"
    ON terms FOR SELECT
    USING (true);

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT USAGE ON TYPE public.difficulty_level TO anon, authenticated, service_role;
GRANT USAGE ON TYPE public.regional_market TO anon, authenticated, service_role;
GRANT SELECT ON public.terms TO anon, authenticated;
GRANT ALL PRIVILEGES ON public.terms TO service_role;

-- ============================================
-- Academic Decks for Russian-First Applicants
-- ============================================

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

CREATE INDEX IF NOT EXISTS idx_academic_decks_program_track_sort
    ON academic_decks (program_track, sort_order, slug);

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

GRANT SELECT ON public.academic_decks TO anon, authenticated;
GRANT SELECT ON public.academic_deck_terms TO anon, authenticated;
GRANT ALL PRIVILEGES ON public.academic_decks TO service_role;
GRANT ALL PRIVILEGES ON public.academic_deck_terms TO service_role;
