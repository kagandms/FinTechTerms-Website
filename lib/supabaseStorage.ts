// ============================================
// Supabase Storage Utilities
// Cloud-based data persistence for authenticated users
// ============================================

import { z } from 'zod';
import { QUIZ_TYPE_VALUES, UserProgress, QuizAttempt, Term } from '@/types';
import { createIdempotencyKey } from '@/lib/idempotency';
import { userProgressSchema } from '@/lib/userProgress';
import { logger } from '@/lib/logger';
import {
    readTrackedStudySessionContext,
    readTrackedStudySessionState,
    waitForTrackedStudySessionContext,
} from '@/lib/study-session-storage';

interface FavoriteToggleResponse {
    favorites: string[];
    isFavorite: boolean;
}

export type FavoriteToggleMutationResult =
    | { status: 'ok'; data: FavoriteToggleResponse }
    | { status: 'auth_expired'; message: string }
    | { status: 'limit_reached'; message: string }
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

interface QuizAttemptSubmissionContext {
    sessionId?: string | null;
    sessionToken?: string | null;
}

type QuizAttemptSubmission = QuizAttempt & QuizAttemptSubmissionContext;

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

const USER_PROGRESS_SEGMENTS: readonly UserProgressLoadMissingSegment[] = [
    'user_progress',
    'favorites',
    'recent_quiz_history',
    'user_settings',
    'streak_summary',
] as const;

const REQUEST_TIMEOUT_MS = 10_000;
const REQUEST_TIMEOUT_MESSAGE = 'Loading is taking too long — please try again';
const CORRUPTED_STUDY_SESSION_MESSAGE = 'Study session state is corrupted. This answer will retry after the session recovers.';

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

const readApiError = async (response: Response, fallbackMessage: string): Promise<string> => {
    try {
        const payload = await response.json();
        return payload?.message || payload?.error || fallbackMessage;
    } catch {
        return fallbackMessage;
    }
};

const readJsonResponse = async <T,>(
    response: Response,
    fallbackMessage: string
): Promise<T> => {
    try {
        return await response.json() as T;
    } catch {
        throw new Error(fallbackMessage);
    }
};

const readApiFailure = async (
    response: Response,
    fallbackMessage: string
): Promise<{ code: string | null; message: string; retryable: boolean }> => {
    try {
        const payload = await response.json();
        const code = typeof payload?.code === 'string'
            ? payload.code
            : null;
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
            code,
            message,
            retryable,
        };
    } catch {
        return {
            code: null,
            message: fallbackMessage,
            retryable: response.status >= 500 || response.status === 429,
        };
    }
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

const fetchWithSessionAuth = async (
    input: RequestInfo | URL,
    init: RequestInit,
    fallbackMessage: string,
    options?: {
        throwOnFinalUnauthorized?: boolean;
    }
): Promise<Response> => {
    let response = await fetchWithTimeout(input, {
        ...init,
        credentials: 'same-origin',
        headers: init.headers,
    }, REQUEST_TIMEOUT_MESSAGE);

    if (response.status !== 401) {
        return response;
    }

    if (options?.throwOnFinalUnauthorized === false) {
        return response;
    }

    const message = await readApiError(response, fallbackMessage);
    throw new Error(message);
};

/**
 * Fetch user progress from Supabase
 */
