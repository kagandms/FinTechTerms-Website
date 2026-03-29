// ============================================
// Supabase Storage Utilities
// Cloud-based data persistence for authenticated users
// ============================================

import { z } from 'zod';
import { getSupabaseClient } from './supabase';
import { QUIZ_TYPE_VALUES, UserProgress, QuizAttempt, Term } from '@/types';
import { createIdempotencyKey } from '@/lib/idempotency';
import { filterAcademicTerms, isMissingAcademicColumnError } from '@/lib/academicQuarantine';
import { userProgressSchema } from '@/lib/userProgress';
import { logger } from '@/lib/logger';
import { readTrackedStudySessionContext } from '@/lib/study-session-storage';

interface FavoriteToggleResponse {
    favorites: string[];
    isFavorite: boolean;
}

export type FavoriteToggleMutationResult =
    | { status: 'ok'; data: FavoriteToggleResponse }
    | { status: 'auth_expired'; message: string }
    | { status: 'retryable'; message: string }
    | { status: 'non_retryable'; message: string };

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

export type SaveQuizAttemptResult =
    | { status: 'ok'; data: RecordQuizResult }
    | { status: 'auth_expired'; message: string }
    | { status: 'retryable'; message: string }
    | { status: 'non_retryable'; message: string };

export type UserTermSrsLoadResult =
    | { status: 'ok'; data: Map<string, Partial<Term>> }
    | { status: 'error'; message: string };

export type UserProgressLoadMissingSegment =
    | 'user_progress'
    | 'favorites'
    | 'recent_quiz_history'
    | 'user_settings'
    | 'streak_summary';

export type UserProgressLoadResult =
    | { status: 'ok'; data: UserProgress }
    | {
        status: 'partial';
        data: UserProgress;
        missing: UserProgressLoadMissingSegment[];
        message: string;
    }
    | {
        status: 'error';
        missing: UserProgressLoadMissingSegment[];
        message: string;
    };

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
    quiz_type: z.enum(QUIZ_TYPE_VALUES),
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

const USER_TERM_SRS_QUERY_COLUMNS = [
    'term_id',
    'srs_level',
    'next_review_date',
    'last_reviewed',
    'difficulty_score',
    'retention_rate',
    'times_reviewed',
    'times_correct',
].join(', ');

const RECENT_QUIZ_HISTORY_LIMIT = 100;
const USER_PROGRESS_SEGMENTS: readonly UserProgressLoadMissingSegment[] = [
    'user_progress',
    'favorites',
    'recent_quiz_history',
    'user_settings',
    'streak_summary',
] as const;

const chunkValues = <T,>(values: readonly T[], size: number): T[][] => {
    const chunks: T[][] = [];

    for (let index = 0; index < values.length; index += size) {
        chunks.push(values.slice(index, index + size));
    }

    return chunks;
};

const REQUEST_TIMEOUT_MS = 10_000;
const REQUEST_TIMEOUT_MESSAGE = 'Loading is taking too long — please try again';

const USER_PROGRESS_SEGMENT_LABELS: Record<UserProgressLoadMissingSegment, string> = {
    user_progress: 'progress summary',
    favorites: 'favorites',
    recent_quiz_history: 'recent quiz history',
    user_settings: 'user settings',
    streak_summary: 'streak summary',
};

const parseResponseOrThrow = <T>(
    schema: z.ZodType<T>,
    payload: unknown,
    errorMessage: string
): T => {
    const result = schema.safeParse(payload);

    if (!result.success) {
        logger.error('SUPABASE_STORAGE_PARSE_FAILED', {
            route: 'supabaseStorage',
            validation: result.error.flatten(),
        });
        throw new Error(errorMessage);
    }

    return result.data;
};

const safeParseResponse = <T>(
    schema: z.ZodType<T>,
    payload: unknown
): T | null => {
    const result = schema.safeParse(payload);

    if (!result.success) {
        return null;
    }

    return result.data;
};

const buildUserProgressLoadMessage = (
    missingSegments: readonly UserProgressLoadMissingSegment[]
): string => {
    const labels = missingSegments.map((segment) => USER_PROGRESS_SEGMENT_LABELS[segment]);

    return `Study progress loaded with gaps: ${labels.join(', ')}.`;
};

const withSupabaseReadTimeout = async <T,>(
    operation: PromiseLike<T> | Promise<T>,
    timeoutMessage = REQUEST_TIMEOUT_MESSAGE
): Promise<T> => {
    let timeoutId: ReturnType<typeof globalThis.setTimeout> | undefined;

    const timeoutPromise = new Promise<never>((_resolve, reject) => {
        timeoutId = globalThis.setTimeout(() => {
            reject(new Error(timeoutMessage));
        }, REQUEST_TIMEOUT_MS);
    });

    try {
        return await Promise.race([Promise.resolve(operation), timeoutPromise]);
    } finally {
        if (timeoutId !== undefined) {
            globalThis.clearTimeout(timeoutId);
        }
    }
};

