// ============================================
// GlobalFinTerm - Type Definitions
// Supabase-Ready Data Models
// ============================================

export type Language = 'tr' | 'en' | 'ru';

export type Category = 'Fintech' | 'Economics' | 'Computer Science';

/**
 * Main Term interface - represents a trilingual dictionary entry
 * Structured for Supabase PostgreSQL compatibility
 */
export interface Term {
    id: string;

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
