// ============================================
// Supabase Storage Utilities
// Cloud-based data persistence for authenticated users
// ============================================

import { supabase } from './supabase';
import { UserProgress, QuizAttempt, Term } from '@/types';

/**
 * Fetch user progress from Supabase
 */
export async function getUserProgressFromSupabase(userId: string): Promise<UserProgress | null> {
    const { data, error } = await supabase
        .from('user_progress')
        .select('*')
        .eq('user_id', userId)
        .single();

    if (error || !data) {
        console.log('No existing progress found, will create new');
        return null;
    }

    // Fetch quiz history
    const { data: quizData } = await supabase
        .from('quiz_attempts')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(100);

    return {
        user_id: data.user_id,
        favorites: data.favorites || [],
        current_language: 'tr', // Default, managed client-side
        quiz_history: (quizData || []).map((q) => ({
            id: q.id,
            term_id: q.term_id,
            is_correct: q.is_correct,
            response_time_ms: q.response_time_ms,
            timestamp: q.created_at,
            quiz_type: q.quiz_type as 'daily' | 'practice' | 'review',
        })),
        total_words_learned: data.total_words_learned,
        current_streak: data.current_streak,
        last_study_date: data.last_study_date,
        created_at: data.created_at,
        updated_at: data.updated_at,
    };
}

/**
 * Create initial user progress in Supabase
 */
export async function createUserProgress(userId: string): Promise<UserProgress> {
    const newProgress = {
        user_id: userId,
        favorites: [],
        current_streak: 0,
        last_study_date: null,
        total_words_learned: 0,
    };

    const { data, error } = await supabase
        .from('user_progress')
        .insert(newProgress)
        .select()
        .single();

    if (error) {
        console.error('Failed to create user progress:', error);
        throw error;
    }

    return {
        ...newProgress,
        current_language: 'tr',
        quiz_history: [],
        created_at: data.created_at,
        updated_at: data.updated_at,
    };
}

/**
 * Update user progress in Supabase
 */
export async function saveUserProgressToSupabase(
    userId: string,
    progress: Partial<UserProgress>
): Promise<void> {
    const { error } = await supabase
        .from('user_progress')
        .update({
            favorites: progress.favorites,
            current_streak: progress.current_streak,
            last_study_date: progress.last_study_date,
            total_words_learned: progress.total_words_learned,
        })
        .eq('user_id', userId);

    if (error) {
        console.error('Failed to save user progress:', error);
        throw error;
    }
}

/**
 * Toggle a favorite term
 */
export async function toggleFavoriteInSupabase(
    userId: string,
    termId: string,
    currentFavorites: string[]
): Promise<string[]> {
    const isFavorite = currentFavorites.includes(termId);
    const newFavorites = isFavorite
        ? currentFavorites.filter((id) => id !== termId)
        : [...currentFavorites, termId];

    const { error } = await supabase
        .from('user_progress')
        .update({ favorites: newFavorites })
        .eq('user_id', userId);

    if (error) {
        console.error('Failed to toggle favorite:', error);
        throw error;
    }

    return newFavorites;
}

/**
 * Save a quiz attempt to Supabase
 */
export async function saveQuizAttemptToSupabase(
    userId: string,
    attempt: QuizAttempt
): Promise<void> {
    const { error } = await supabase.from('quiz_attempts').insert({
        user_id: userId,
        term_id: attempt.term_id,
        is_correct: attempt.is_correct,
        response_time_ms: attempt.response_time_ms,
        quiz_type: attempt.quiz_type,
    });

    if (error) {
        console.error('Failed to save quiz attempt:', error);
        throw error;
    }
}

/**
 * Get user's SRS data for a specific term
 */
export async function getTermSRSFromSupabase(
    userId: string,
    termId: string
): Promise<Partial<Term> | null> {
    const { data, error } = await supabase
        .from('user_term_srs')
        .select('*')
        .eq('user_id', userId)
        .eq('term_id', termId)
        .single();

    if (error || !data) return null;

    return {
        srs_level: data.srs_level,
        next_review_date: data.next_review_date,
        last_reviewed: data.last_reviewed,
        difficulty_score: data.difficulty_score,
        retention_rate: data.retention_rate,
        times_reviewed: data.times_reviewed,
        times_correct: data.times_correct,
    };
}

/**
 * Save/Update term SRS data in Supabase
 */
export async function saveTermSRSToSupabase(
    userId: string,
    termId: string,
    srsData: Partial<Term>
): Promise<void> {
    const { error } = await supabase.from('user_term_srs').upsert(
        {
            user_id: userId,
            term_id: termId,
            srs_level: srsData.srs_level,
            next_review_date: srsData.next_review_date,
            last_reviewed: srsData.last_reviewed,
            difficulty_score: srsData.difficulty_score,
            retention_rate: srsData.retention_rate,
            times_reviewed: srsData.times_reviewed,
            times_correct: srsData.times_correct,
        },
        {
            onConflict: 'user_id,term_id',
        }
    );

    if (error) {
        console.error('Failed to save term SRS data:', error);
        throw error;
    }
}

/**
 * Get all user's SRS data for terms
 */
export async function getAllTermSRSFromSupabase(
    userId: string
): Promise<Map<string, Partial<Term>>> {
    const { data, error } = await supabase
        .from('user_term_srs')
        .select('*')
        .eq('user_id', userId);

    if (error || !data) return new Map();

    const srsMap = new Map<string, Partial<Term>>();
    data.forEach((row) => {
        srsMap.set(row.term_id, {
            srs_level: row.srs_level,
            next_review_date: row.next_review_date,
            last_reviewed: row.last_reviewed,
            difficulty_score: row.difficulty_score,
            retention_rate: row.retention_rate,
            times_reviewed: row.times_reviewed,
            times_correct: row.times_correct,
        });
    });

    return srsMap;
}

/**
 * Update streak based on last study date
 */
export async function updateStreakInSupabase(userId: string): Promise<number> {
    // Get current progress
    const { data } = await supabase
        .from('user_progress')
        .select('current_streak, last_study_date')
        .eq('user_id', userId)
        .single();

    if (!data) return 0;

    const today = new Date().toDateString();
    const lastStudy = data.last_study_date
        ? new Date(data.last_study_date).toDateString()
        : null;

    let newStreak = data.current_streak;

    if (lastStudy !== today) {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);

        if (lastStudy === yesterday.toDateString()) {
            newStreak += 1;
        } else if (lastStudy !== today) {
            newStreak = 1;
        }

        await supabase
            .from('user_progress')
            .update({
                current_streak: newStreak,
                last_study_date: new Date().toISOString(),
            })
            .eq('user_id', userId);
    }

    return newStreak;
}

/**
 * Fetch all static terms from Supabase
 * Returns just the content, not user SRS data
 */
export async function fetchTermsFromSupabase(): Promise<Partial<Term>[]> {
    const { data, error } = await supabase
        .from('terms')
        .select('*');

    if (error) {
        console.error('Failed to fetch terms:', error);
        throw error;
    }

    // Map DB columns to Term interface (partial, as SRS data is separate)
    // Note: The DB columns match the Term interface fields exactly for content
    return data as unknown as Partial<Term>[];
}

/**
 * Fetch a single term by ID from Supabase
 */
export async function getTermById(termId: string): Promise<Partial<Term> | null> {
    const { data, error } = await supabase
        .from('terms')
        .select('*')
        .eq('id', termId)
        .single();

    if (error) {
        // If error is "PGRST116" (no rows), return null
        if (error.code === 'PGRST116') return null;
        console.error('Failed to fetch term:', error);
        return null;
    }

    return data as unknown as Partial<Term>;
}