const readApiError = async (response: Response, fallbackMessage: string): Promise<string> => {
    try {
        const payload = await response.json();
        return payload?.message || payload?.error || fallbackMessage;
    } catch {
        return fallbackMessage;
    }
};

const readApiFailure = async (
    response: Response,
    fallbackMessage: string
): Promise<{ message: string; retryable: boolean }> => {
    try {
        const payload = await response.json();
        const message = typeof payload?.message === 'string'
            ? payload.message
            : (
                payload?.error
                && typeof payload.error === 'object'
                && 'message' in payload.error
                && typeof payload.error.message === 'string'
            )
                ? payload.error.message
                : (
                    typeof payload?.error === 'string'
                        ? payload.error
                        : fallbackMessage
                );
        const retryable = typeof payload?.retryable === 'boolean'
            ? payload.retryable
            : response.status >= 500 || response.status === 429;

        return {
            message,
            retryable,
        };
    } catch {
        return {
            message: fallbackMessage,
            retryable: response.status >= 500 || response.status === 429,
        };
    }
};

const sleep = (ms: number) => new Promise((resolve) => {
    window.setTimeout(resolve, ms);
});

const waitForAccessToken = async (): Promise<string | null> => {
    const supabase = getSupabaseClient();

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
    fallbackMessage: string,
    options?: {
        throwOnFinalUnauthorized?: boolean;
    }
): Promise<Response> => {
    const supabase = getSupabaseClient();
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
        if (options?.throwOnFinalUnauthorized === false) {
            return response;
        }

        const message = await readApiError(response, fallbackMessage);
        throw new Error(message);
    }

    return response;
};

/**
 * Fetch user progress from Supabase
 */
export async function getUserProgressFromSupabase(userId: string): Promise<UserProgressLoadResult> {
    const supabase = getSupabaseClient();

    await waitForAccessToken();

    const [
        progressResult,
        favoritesResult,
        quizHistoryResult,
        settingsResult,
        streakResult,
    ] = await withSupabaseReadTimeout(Promise.allSettled([
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
            .limit(RECENT_QUIZ_HISTORY_LIMIT),
        supabase
            .from('user_settings')
            .select('preferred_language')
            .eq('user_id', userId)
            .maybeSingle(),
        supabase.rpc('get_user_streak_summary'),
    ]));

    const missingSegments = new Set<UserProgressLoadMissingSegment>();

    const getFulfilledData = <T,>(
        segment: UserProgressLoadMissingSegment,
        settledResult: PromiseSettledResult<{ data: T | null; error: { message?: string | null } | null }>
    ): T | null => {
        if (settledResult.status === 'rejected') {
            logger.error('SUPABASE_STORAGE_PROGRESS_SEGMENT_REJECTED', {
                route: 'supabaseStorage',
                userId,
                segment,
                error: settledResult.reason instanceof Error ? settledResult.reason : undefined,
            });
            missingSegments.add(segment);
            return null;
        }

        if (settledResult.value.error) {
            logger.error('SUPABASE_STORAGE_PROGRESS_SEGMENT_FAILED', {
                route: 'supabaseStorage',
                userId,
                segment,
                error: new Error(settledResult.value.error.message ?? 'Unknown Supabase error'),
            });
            missingSegments.add(segment);
            return null;
        }

        return settledResult.value.data;
    };

    const parsedProgressData = (() => {
        const payload = getFulfilledData('user_progress', progressResult);
        if (!payload) {
            return null;
        }

        const parsed = safeParseResponse(
            userProgressRowSchema,
            payload
        );

        if (!parsed) {
            logger.error('SUPABASE_STORAGE_PROGRESS_SEGMENT_PARSE_FAILED', {
                route: 'supabaseStorage',
                userId,
                segment: 'user_progress',
            });
            missingSegments.add('user_progress');
            return null;
        }

        return parsed;
    })();

    const parsedFavoritesData = (() => {
        const payload = getFulfilledData('favorites', favoritesResult);
        if (!payload) {
            return [];
        }

        const parsed = safeParseResponse(
            z.array(favoriteRowSchema),
            payload
        );

        if (!parsed) {
            logger.error('SUPABASE_STORAGE_PROGRESS_SEGMENT_PARSE_FAILED', {
                route: 'supabaseStorage',
                userId,
                segment: 'favorites',
            });
            missingSegments.add('favorites');
            return [];
        }

        return parsed;
    })();

    const parsedQuizData = (() => {
        const payload = getFulfilledData('recent_quiz_history', quizHistoryResult);
        if (!payload) {
            return [];
        }

        const parsed = safeParseResponse(
            z.array(quizHistoryRowSchema),
            payload
        );

        if (!parsed) {
            logger.error('SUPABASE_STORAGE_PROGRESS_SEGMENT_PARSE_FAILED', {
                route: 'supabaseStorage',
                userId,
                segment: 'recent_quiz_history',
            });
            missingSegments.add('recent_quiz_history');
            return [];
        }

        return parsed;
    })();

    const parsedSettingsData = (() => {
        const payload = getFulfilledData('user_settings', settingsResult);
        if (!payload) {
            return null;
        }

        const parsed = safeParseResponse(
            userSettingsRowSchema,
            payload
        );

        if (!parsed) {
            logger.error('SUPABASE_STORAGE_PROGRESS_SEGMENT_PARSE_FAILED', {
                route: 'supabaseStorage',
                userId,
                segment: 'user_settings',
            });
            missingSegments.add('user_settings');
            return null;
        }

        return parsed;
    })();

    const parsedStreakData = (() => {
        const payload = getFulfilledData('streak_summary', streakResult);
        if (!payload) {
            return [];
        }

        const parsed = safeParseResponse(
            z.array(streakSummaryRowSchema),
            Array.isArray(payload) ? payload : []
        );

        if (!parsed) {
            logger.error('SUPABASE_STORAGE_PROGRESS_SEGMENT_PARSE_FAILED', {
                route: 'supabaseStorage',
                userId,
                segment: 'streak_summary',
            });
            missingSegments.add('streak_summary');
            return [];
        }

        return parsed;
    })();

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
            quiz_type: q.quiz_type,
        })),
        total_words_learned: parsedProgressData?.total_words_learned ?? 0,
        current_streak: streakSummary?.current_streak ?? 0,
        last_study_date: streakSummary?.last_study_date ?? null,
        created_at: createdAt,
        updated_at: updatedAt,
    });

    if (!result.success) {
        logger.error('SUPABASE_STORAGE_PROGRESS_PARSE_FAILED', {
            route: 'supabaseStorage',
            userId,
            validation: result.error.flatten(),
        });
        return {
            status: 'error',
            missing: [...USER_PROGRESS_SEGMENTS],
            message: 'Supabase returned malformed study progress data.',
        };
    }

    if (missingSegments.size === 0) {
        return {
            status: 'ok',
            data: result.data,
        };
    }

    if (missingSegments.size === USER_PROGRESS_SEGMENTS.length) {
        return {
            status: 'error',
            missing: [...missingSegments],
            message: 'Unable to load study progress from Supabase.',
        };
    }

    return {
        status: 'partial',
        data: result.data,
        missing: [...missingSegments],
        message: buildUserProgressLoadMessage([...missingSegments]),
    };
}

