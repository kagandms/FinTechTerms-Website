import {
    createRequestId,
    errorResponse,
    handleRouteError,
    successResponse,
} from '@/lib/api-response';
import { AUTH_REQUIRED_MESSAGE } from '@/lib/auth/session';
import { logger } from '@/lib/logger';
import { createRequestScopedClient, resolveAuthenticatedUser } from '@/lib/supabaseAdmin';
import { RECENT_QUIZ_HISTORY_LIMIT, userProgressSchema } from '@/lib/userProgress';

const PROGRESS_ROUTE_HEADERS = {
    'Cache-Control': 'no-store',
};

const USER_PROGRESS_SEGMENTS = [
    'user_progress',
    'favorites',
    'recent_quiz_history',
    'user_settings',
    'streak_summary',
] as const;

type UserProgressSegment = typeof USER_PROGRESS_SEGMENTS[number];

const buildUserProgressLoadMessage = (
    missingSegments: readonly UserProgressSegment[]
): string => {
    const labels: Record<UserProgressSegment, string> = {
        user_progress: 'progress summary',
        favorites: 'favorites',
        recent_quiz_history: 'recent quiz history',
        user_settings: 'user settings',
        streak_summary: 'streak summary',
    };

    return `Study progress loaded with gaps: ${missingSegments.map((segment) => labels[segment]).join(', ')}.`;
};

export async function GET(request: Request) {
    const requestId = createRequestId(request);

    try {
        const user = await resolveAuthenticatedUser(request);
        if (!user) {
            return errorResponse({
                status: 401,
                code: 'UNAUTHORIZED',
                message: AUTH_REQUIRED_MESSAGE,
                requestId,
                retryable: false,
                headers: PROGRESS_ROUTE_HEADERS,
            });
        }

        const supabase = await createRequestScopedClient(request);
        if (!supabase) {
            return errorResponse({
                status: 503,
                code: 'PROGRESS_LOAD_FAILED',
                message: 'Unable to load study progress.',
                requestId,
                retryable: true,
                headers: PROGRESS_ROUTE_HEADERS,
            });
        }

        const [
            progressResult,
            favoritesResult,
            quizHistoryResult,
            settingsResult,
            streakResult,
        ] = await Promise.allSettled([
            supabase
                .from('user_progress')
                .select('*')
                .eq('user_id', user.id)
                .maybeSingle(),
            supabase
                .from('user_favorites')
                .select('term_id')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false }),
            supabase
                .from('quiz_attempts')
                .select('*')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false })
                .limit(RECENT_QUIZ_HISTORY_LIMIT),
            supabase
                .from('user_settings')
                .select('preferred_language')
                .eq('user_id', user.id)
                .maybeSingle(),
            supabase.rpc('get_user_streak_summary'),
        ]);

        const missingSegments = new Set<UserProgressSegment>();

        const getFulfilledData = <T,>(
            segment: UserProgressSegment,
            settledResult: PromiseSettledResult<{ data: T | null; error: { message?: string | null } | null }>
        ): T | null => {
            if (settledResult.status === 'rejected') {
                logger.error('PROGRESS_ROUTE_SEGMENT_REJECTED', {
                    route: '/api/progress',
                    requestId,
                    userId: user.id,
                    segment,
                    error: settledResult.reason instanceof Error ? settledResult.reason : undefined,
                });
                missingSegments.add(segment);
                return null;
            }

            if (settledResult.value.error) {
                logger.error('PROGRESS_ROUTE_SEGMENT_FAILED', {
                    route: '/api/progress',
                    requestId,
                    userId: user.id,
                    segment,
                    error: new Error(settledResult.value.error.message ?? 'Unknown Supabase error'),
                });
                missingSegments.add(segment);
                return null;
            }

            return settledResult.value.data;
        };

        const progressRow = getFulfilledData<{ total_words_learned?: number | null; created_at?: string | null; updated_at?: string | null }>(
            'user_progress',
            progressResult
        );
        const favoritesRows = getFulfilledData<Array<{ term_id: string }>>('favorites', favoritesResult) ?? [];
        const quizRows = getFulfilledData<Array<{
            id: string;
            term_id: string;
            is_correct: boolean;
            response_time_ms: number;
            created_at: string;
            quiz_type: 'daily' | 'practice' | 'review' | 'simulation' | 'telegram_bot';
        }>>('recent_quiz_history', quizHistoryResult) ?? [];
        const settingsRow = getFulfilledData<{ preferred_language?: 'tr' | 'en' | 'ru' | null }>('user_settings', settingsResult);
        const streakRows = getFulfilledData<Array<{ current_streak: number; last_study_date: string | null }>>('streak_summary', streakResult) ?? [];

        const createdAt = progressRow?.created_at || new Date().toISOString();
        const updatedAt = progressRow?.updated_at || createdAt;
        const streakSummary = streakRows[0] ?? null;

        const result = userProgressSchema.safeParse({
            user_id: user.id,
            favorites: favoritesRows.map((row) => row.term_id),
            current_language: settingsRow?.preferred_language || 'ru',
            quiz_history: quizRows.map((row) => ({
                id: row.id,
                term_id: row.term_id,
                is_correct: row.is_correct,
                response_time_ms: row.response_time_ms,
                timestamp: row.created_at,
                quiz_type: row.quiz_type,
            })),
            total_words_learned: progressRow?.total_words_learned ?? 0,
            current_streak: streakSummary?.current_streak ?? 0,
            last_study_date: streakSummary?.last_study_date ?? null,
            created_at: createdAt,
            updated_at: updatedAt,
        });

        if (!result.success) {
            logger.error('PROGRESS_ROUTE_PARSE_FAILED', {
                route: '/api/progress',
                requestId,
                userId: user.id,
                validation: result.error.flatten(),
            });
            return errorResponse({
                status: 503,
                code: 'PROGRESS_LOAD_FAILED',
                message: 'Supabase returned malformed study progress data.',
                requestId,
                retryable: true,
                headers: PROGRESS_ROUTE_HEADERS,
            });
        }

        if (missingSegments.size === 0) {
            return successResponse({
                status: 'ok',
                data: result.data,
            }, requestId, {
                headers: PROGRESS_ROUTE_HEADERS,
            });
        }

        if (missingSegments.size === USER_PROGRESS_SEGMENTS.length) {
            return errorResponse({
                status: 503,
                code: 'PROGRESS_LOAD_FAILED',
                message: 'Unable to load study progress from Supabase.',
                requestId,
                retryable: true,
                headers: PROGRESS_ROUTE_HEADERS,
            });
        }

        return successResponse({
            status: 'partial',
            data: result.data,
            missing: [...missingSegments],
            message: buildUserProgressLoadMessage([...missingSegments]),
        }, requestId, {
            headers: PROGRESS_ROUTE_HEADERS,
        });
    } catch (error) {
        return handleRouteError(error, {
            requestId,
            code: 'PROGRESS_LOAD_FAILED',
            message: 'Unable to load study progress.',
            retryable: true,
            status: 503,
            headers: PROGRESS_ROUTE_HEADERS,
            logLabel: 'PROGRESS_ROUTE_FAILED',
        });
    }
}
