// ============================================
// Supabase Storage Utilities
// Cloud-based data persistence for authenticated users
// ============================================

import { z } from 'zod';
import { supabase } from './supabase';
import { UserProgress, QuizAttempt, Term } from '@/types';
import { createIdempotencyKey } from '@/lib/idempotency';
import { filterAcademicTerms, isMissingAcademicColumnError } from '@/lib/academicQuarantine';
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
        last_reviewed: string | null;
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

const favoriteToggleResponseSchema = z.object({
    favorites: z.array(z.string().min(1)),
    isFavorite: z.boolean(),
}).passthrough();

const recordQuizResultSchema = z.object({
    userProgress: z.object({
        current_streak: z.number().int().nonnegative(),
        last_study_date: z.string().min(1).nullable(),
        total_words_learned: z.number().finite().nonnegative(),
        updated_at: z.string().min(1),
    }).passthrough(),
    termSrs: z.object({
        term_id: z.string().min(1),
        srs_level: z.number().int().nonnegative(),
        next_review_date: z.string().min(1),
        last_reviewed: z.string().min(1).nullable(),
        difficulty_score: z.number().finite(),
        retention_rate: z.number().finite(),
        times_reviewed: z.number().int().nonnegative(),
        times_correct: z.number().int().nonnegative(),
    }).passthrough(),
}).passthrough();

const recordQuizPayloadSchema = z.object({
    state: recordQuizResultSchema,
}).passthrough();

const userProgressRowSchema = z.object({
    total_words_learned: z.number().finite().nonnegative().nullable().optional(),
    created_at: z.string().min(1).nullable().optional(),
    updated_at: z.string().min(1).nullable().optional(),
}).passthrough();

const favoriteRowSchema = z.object({
    term_id: z.string().min(1),
}).passthrough();

const quizHistoryRowSchema = z.object({
    id: z.string().min(1),
    term_id: z.string().min(1),
    is_correct: z.boolean(),
    response_time_ms: z.number().finite().nonnegative(),
    created_at: z.string().min(1),
    quiz_type: z.enum(['daily', 'practice', 'review']),
}).passthrough();

const userSettingsRowSchema = z.object({
    preferred_language: z.enum(['tr', 'en', 'ru']).nullable().optional(),
}).passthrough();

const streakSummaryRowSchema = z.object({
    current_streak: z.number().int().nonnegative(),
    last_study_date: z.string().min(1).nullable(),
}).passthrough();

const termSrsRowSchema = z.object({
    term_id: z.string().min(1),
    srs_level: z.number().int().nonnegative(),
    next_review_date: z.string().min(1),
    last_reviewed: z.string().min(1).nullable(),
    difficulty_score: z.number().finite(),
    retention_rate: z.number().finite(),
    times_reviewed: z.number().int().nonnegative(),
    times_correct: z.number().int().nonnegative(),
}).passthrough();

const REQUEST_TIMEOUT_MS = 10_000;
const REQUEST_TIMEOUT_MESSAGE = 'Loading is taking too long — please try again';

const parseResponseOrThrow = <T>(
    schema: z.ZodType<T>,
    payload: unknown,
    errorMessage: string
): T => {
    const result = schema.safeParse(payload);

    if (!result.success) {
        console.error('[supabaseStorage]', result.error.flatten());
        throw new Error(errorMessage);
    }

    return result.data;
};

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

    const parsedProgressData = progressData
        ? parseResponseOrThrow(
            userProgressRowSchema,
            progressData,
            'Supabase returned malformed study progress data.'
        )
        : null;
    const parsedFavoritesData = parseResponseOrThrow(
        z.array(favoriteRowSchema),
        favoritesData || [],
        'Supabase returned malformed favorites data.'
    );
    const parsedQuizData = parseResponseOrThrow(
        z.array(quizHistoryRowSchema),
        quizData || [],
        'Supabase returned malformed quiz history data.'
    );
    const parsedSettingsData = settingsData
        ? parseResponseOrThrow(
            userSettingsRowSchema,
            settingsData,
            'Supabase returned malformed user settings data.'
        )
        : null;
    const parsedStreakData = parseResponseOrThrow(
        z.array(streakSummaryRowSchema),
        Array.isArray(streakData) ? streakData : [],
        'Supabase returned malformed streak data.'
    );

    const createdAt = parsedProgressData?.created_at || new Date().toISOString();
    const updatedAt = parsedProgressData?.updated_at || createdAt;
    const streakSummary = (parsedStreakData[0] || null) as StreakSummaryRow | null;

    const result = userProgressSchema.safeParse({
        user_id: userId,
        favorites: parsedFavoritesData.map((row) => row.term_id),
        current_language: parsedSettingsData?.preferred_language || 'ru',
        quiz_history: parsedQuizData.map((q) => ({
            id: q.id,
            term_id: q.term_id,
            is_correct: q.is_correct,
            response_time_ms: q.response_time_ms,
            timestamp: q.created_at,
            quiz_type: q.quiz_type as 'daily' | 'practice' | 'review',
        })),
        total_words_learned: parsedProgressData?.total_words_learned ?? 0,
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

    return parseResponseOrThrow(
        favoriteToggleResponseSchema,
        await response.json(),
        'Favorites service returned malformed data.'
    );
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

    const payload = parseResponseOrThrow(
        recordQuizPayloadSchema,
        await response.json(),
        'Quiz service returned malformed data.'
    );
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

    const parsedData = parseResponseOrThrow(
        z.array(termSrsRowSchema),
        data,
        'Supabase returned malformed SRS review data.'
    );

    const srsMap = new Map<string, Partial<Term>>();
    parsedData.forEach((row) => {
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
    const runTermsQuery = async (filterAcademicOnly: boolean) => {
        let query = supabase
            .from('terms')
            .select('*');

        if (filterAcademicOnly) {
            query = query.eq('is_academic', true);
        }

        return await query;
    };

    let { data, error } = await runTermsQuery(true);

    if (isMissingAcademicColumnError(error)) {
        console.warn(
            '[supabaseStorage] terms.is_academic column is missing; retrying without the academic filter.'
        );
        ({ data, error } = await runTermsQuery(false));
    }

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
