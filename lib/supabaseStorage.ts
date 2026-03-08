// ============================================
// Supabase Storage Utilities
// Cloud-based data persistence for authenticated users
// ============================================

import { supabase } from './supabase';
import { UserProgress, QuizAttempt, Term } from '@/types';
import { createIdempotencyKey } from '@/lib/idempotency';
import { filterAcademicTerms } from '@/lib/academicQuarantine';
import { userProgressSchema } from '@/lib/userProgress';

interface FavoriteToggleResponse {
    favorites: string[];
    isFavorite: boolean;
}

export interface RecordQuizResult {
    userProgress: Pick<UserProgress, 'current_streak' | 'last_study_date' | 'total_words_learned' | 'updated_at'>;
    termSrs: {
        term_id: string;
        srs_level: number;
        next_review_date: string;
        last_reviewed: string;
        difficulty_score: number;
        retention_rate: number;
        times_reviewed: number;
        times_correct: number;
    };
}

interface StreakSummaryRow {
    current_streak: number;
    last_study_date: string | null;
}

const REQUEST_TIMEOUT_MS = 10_000;
const REQUEST_TIMEOUT_MESSAGE = 'Loading is taking too long — please try again';

const readApiError = async (response: Response, fallbackMessage: string): Promise<string> => {
    try {
        const payload = await response.json();
        return payload?.message || payload?.error || fallbackMessage;
    } catch {
        return fallbackMessage;
    }
};

const sleep = (ms: number) => new Promise((resolve) => {
    window.setTimeout(resolve, ms);
});

const waitForAccessToken = async (): Promise<string | null> => {
    for (let attempt = 0; attempt < 6; attempt += 1) {
        const {
            data: { session },
        } = await supabase.auth.getSession();

        if (session?.access_token) {
            return session.access_token;
        }

        if (attempt === 1) {
            try {
                await supabase.auth.refreshSession();
            } catch {
                // Best-effort refresh only. If it fails we fall back to cookies.
            }
        }

        await sleep(150);
    }

    return null;
};

const getAuthenticatedRequestHeaders = async (): Promise<Record<string, string>> => {
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
    };

    const accessToken = await waitForAccessToken();
    if (accessToken) {
        headers.Authorization = `Bearer ${accessToken}`;
    }

    return headers;
};

const fetchWithTimeout = async (
    input: RequestInfo | URL,
    init: RequestInit,
    timeoutMessage: string
): Promise<Response> => {
    const controller = new AbortController();
    const timeoutId = globalThis.setTimeout(() => {
        controller.abort();
    }, REQUEST_TIMEOUT_MS);

    try {
        return await fetch(input, {
            ...init,
            signal: controller.signal,
        });
    } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
            throw new Error(timeoutMessage);
        }

        throw error;
    } finally {
        if (timeoutId !== undefined) {
            globalThis.clearTimeout(timeoutId);
        }
    }
};

const fetchWithAuthRetry = async (
    input: RequestInfo | URL,
    init: RequestInit,
    fallbackMessage: string
): Promise<Response> => {
    let headers = await getAuthenticatedRequestHeaders();
    let response = await fetchWithTimeout(input, {
        ...init,
        credentials: 'same-origin',
        headers: {
            ...headers,
            ...(init.headers || {}),
        },
    }, REQUEST_TIMEOUT_MESSAGE);

    if (response.status !== 401) {
        return response;
    }

    try {
        await supabase.auth.refreshSession();
    } catch {
        // Retry once with the freshest session state we can get.
    }

    headers = await getAuthenticatedRequestHeaders();
    response = await fetchWithTimeout(input, {
        ...init,
        credentials: 'same-origin',
        headers: {
            ...headers,
            ...(init.headers || {}),
        },
    }, REQUEST_TIMEOUT_MESSAGE);

    if (!response.ok && response.status === 401) {
        const message = await readApiError(response, fallbackMessage);
        throw new Error(message);
    }

    return response;
};

/**
 * Fetch user progress from Supabase
 */
