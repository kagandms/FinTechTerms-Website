// ============================================
// Supabase Client Configuration
// ============================================

import { createBrowserClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseAnonKey) {
    console.warn('Supabase environment variables are not set. Using fallback mode.');
}

/**
 * Supabase client for client-side operations (Browser)
 * Uses cookies for session storage, allowing server-side access.
 */
export const supabase = createBrowserClient(supabaseUrl || '', supabaseAnonKey || '');

/**
 * Standard Supabase client for auth operations
 * Use this for updateUser and other auth operations that may have issues with SSR client
 */
export const supabaseAuth = createClient(supabaseUrl || '', supabaseAnonKey || '', {
    auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
    }
});

/**
 * Database Types (generated from schema)
 * These match our database tables
 */
export interface Database {
    public: {
        Tables: {
            user_progress: {
                Row: {
                    id: string;
                    user_id: string;
                    favorites: string[];
                    current_streak: number;
                    last_study_date: string | null;
                    total_words_learned: number;
                    created_at: string;
                    updated_at: string;
                };
                Insert: Omit<Database['public']['Tables']['user_progress']['Row'], 'id' | 'created_at' | 'updated_at'>;
                Update: Partial<Database['public']['Tables']['user_progress']['Insert']>;
            };
            quiz_attempts: {
                Row: {
                    id: string;
                    user_id: string;
                    term_id: string;
                    is_correct: boolean;
                    response_time_ms: number;
                    quiz_type: string;
                    created_at: string;
                };
                Insert: Omit<Database['public']['Tables']['quiz_attempts']['Row'], 'id' | 'created_at'>;
                Update: Partial<Database['public']['Tables']['quiz_attempts']['Insert']>;
            };
            user_term_srs: {
                Row: {
                    id: string;
                    user_id: string;
                    term_id: string;
                    srs_level: number;
                    next_review_date: string | null;
                    last_reviewed: string | null;
                    difficulty_score: number;
                    retention_rate: number;
                    times_reviewed: number;
                    times_correct: number;
                };
                Insert: Omit<Database['public']['Tables']['user_term_srs']['Row'], 'id'>;
                Update: Partial<Database['public']['Tables']['user_term_srs']['Insert']>;
            };
            user_achievements: {
                Row: {
                    id: string;
                    user_id: string;
                    achievement_type: string;
                    earned_at: string;
                };
                Insert: Omit<Database['public']['Tables']['user_achievements']['Row'], 'id' | 'earned_at'>;
                Update: Partial<Database['public']['Tables']['user_achievements']['Insert']>;
            };
            user_settings: {
                Row: {
                    id: string;
                    user_id: string;
                    preferred_language: 'tr' | 'en' | 'ru';
                    theme: 'light' | 'dark' | 'system';
                    daily_goal: number;
                    notification_enabled: boolean;
                    sound_enabled: boolean;
                    created_at: string;
                    updated_at: string;
                };
                Insert: Omit<Database['public']['Tables']['user_settings']['Row'], 'id' | 'created_at' | 'updated_at'>;
                Update: Partial<Database['public']['Tables']['user_settings']['Insert']>;
            };
            daily_learning_log: {
                Row: {
                    id: string;
                    user_id: string;
                    log_date: string;
                    words_reviewed: number;
                    words_correct: number;
                    words_incorrect: number;
                    new_words_learned: number;
                    time_spent_seconds: number;
                    session_count: number;
                    created_at: string;
                    updated_at: string;
                };
                Insert: Omit<Database['public']['Tables']['daily_learning_log']['Row'], 'id' | 'created_at' | 'updated_at'>;
                Update: Partial<Database['public']['Tables']['daily_learning_log']['Insert']>;
            };
        };
    };
}

