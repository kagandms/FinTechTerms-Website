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
                }
                Relationships: []
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
            [_ in never]: never
        }
        Enums: {
            [_ in never]: never
        }
        CompositeTypes: {
            [_ in never]: never
        }
    }
}