/**
 * Toggle a favorite term
 */
export async function toggleFavoriteInSupabase(
    _userId: string,
    termId: string,
    shouldFavorite: boolean
): Promise<FavoriteToggleMutationResult> {
    try {
        const response = await fetchWithAuthRetry('/api/favorites', {
            method: 'POST',
            body: JSON.stringify({
                termId,
                shouldFavorite,
                idempotencyKey: createIdempotencyKey(),
            }),
        }, 'Failed to toggle favorite.', {
            throwOnFinalUnauthorized: false,
        });

        if (response.status === 401) {
            return {
                status: 'auth_expired',
                message: 'Session expired. Please sign in again to update favorites.',
            };
        }

        if (!response.ok) {
            const { message, retryable } = await readApiFailure(
                response,
                'Failed to toggle favorite.'
            );

            if (retryable) {
                return {
                    status: 'retryable',
                    message,
                };
            }

            return {
                status: 'non_retryable',
                message,
            };
        }

        const payload = parseResponseOrThrow(
            favoriteToggleResponseSchema,
            await response.json(),
            'Favorites service returned malformed data.'
        );

        return {
            status: 'ok',
            data: payload,
        };
    } catch (error) {
        return {
            status: 'retryable',
            message: error instanceof Error ? error.message : 'Failed to toggle favorite.',
        };
    }
}

/**
 * Save a quiz attempt to Supabase
 */