export async function getUserProgressFromSupabase(userId: string): Promise<UserProgress | null> {
    const [
        { data: progressData, error: progressError },
        { data: favoritesData, error: favoritesError },
        { data: quizData, error: quizError },
        { data: settingsData, error: settingsError },
        { data: streakData, error: streakError },
    ] = await Promise.all([
        supabase
            .from('user_progress')
            .select('*')
            .eq('user_id', userId)
            .maybeSingle(),
        supabase
            .from('user_favorites')
            .select('term_id')
            .eq('user_id', userId)
            .order('created_at', { ascending: false }),
        supabase
            .from('quiz_attempts')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(100),
        supabase
            .from('user_settings')
            .select('preferred_language')
            .eq('user_id', userId)
            .maybeSingle(),
        supabase.rpc('get_user_streak_summary'),
    ]);

    if (progressError || favoritesError || quizError || settingsError || streakError) {
        console.error('[supabaseStorage]', progressError || favoritesError || quizError || settingsError || streakError);
        return null;
    }

    const createdAt = progressData?.created_at || new Date().toISOString();
    const updatedAt = progressData?.updated_at || createdAt;
    const streakSummary = (Array.isArray(streakData) ? streakData[0] : null) as StreakSummaryRow | null;

    const result = userProgressSchema.safeParse({
        user_id: userId,
        favorites: (favoritesData || []).map((row) => row.term_id),
        current_language: settingsData?.preferred_language || 'ru',
        quiz_history: (quizData || []).map((q) => ({
            id: q.id,
            term_id: q.term_id,
            is_correct: q.is_correct,
            response_time_ms: q.response_time_ms,
            timestamp: q.created_at,
            quiz_type: q.quiz_type as 'daily' | 'practice' | 'review',
        })),
        total_words_learned: progressData?.total_words_learned ?? 0,
        current_streak: streakSummary?.current_streak ?? 0,
        last_study_date: streakSummary?.last_study_date ?? null,
        created_at: createdAt,
        updated_at: updatedAt,
    });

    if (!result.success) {
        console.error('[supabaseStorage]', result.error.flatten());
        return null;
    }

    return result.data;
}

/**
 * Toggle a favorite term
 */
export async function toggleFavoriteInSupabase(
    _userId: string,
    termId: string,
    shouldFavorite: boolean
): Promise<FavoriteToggleResponse> {
    const response = await fetchWithAuthRetry('/api/favorites', {
        method: 'POST',
        body: JSON.stringify({
            termId,
            shouldFavorite,
            idempotencyKey: createIdempotencyKey(),
        }),
    }, 'Failed to toggle favorite.');

    if (!response.ok) {
        const message = await readApiError(response, 'Failed to toggle favorite.');
        throw new Error(message);
    }

    return await response.json() as FavoriteToggleResponse;
}

/**
 * Save a quiz attempt to Supabase
 */
export async function saveQuizAttemptToSupabase(
    _userId: string,
    attempt: QuizAttempt
): Promise<RecordQuizResult> {
    const response = await fetchWithAuthRetry('/api/record-quiz', {
        method: 'POST',
        body: JSON.stringify({
            term_id: attempt.term_id,
            is_correct: attempt.is_correct,
            response_time_ms: attempt.response_time_ms,
            quiz_type: attempt.quiz_type,
            idempotencyKey: attempt.id || createIdempotencyKey(),
        }),
    }, 'Failed to save quiz attempt.');

    if (!response.ok) {
        const message = await readApiError(response, 'Failed to save quiz attempt.');
        throw new Error(message);
    }

    const payload = await response.json() as { state: RecordQuizResult };
    return payload.state;
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
 * Fetch all static terms from Supabase
 * Returns just the content, not user SRS data
 */
export async function fetchTermsFromSupabase(): Promise<Partial<Term>[]> {
    const { data, error } = await supabase
        .from('terms')
        .select('*')
        .eq('is_academic', true);

    if (error) {
        console.error('Failed to fetch terms:', error);
        throw error;
    }

    // Map DB columns to Term interface (partial, as SRS data is separate)
    // Note: The DB columns match the Term interface fields exactly for content
    return filterAcademicTerms(data as unknown as Partial<Term>[]);
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