export async function getUserProgressFromSupabase(userId: string): Promise<UserProgressLoadResult> {
    const response = await fetchWithTimeout('/api/progress', {
        method: 'GET',
        credentials: 'same-origin',
    }, REQUEST_TIMEOUT_MESSAGE);

    if (response.status === 401) {
        return {
            status: 'error',
            missing: [...USER_PROGRESS_SEGMENTS],
            message: 'Authentication required',
        };
    }

    if (!response.ok) {
        throw new Error(await readApiError(response, 'Unable to load study progress.'));
    }

    return await readJsonResponse(response, 'Unable to load study progress.') as UserProgressLoadResult;
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
        const response = await fetchWithSessionAuth('/api/favorites', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
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
            const { code, message, retryable } = await readApiFailure(
                response,
                'Failed to toggle favorite.'
            );

            if (code === 'FAVORITES_LIMIT_REACHED') {
                return {
                    status: 'limit_reached',
                    message,
                };
            }

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
    attempt: QuizAttemptSubmission
): Promise<SaveQuizAttemptResult> {
    try {
        const explicitSessionId = typeof attempt.sessionId === 'string' && attempt.sessionId.trim().length > 0
            ? attempt.sessionId.trim()
            : null;
        const explicitSessionToken = typeof attempt.sessionToken === 'string' && attempt.sessionToken.trim().length > 0
            ? attempt.sessionToken.trim()
            : null;
        const trackedSessionState = readTrackedStudySessionState();
        let fallbackSessionContext = readTrackedStudySessionContext();

        if (!explicitSessionId && !explicitSessionToken && trackedSessionState.status === 'pending') {
            fallbackSessionContext = await waitForTrackedStudySessionContext() ?? null;
        }

        if (!explicitSessionId && !explicitSessionToken && trackedSessionState.status === 'corrupt') {
            return {
                status: 'retryable',
                message: CORRUPTED_STUDY_SESSION_MESSAGE,
            };
        }

        const resolvedSessionId = explicitSessionId ?? fallbackSessionContext?.sessionId ?? null;
        const resolvedSessionToken = explicitSessionToken ?? fallbackSessionContext?.sessionToken ?? null;
        const hasResolvedSessionContext = Boolean(resolvedSessionId && resolvedSessionToken);

        if (!explicitSessionId && !explicitSessionToken && !hasResolvedSessionContext) {
            const nextTrackedSessionState = readTrackedStudySessionState();
            if (nextTrackedSessionState.status === 'corrupt') {
                return {
                    status: 'retryable',
                    message: CORRUPTED_STUDY_SESSION_MESSAGE,
                };
            }
        }

        if (!explicitSessionId && !explicitSessionToken && trackedSessionState.status === 'pending' && !hasResolvedSessionContext) {
            return {
                status: 'retryable',
                message: 'Study session is still syncing. This answer will retry shortly.',
            };
        }

        const response = await fetchWithSessionAuth('/api/record-quiz', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                term_id: attempt.term_id,
                is_correct: attempt.is_correct,
                response_time_ms: attempt.response_time_ms,
                quiz_type: attempt.quiz_type,
                idempotencyKey: attempt.id || createIdempotencyKey(),
                occurred_at: attempt.timestamp,
                session_id: hasResolvedSessionContext ? resolvedSessionId : undefined,
                session_token: hasResolvedSessionContext ? resolvedSessionToken : undefined,
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
    const result = await getAllTermSRSFromSupabase(userId, [termId]);

    if (result.status !== 'ok') {
        return null;
    }

    return result.data.get(termId) ?? null;
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

    try {
        const response = await fetchWithTimeout('/api/progress/srs', {
            method: 'POST',
            credentials: 'same-origin',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                termIds: Array.from(new Set(termIds)),
            }),
        }, REQUEST_TIMEOUT_MESSAGE);

        if (!response.ok) {
            throw new Error(await readApiError(response, 'Failed to load SRS review data.'));
        }

        const payload = await response.json() as { status: 'ok' | 'error'; data?: unknown; message?: string };
        if (payload.status !== 'ok') {
            return {
                status: 'error',
                message: payload.message || 'Failed to load SRS review data.',
            };
        }

        const parsedData = parseResponseOrThrow(
            z.array(termSrsRowSchema),
            payload.data ?? [],
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
 * Get all user's SRS data without scoping. Intended for diagnostics only.
 */
export async function getAllTermSRSFromSupabaseUnbounded(
    userId: string
): Promise<UserTermSrsLoadResult> {
    try {
        const response = await fetchWithTimeout('/api/progress/srs', {
            method: 'POST',
            credentials: 'same-origin',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                unbounded: true,
            }),
        }, REQUEST_TIMEOUT_MESSAGE);

        if (!response.ok) {
            throw new Error(await readApiError(response, 'Failed to load SRS review data.'));
        }

        const payload = await response.json() as { status: 'ok' | 'error'; data?: unknown; message?: string };
        if (payload.status !== 'ok') {
            return {
                status: 'error',
                message: payload.message || 'Failed to load SRS review data.',
            };
        }

        const parsedData = parseResponseOrThrow(
            z.array(termSrsRowSchema),
            payload.data ?? [],
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