export async function saveQuizAttemptToSupabase(
    _userId: string,
    attempt: QuizAttempt
): Promise<SaveQuizAttemptResult> {
    try {
        const sessionContext = readTrackedStudySessionContext();
        const response = await fetchWithAuthRetry('/api/record-quiz', {
            method: 'POST',
            body: JSON.stringify({
                term_id: attempt.term_id,
                is_correct: attempt.is_correct,
                response_time_ms: attempt.response_time_ms,
                quiz_type: attempt.quiz_type,
                idempotencyKey: attempt.id || createIdempotencyKey(),
                session_id: sessionContext?.sessionId,
                session_token: sessionContext?.sessionToken,
            }),
        }, 'Failed to save quiz attempt.', {
            throwOnFinalUnauthorized: false,
        });

        if (response.status === 401) {
            return {
                status: 'auth_expired',
                message: 'Session expired. Please sign in again to save this answer.',
            };
        }

        if (!response.ok) {
            const { message, retryable } = await readApiFailure(
                response,
                'Progress could not be saved. Please try again.'
            );

            if (retryable) {
                return {
                    status: 'retryable',
                    message,
                };
            }

            return {
                status: 'non_retryable',
                message,
            };
        }

        const payload = parseResponseOrThrow(
            recordQuizPayloadSchema,
            await response.json(),
            'Quiz service returned malformed data.'
        );

        return {
            status: 'ok',
            data: payload.state,
        };
    } catch (error) {
        return {
            status: 'retryable',
            message: error instanceof Error ? error.message : 'Failed to save quiz attempt.',
        };
    }
}

/**
 * Get user's SRS data for a specific term
 */
export async function getTermSRSFromSupabase(
    userId: string,
    termId: string
): Promise<Partial<Term> | null> {
    const supabase = getSupabaseClient();
    const { data, error } = await withSupabaseReadTimeout(
        supabase
            .from('user_term_srs')
            .select('*')
            .eq('user_id', userId)
            .eq('term_id', termId)
            .single()
    );

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
    userId: string,
    termIds: readonly string[]
): Promise<UserTermSrsLoadResult> {
    if (termIds.length === 0) {
        return {
            status: 'ok',
            data: new Map(),
        };
    }

    const supabase = getSupabaseClient();
    const termIdChunks = chunkValues(Array.from(new Set(termIds)), 100);

    try {
        const chunkResults = await withSupabaseReadTimeout(Promise.all(termIdChunks.map(async (termIdChunk) => {
            const { data, error } = await supabase
                .from('user_term_srs')
                .select(USER_TERM_SRS_QUERY_COLUMNS)
                .eq('user_id', userId)
                .in('term_id', termIdChunk);

            if (error) {
                throw new Error(error.message);
            }

            return parseResponseOrThrow(
                z.array(termSrsRowSchema),
                data ?? [],
                'Supabase returned malformed SRS review data.'
            );
        })));

        const parsedData = chunkResults.flat();

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

        return {
            status: 'ok',
            data: srsMap,
        };
    } catch (error) {
        return {
            status: 'error',
            message: error instanceof Error ? error.message : 'Failed to load SRS review data.',
        };
    }
}

/**
 * Get all user's SRS data without scoping. Intended for diagnostics only.
 */
export async function getAllTermSRSFromSupabaseUnbounded(
    userId: string
): Promise<UserTermSrsLoadResult> {
    const supabase = getSupabaseClient();
    const { data, error } = await withSupabaseReadTimeout(
        supabase
            .from('user_term_srs')
            .select(USER_TERM_SRS_QUERY_COLUMNS)
            .eq('user_id', userId)
    );

    if (error) {
        return {
            status: 'error',
            message: error.message,
        };
    }

    try {
        const parsedData = parseResponseOrThrow(
            z.array(termSrsRowSchema),
            data ?? [],
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

        return {
            status: 'ok',
            data: srsMap,
        };
    } catch (error) {
        return {
            status: 'error',
            message: error instanceof Error ? error.message : 'Failed to load SRS review data.',
        };
    }
}
/**
 * Fetch all static terms from Supabase
 * Returns just the content, not user SRS data
 */
export async function fetchTermsFromSupabase(): Promise<Partial<Term>[]> {
    const supabase = getSupabaseClient();

    const runTermsQuery = async (filterAcademicOnly: boolean) => {
        let query = supabase
            .from('terms')
            .select('*');

        if (filterAcademicOnly) {
            query = query.eq('is_academic', true);
        }

        return await query;
    };

    let { data, error } = await withSupabaseReadTimeout(runTermsQuery(true));

    if (isMissingAcademicColumnError(error)) {
        logger.warn('SUPABASE_STORAGE_MISSING_ACADEMIC_COLUMN', {
            route: 'supabaseStorage',
        });
        ({ data, error } = await withSupabaseReadTimeout(runTermsQuery(false)));
    }

    if (error) {
        logger.error('SUPABASE_STORAGE_FETCH_TERMS_FAILED', {
            route: 'supabaseStorage',
            error: error,
        });
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
    const supabase = getSupabaseClient();
    const { data, error } = await withSupabaseReadTimeout(
        supabase
            .from('terms')
            .select('*')
            .eq('id', termId)
            .single()
    );

    if (error) {
        // If error is "PGRST116" (no rows), return null
        if (error.code === 'PGRST116') return null;
        logger.error('SUPABASE_STORAGE_FETCH_TERM_FAILED', {
            route: 'supabaseStorage',
            termId,
            error,
        });
        return null;
    }

    return data as unknown as Partial<Term>;
}
