export type Json =
    | string
    | number
    | boolean
    | null
    | { [key: string]: Json | undefined }
    | Json[]

export interface Database {
    public: {
        Tables: {
            profiles: {
                Row: {
                    id: string
                    full_name: string | null
                    birth_date: string | null
                }
                Insert: {
                    id: string
                    full_name?: string | null
                    birth_date?: string | null
                }
                Update: {
                    id?: string
                    full_name?: string | null
                    birth_date?: string | null
                }
                Relationships: []
            }
            terms: {
                Row: {
                    id: string
                    term_en: string
                    term_ru: string
                    term_tr: string
                    phonetic_en: string | null
                    phonetic_ru: string | null
                    phonetic_tr: string | null
                    category: string
                    definition_en: string
                    definition_ru: string
                    definition_tr: string
                    example_sentence_en: string
                    example_sentence_ru: string
                    example_sentence_tr: string
                    context_tags: Json
                    regional_market: "MOEX" | "BIST" | "GLOBAL"
                    is_academic: boolean
                    difficulty_level: "basic" | "intermediate" | "advanced"
                    created_at: string | null
                    updated_at: string | null
                }
                Insert: {
                    id?: string
                    term_en: string
                    term_ru: string
                    term_tr: string
                    phonetic_en?: string | null
                    phonetic_ru?: string | null
                    phonetic_tr?: string | null
                    category: string
                    definition_en: string
                    definition_ru: string
                    definition_tr: string
                    example_sentence_en: string
                    example_sentence_ru: string
                    example_sentence_tr: string
                    context_tags?: Json
                    regional_market?: "MOEX" | "BIST" | "GLOBAL"
                    is_academic?: boolean
                    difficulty_level?: "basic" | "intermediate" | "advanced"
                    created_at?: string | null
                    updated_at?: string | null
                }
                Update: {
                    id?: string
                    term_en?: string
                    term_ru?: string
                    term_tr?: string
                    phonetic_en?: string | null
                    phonetic_ru?: string | null
                    phonetic_tr?: string | null
                    category?: string
                    definition_en?: string
                    definition_ru?: string
                    definition_tr?: string
                    example_sentence_en?: string
                    example_sentence_ru?: string
                    example_sentence_tr?: string
                    context_tags?: Json
                    regional_market?: "MOEX" | "BIST" | "GLOBAL"
                    is_academic?: boolean
                    difficulty_level?: "basic" | "intermediate" | "advanced"
                    created_at?: string | null
                    updated_at?: string | null
                }
                Relationships: []
            }
            academic_decks: {
                Row: {
                    id: string
                    slug: string
                    title_ru: string
                    title_en: string
                    title_tr: string
                    description_ru: string
                    description_en: string
                    description_tr: string
                    program_track: string
                    target_universities: string[]
                    focus_markets: Array<"MOEX" | "BIST" | "GLOBAL">
                    context_profile: Json
                    sort_order: number
                    is_active: boolean
                    created_at: string
                    updated_at: string
                }
                Insert: {
                    id?: string
                    slug: string
                    title_ru: string
                    title_en: string
                    title_tr: string
                    description_ru: string
                    description_en: string
                    description_tr: string
                    program_track: string
                    target_universities?: string[]
                    focus_markets?: Array<"MOEX" | "BIST" | "GLOBAL">
                    context_profile?: Json
                    sort_order?: number
                    is_active?: boolean
                    created_at?: string
                    updated_at?: string
                }
                Update: {
                    id?: string
                    slug?: string
                    title_ru?: string
                    title_en?: string
                    title_tr?: string
                    description_ru?: string
                    description_en?: string
                    description_tr?: string
                    program_track?: string
                    target_universities?: string[]
                    focus_markets?: Array<"MOEX" | "BIST" | "GLOBAL">
                    context_profile?: Json
                    sort_order?: number
                    is_active?: boolean
                    created_at?: string
                    updated_at?: string
                }
                Relationships: []
            }
            academic_deck_terms: {
                Row: {
                    id: string
                    deck_id: string
                    term_id: string
                    sort_order: number
                    required_for_track: boolean
                    metadata: Json
                    created_at: string
                }
                Insert: {
                    id?: string
                    deck_id: string
                    term_id: string
                    sort_order?: number
                    required_for_track?: boolean
                    metadata?: Json
                    created_at?: string
                }
                Update: {
                    id?: string
                    deck_id?: string
                    term_id?: string
                    sort_order?: number
                    required_for_track?: boolean
                    metadata?: Json
                    created_at?: string
                }
                Relationships: [
                    {
                        foreignKeyName: "academic_deck_terms_deck_id_fkey"
                        columns: ["deck_id"]
                        isOneToOne: false
                        referencedRelation: "academic_decks"
                        referencedColumns: ["id"]
                    },
                    {
                        foreignKeyName: "academic_deck_terms_term_id_fkey"
                        columns: ["term_id"]
                        isOneToOne: false
                        referencedRelation: "terms"
                        referencedColumns: ["id"]
                    }
                ]
            }
            user_progress: {
                Row: {
                    id: string
                    user_id: string
                    favorites: string[]
                    current_streak: number
                    last_study_date: string | null
                    total_words_learned: number
                    created_at: string
                    updated_at: string
                }
                Insert: {
                    id?: string
                    user_id: string
                    favorites?: string[]
                    current_streak?: number
                    last_study_date?: string | null
                    total_words_learned?: number
                    created_at?: string
                    updated_at?: string
                }
                Update: {
                    id?: string
                    user_id?: string
                    favorites?: string[]
                    current_streak?: number
                    last_study_date?: string | null
                    total_words_learned?: number
                    created_at?: string
                    updated_at?: string
                }
                Relationships: [
                    {
                        foreignKeyName: "user_progress_user_id_fkey"
                        columns: ["user_id"]
                        isOneToOne: true
                        referencedRelation: "users"
                        referencedColumns: ["id"]
                    }
                ]
            }
            quiz_attempts: {
                Row: {
                    id: string
                    user_id: string
                    term_id: string
                    is_correct: boolean
                    response_time_ms: number
                    quiz_type: string
                    created_at: string
                }
                Insert: {
                    id?: string
                    user_id: string
                    term_id: string
                    is_correct: boolean
                    response_time_ms: number
                    quiz_type: string
                    created_at?: string
                }
                Update: {
                    id?: string
                    user_id?: string
                    term_id?: string
                    is_correct?: boolean
                    response_time_ms?: number
                    quiz_type?: string
                    created_at?: string
                }
                Relationships: [
                    {
                        foreignKeyName: "quiz_attempts_user_id_fkey"
                        columns: ["user_id"]
                        isOneToOne: false
                        referencedRelation: "users"
                        referencedColumns: ["id"]
                    }
                ]
            }
            user_term_srs: {
                Row: {
                    id: string
                    user_id: string
                    term_id: string
                    srs_level: number
                    next_review_date: string | null
                    last_reviewed: string | null
                    difficulty_score: number
                    retention_rate: number
                    times_reviewed: number
                    times_correct: number
                }
                Insert: {
                    id?: string
                    user_id: string
                    term_id: string
                    srs_level?: number
                    next_review_date?: string | null
                    last_reviewed?: string | null
                    difficulty_score?: number
                    retention_rate?: number
                    times_reviewed?: number
                    times_correct?: number
                }
                Update: {
                    id?: string
                    user_id?: string
                    term_id?: string
                    srs_level?: number
                    next_review_date?: string | null
                    last_reviewed?: string | null
                    difficulty_score?: number
                    retention_rate?: number
                    times_reviewed?: number
                    times_correct?: number
                }
                Relationships: [
                    {
                        foreignKeyName: "user_term_srs_user_id_fkey"
                        columns: ["user_id"]
                        isOneToOne: false
                        referencedRelation: "users"
                        referencedColumns: ["id"]
                    }
                ]
            }
            user_achievements: {
                Row: {
                    id: string
                    user_id: string
                    achievement_type: string
                    earned_at: string
                }
                Insert: {
                    id?: string
                    user_id: string
                    achievement_type: string
                    earned_at?: string
                }
                Update: {
                    id?: string
                    user_id?: string
                    achievement_type?: string
                    earned_at?: string
                }
                Relationships: [
                    {
                        foreignKeyName: "user_achievements_user_id_fkey"
                        columns: ["user_id"]
                        isOneToOne: false
                        referencedRelation: "users"
                        referencedColumns: ["id"]
                    }
                ]
            }
            user_settings: {
                Row: {
                    id: string
                    user_id: string
                    preferred_language: 'tr' | 'en' | 'ru'
                    theme: 'light' | 'dark' | 'system'
                    daily_goal: number
                    notification_enabled: boolean
                    sound_enabled: boolean
                    created_at: string
                    updated_at: string
                }
                Insert: {
                    id?: string
                    user_id: string
                    preferred_language?: 'tr' | 'en' | 'ru'
                    theme?: 'light' | 'dark' | 'system'
                    daily_goal?: number
                    notification_enabled?: boolean
                    sound_enabled?: boolean
                    created_at?: string
                    updated_at?: string
                }
                Update: {
                    id?: string
                    user_id?: string
                    preferred_language?: 'tr' | 'en' | 'ru'
                    theme?: 'light' | 'dark' | 'system'
                    daily_goal?: number
                    notification_enabled?: boolean
                    sound_enabled?: boolean
                    created_at?: string
                    updated_at?: string
                }
                Relationships: [
                    {
                        foreignKeyName: "user_settings_user_id_fkey"
                        columns: ["user_id"]
                        isOneToOne: true
                        referencedRelation: "users"
                        referencedColumns: ["id"]
                    }
                ]
            }
            daily_learning_logs: {
                Row: {
                    id: string
                    user_id: string
                    log_date: string
                    words_reviewed: number
                    words_correct: number
                    words_incorrect: number
                    new_words_learned: number
                    time_spent_seconds: number
                    time_spent_ms: number
                    session_count: number
                    created_at: string
                    updated_at: string
                }
                Insert: {
                    id?: string
                    user_id: string
                    log_date?: string
                    words_reviewed?: number
                    words_correct?: number
                    words_incorrect?: number
                    new_words_learned?: number
                    time_spent_seconds?: number
                    time_spent_ms?: number
                    session_count?: number
                    created_at?: string
                    updated_at?: string
                }
                Update: {
                    id?: string
                    user_id?: string
                    log_date?: string
                    words_reviewed?: number
                    words_correct?: number
                    words_incorrect?: number
                    new_words_learned?: number
                    time_spent_seconds?: number
                    time_spent_ms?: number
                    session_count?: number
                    created_at?: string
                    updated_at?: string
                }
                Relationships: [
                    {
                        foreignKeyName: "daily_learning_logs_user_id_fkey"
                        columns: ["user_id"]
                        isOneToOne: false
                        referencedRelation: "users"
                        referencedColumns: ["id"]
                    }
                ]
            }
            user_badges: {
                Row: {
                    id: string
                    user_id: string
                    badge_key: string
                    badge_type: string
                    streak_days: number | null
                    unlocked_at: string
                    source_log_date: string | null
                    metadata: Json
                }
                Insert: {
                    id?: string
                    user_id: string
                    badge_key: string
                    badge_type?: string
                    streak_days?: number | null
                    unlocked_at?: string
                    source_log_date?: string | null
                    metadata?: Json
                }
                Update: {
                    id?: string
                    user_id?: string
                    badge_key?: string
                    badge_type?: string
                    streak_days?: number | null
                    unlocked_at?: string
                    source_log_date?: string | null
                    metadata?: Json
                }
                Relationships: [
                    {
                        foreignKeyName: "user_badges_user_id_fkey"
                        columns: ["user_id"]
                        isOneToOne: false
                        referencedRelation: "users"
                        referencedColumns: ["id"]
                    }
                ]
            }
            daily_learning_log: {
                Row: {
                    id: string
                    user_id: string
                    log_date: string
                    words_reviewed: number
                    words_correct: number
                    words_incorrect: number
                    new_words_learned: number
                    time_spent_seconds: number
                    time_spent_ms: number
                    session_count: number
                    created_at: string
                    updated_at: string
                }
                Insert: {
                    id?: string
                    user_id: string
                    log_date: string
                    words_reviewed?: number
                    words_correct?: number
                    words_incorrect?: number
                    new_words_learned?: number
                    time_spent_seconds?: number
                    time_spent_ms?: number
                    session_count?: number
                    created_at?: string
                    updated_at?: string
                }
                Update: {
                    id?: string
                    user_id?: string
                    log_date?: string
                    words_reviewed?: number
                    words_correct?: number
                    words_incorrect?: number
                    new_words_learned?: number
                    time_spent_seconds?: number
                    time_spent_ms?: number
                    session_count?: number
                    created_at?: string
                    updated_at?: string
                }
                Relationships: [
                    {
                        foreignKeyName: "daily_learning_log_user_id_fkey"
                        columns: ["user_id"]
                        isOneToOne: false
                        referencedRelation: "users"
                        referencedColumns: ["id"]
                    }
                ]
            }
        }
        Views: {
            [_ in never]: never
        }
        Functions: {
            get_user_learning_heatmap: {
                Args: Record<PropertyKey, never>
                Returns: {
                    log_date: string
                    words_reviewed: number
                    words_correct: number
                    words_incorrect: number
                    new_words_learned: number
                    time_spent_seconds: number
                    time_spent_ms: number
                    session_count: number
                    activity_count: number
                }[]
            }
            increment_daily_learning_log: {
                Args: {
                    p_log_date?: string
                    p_words_reviewed?: number
                    p_words_correct?: number
                    p_words_incorrect?: number
                    p_new_words_learned?: number
                    p_time_spent_seconds?: number
                }
                Returns: {
                    id: string
                    user_id: string
                    log_date: string
                    words_reviewed: number
                    words_correct: number
                    words_incorrect: number
                    new_words_learned: number
                    time_spent_seconds: number
                    time_spent_ms: number
                    session_count: number
                    created_at: string
                    updated_at: string
                }
            }
        }
        Enums: {
            difficulty_level: "basic" | "intermediate" | "advanced"
            regional_market: "MOEX" | "BIST" | "GLOBAL"
        }
        CompositeTypes: {
            [_ in never]: never
        }
    }
}
