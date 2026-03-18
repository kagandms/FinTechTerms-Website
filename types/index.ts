// ============================================
// GlobalFinTerm - Type Definitions
// Supabase-Ready Data Models
// ============================================

export type Language = 'tr' | 'en' | 'ru';

export type Category = 'Fintech' | 'Finance' | 'Technology';
export type RegionalMarket = 'MOEX' | 'BIST' | 'GLOBAL';
export type DifficultyLevel = 'basic' | 'intermediate' | 'advanced';
export type ContributorKind = 'person' | 'organization';
export type ContributorRole = 'author' | 'reviewer';
export type SourceType = 'documentation' | 'regulation' | 'research' | 'glossary';
export type TermIndexPriority = 'high' | 'standard' | 'supporting';
export type EditorialStatus = 'planned' | 'draft' | 'review' | 'published';
export type PriorityTermTier = 'anchor' | 'supporting';
export type TopicId =
    | 'cards-payments'
    | 'open-banking'
    | 'regtech-compliance'
    | 'crypto-infrastructure'
    | 'rwa-tokenization'
    | 'market-microstructure'
    | 'fraud-identity-security'
    | 'ai-data-finance';
export type TermContextTagValue =
    | string
    | number
    | boolean
    | string[]
    | number[]
    | boolean[];
export type TermContextTags = Record<string, TermContextTagValue | undefined>;

export interface LocalizedText {
    en: string;
    ru: string;
    tr: string;
}

export interface SourceRef {
    id: string;
    title: LocalizedText;
    publisher: string;
    url: string;
    type: SourceType;
    note: LocalizedText;
    last_verified: string;
}

export interface Contributor {
    id: string;
    slug: string;
    updated_at: string;
    kind: ContributorKind;
    role: ContributorRole;
    name: string;
    title: LocalizedText;
    bio: LocalizedText;
    disclosure: LocalizedText;
    languages: readonly Language[];
    expertise: readonly string[];
    organization: string;
    email: string;
}

export interface Topic {
    id: TopicId;
    slug: string;
    updated_at: string;
    title: LocalizedText;
    description: LocalizedText;
    hero: LocalizedText;
    relatedTopicIds: readonly string[];
    sourceIds: readonly string[];
    priorityTermSlugs: readonly string[];
    sections: readonly {
        title: LocalizedText;
        body: LocalizedText;
    }[];
}

export interface PriorityTermRecord {
    slug: string;
    topicId: TopicId;
    tier: PriorityTermTier;
    locales: Record<Language, EditorialStatus>;
    requiredSourceIds: readonly string[];
    relatedSlugs: readonly string[];
    comparisonSlug: string | null;
    prerequisiteSlug: string | null;
    regionalMarkets: readonly RegionalMarket[];
}

export interface AuthorityTarget {
    id: string;
    name: string;
    channel: 'academic' | 'media' | 'community' | 'owned';
    targetUrl: string;
    rationale: string;
    status: 'planned' | 'contacted' | 'published';
}

/**
 * Canonical profile row mirrored from public.profiles.
 * Authentication identity remains keyed by auth.users.id.
 */
export interface Profile {
    id: string;
    full_name: string | null;
    birth_date: string | null;
}

/**
 * Main Term interface - represents a trilingual dictionary entry
 * Structured for Supabase PostgreSQL compatibility
 */
export interface Term {
    id: string;
    slug: string;

    // Trilingual Terms
    term_en: string;
    term_ru: string;
    term_tr: string;

    // Phonetic pronunciation (IPA or simplified)
    phonetic_en?: string;
    phonetic_ru?: string;
    phonetic_tr?: string;

    // Category classification
    category: Category;

    // Trilingual Definitions
    definition_en: string;
    definition_ru: string;
    definition_tr: string;

    // Context/Example Sentences
    example_sentence_en: string;
    example_sentence_ru: string;
    example_sentence_tr: string;

    short_definition: LocalizedText;
    expanded_definition: LocalizedText;
    why_it_matters: LocalizedText;
    how_it_works: LocalizedText;
    risks_and_pitfalls: LocalizedText;
    regional_notes: LocalizedText;
    seo_title: LocalizedText;
    seo_description: LocalizedText;

    // Contest-ready academic taxonomy
    context_tags: TermContextTags;
    regional_markets: readonly RegionalMarket[];
    primary_market: RegionalMarket;
    /**
     * Backward-compatible mirror for legacy app-shell components.
     * Prefer primary_market + regional_markets in new code.
     */
    regional_market: RegionalMarket;
    is_academic: boolean;
    difficulty_level: DifficultyLevel;
    related_term_ids: readonly string[];
    comparison_term_id: string | null;
    prerequisite_term_id: string | null;
    topic_ids: readonly string[];
    source_refs: readonly string[];
    author_id: string;
    reviewer_id: string;
    reviewed_at: string;
    updated_at: string;
    index_priority: TermIndexPriority;

    // ============================================
    // SRS (Spaced Repetition System) Data
    // ============================================
    srs_level: number;           // Leitner box (1-5)
    next_review_date: string;    // ISO Date string
    last_reviewed: string | null; // ISO Date string

    // ============================================
    // Analytics Data (For Academic Research)
    // ============================================
    difficulty_score: number;    // 0-5 scale, dynamic
    retention_rate: number;      // 0-1 (percentage as decimal)
    times_reviewed: number;      // Total review count
    times_correct: number;       // Correct answer count
}

/**
 * User's learning progress and preferences
 */
export interface UserProgress {
    user_id: string;
    favorites: string[];         // Term IDs
    current_language: Language;
    quiz_history: QuizAttempt[];
    total_words_learned: number;
    current_streak: number;      // Days in a row
    last_study_date: string | null;
    created_at: string;
    updated_at: string;
}

/**
 * Individual quiz attempt record
 */
export interface QuizAttempt {
    id: string;
    term_id: string;
    is_correct: boolean;
    response_time_ms: number;    // For analytics
    timestamp: string;
    quiz_type: 'daily' | 'practice' | 'review';
}

/**
 * SRS calculation result
 */
export interface SRSResult {
    newLevel: number;
    nextReviewDate: Date;
    difficultyDelta: number;
    retentionRateChange: number;
}

/**
 * Daily review statistics
 */
export interface DailyStats {
    dueCount: number;
    completedToday: number;
    accuracy: number;
    streak: number;
}

/**
 * Search result with matched field info
 */
export interface SearchResult {
    term: Term;
    matchedField: 'term_en' | 'term_ru' | 'term_tr' | 'definition_en' | 'definition_ru' | 'definition_tr';
    relevanceScore: number;
}

/**
 * App-wide translations structure
 */
export interface Translations {
    common: {
        search: string;
        home: string;
        quiz: string;
        profile: string;
        favorites: string;
        settings: string;
    };
    home: {
        welcomeTitle: string;
        dailyReview: string;
        dueToday: string;
        startQuiz: string;
        noCardsDue: string;
        recentTerms: string;
    };
    search: {
        placeholder: string;
        noResults: string;
        categories: string;
    };
    quiz: {
        title: string;
        showAnswer: string;
        knew: string;
        didntKnow: string;
        complete: string;
        nextReview: string;
    };
    card: {
        listen: string;
        addFavorite: string;
        removeFavorite: string;
        category: string;
        example: string;
    };
    profile: {
        statistics: string;
        wordsLearned: string;
        currentStreak: string;
        accuracy: string;
        totalReviews: string;
    };
}
