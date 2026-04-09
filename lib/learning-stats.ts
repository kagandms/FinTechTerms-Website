import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/supabase';
import type {
    LearningRecentAttempt,
    LearningStatsData,
    LearningStatsLoadResult,
    LearningStatsMissingSegment,
    UserBadgeSummary,
} from '@/types/gamification';

type AppSupabaseClient = SupabaseClient;

interface QuizMetricsRow {
    total_reviews: number | null;
    correct_reviews: number | null;
    avg_response_time_ms: number | null;
}

interface LearningStreakSummary {
    currentStreak: number;
    lastStudyDate: string | null;
}

interface LearningMetricsSummary {
    totalReviews: number | null;
    correctReviews: number | null;
    accuracy: number | null;
    avgResponseTimeMs: number | null;
}

interface ExportCursorState {
    snapshotCreatedAt: string;
    lastCreatedAt: string | null;
    lastId: string | null;
}

const RECENT_ATTEMPTS_LIMIT = 10;
const DEFAULT_EXPORT_ATTEMPTS_PAGE_SIZE = 500;
const MAX_EXPORT_ATTEMPTS_PAGE_SIZE = 1000;
const LEARNING_STATS_SEGMENTS: LearningStatsMissingSegment[] = ['heatmap', 'streak', 'badges', 'metrics', 'recentAttempts'];

const isValidIsoTimestamp = (value: string): boolean => !Number.isNaN(new Date(value).getTime());

const encodeExportCursor = (state: ExportCursorState): string => Buffer.from(
    JSON.stringify(state)
).toString('base64url');

export class InvalidAnalyticsExportCursorError extends Error {
    constructor(message = 'Analytics export cursor is invalid.') {
        super(message);
        this.name = 'InvalidAnalyticsExportCursorError';
    }
}

const decodeExportCursor = (rawCursor: string): ExportCursorState => {
    let parsedCursor: unknown;

    try {
        parsedCursor = JSON.parse(Buffer.from(rawCursor, 'base64url').toString('utf8')) as unknown;
    } catch {
        throw new InvalidAnalyticsExportCursorError();
    }

    if (!parsedCursor || typeof parsedCursor !== 'object') {
        throw new InvalidAnalyticsExportCursorError();
    }

    const snapshotCreatedAt = 'snapshotCreatedAt' in parsedCursor
        && typeof parsedCursor.snapshotCreatedAt === 'string'
        ? parsedCursor.snapshotCreatedAt
        : null;
    const lastCreatedAt = 'lastCreatedAt' in parsedCursor
        && parsedCursor.lastCreatedAt !== null
        && typeof parsedCursor.lastCreatedAt !== 'string'
        ? null
        : ('lastCreatedAt' in parsedCursor ? parsedCursor.lastCreatedAt : null);
    const lastId = 'lastId' in parsedCursor
        && parsedCursor.lastId !== null
        && typeof parsedCursor.lastId !== 'string'
        ? null
        : ('lastId' in parsedCursor ? parsedCursor.lastId : null);

    const hasValidCursorPair = (
        (lastCreatedAt === null && lastId === null)
        || (
            typeof lastCreatedAt === 'string'
            && typeof lastId === 'string'
            && isValidIsoTimestamp(lastCreatedAt)
        )
    );

    if (!snapshotCreatedAt || !isValidIsoTimestamp(snapshotCreatedAt) || !hasValidCursorPair) {
        throw new InvalidAnalyticsExportCursorError();
    }

    return {
        snapshotCreatedAt,
        lastCreatedAt,
        lastId,
    };
};

type QuizAttemptLike = Pick<
    Database['public']['Tables']['quiz_attempts']['Row'],
    'id' | 'term_id' | 'is_correct' | 'response_time_ms' | 'created_at' | 'quiz_type'
>;

const mapRecentAttempt = (
    attempt: QuizAttemptLike
): LearningRecentAttempt => ({
    id: attempt.id,
    termId: attempt.term_id,
    createdAt: attempt.created_at,
    isCorrect: attempt.is_correct,
    responseTimeMs: attempt.response_time_ms,
    quizType: attempt.quiz_type as LearningRecentAttempt['quizType'],
});

const roundAccuracy = (
    totalReviews: number | null,
    correctReviews: number | null
): number | null => {
    if (totalReviews === null || correctReviews === null) {
        return null;
    }

    if (totalReviews === 0) {
        return 0;
    }

    return Math.round((correctReviews / totalReviews) * 100);
};

const createLearningStatsDefaults = (): LearningStatsData => ({
    heatmap: [],
    currentStreak: 0,
    lastStudyDate: null,
    badges: [],
    activeDays: 0,
    totalActivity: 0,
    todayActivity: 0,
    totalReviews: null,
    correctReviews: null,
    accuracy: null,
    avgResponseTimeMs: null,
    recentAttempts: [],
});

const loadLearningHeatmap = async (
    supabase: AppSupabaseClient
): Promise<LearningStatsData['heatmap']> => {
    const { data, error } = await supabase.rpc('get_user_learning_heatmap');

    if (error) {
        throw new Error(error.message);
    }

    return (data ?? []) as LearningStatsData['heatmap'];
};

const loadLearningStreakSummary = async (
    supabase: AppSupabaseClient,
    userId: string
): Promise<LearningStreakSummary> => {
    const { data, error } = await supabase.rpc('get_user_streak_summary', {
        p_user_id: userId,
    });

    if (error) {
        throw new Error(error.message);
    }

    const summary = Array.isArray(data) ? data[0] : null;

    return {
        currentStreak: summary?.current_streak ?? 0,
        lastStudyDate: summary?.last_study_date ?? null,
    };
};

const loadUserBadges = async (
    supabase: AppSupabaseClient,
    userId: string
): Promise<UserBadgeSummary[]> => {
    const { data, error } = await supabase
        .from('user_badges')
        .select('id, badge_key, badge_type, streak_days, unlocked_at, source_log_date')
        .eq('user_id', userId)
        .order('unlocked_at', { ascending: false });

    if (error) {
        throw new Error(error.message);
    }

    return (data ?? []) as UserBadgeSummary[];
};

const loadLearningMetrics = async (
    supabase: AppSupabaseClient,
    userId: string
): Promise<LearningMetricsSummary> => {
    const { data, error } = await supabase.rpc('get_user_quiz_metrics', {
        p_user_id: userId,
    });

    if (error) {
        throw new Error(error.message);
    }

    const metricsRow = (Array.isArray(data) ? data[0] : data) as QuizMetricsRow | null;
    const totalReviews = metricsRow?.total_reviews ?? null;
    const correctReviews = metricsRow?.correct_reviews ?? null;

    return {
        totalReviews,
        correctReviews,
        accuracy: roundAccuracy(totalReviews, correctReviews),
        avgResponseTimeMs: metricsRow?.avg_response_time_ms ?? null,
    };
};

const loadRecentAttempts = async (
    supabase: AppSupabaseClient,
    userId: string
): Promise<LearningRecentAttempt[]> => {
    const { data, error } = await supabase
        .from('quiz_attempts')
        .select('id, term_id, is_correct, response_time_ms, created_at, quiz_type')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .order('id', { ascending: false })
        .limit(RECENT_ATTEMPTS_LIMIT);

    if (error) {
        throw new Error(error.message);
    }

    return ((data ?? []) as Database['public']['Tables']['quiz_attempts']['Row'][]).map(mapRecentAttempt);
};

const buildAllSegmentsFailedError = (
    settledResults: Array<PromiseSettledResult<unknown>>
): Error => {
    const reasons = settledResults.flatMap((result) => (
        result.status === 'rejected' && result.reason instanceof Error
            ? [result.reason.message]
            : result.status === 'rejected'
                ? ['Learning stats segment failed.']
                : []
    ));

    return new Error(reasons[0] ?? 'Learning stats are unavailable.');
};

const getMissingSegments = (
    settledResults: Array<PromiseSettledResult<unknown>>
): LearningStatsMissingSegment[] => settledResults.flatMap((result, index) => (
    result.status === 'rejected'
        ? [LEARNING_STATS_SEGMENTS[index]!]
        : []
));

/**
 * Load the authenticated user's exact learning summary and recent quiz activity.
 */
export async function loadLearningStatsData(
    supabase: AppSupabaseClient,
    userId: string
): Promise<LearningStatsLoadResult> {
    const settledResults = await Promise.allSettled([
        loadLearningHeatmap(supabase),
        loadLearningStreakSummary(supabase, userId),
        loadUserBadges(supabase, userId),
        loadLearningMetrics(supabase, userId),
        loadRecentAttempts(supabase, userId),
    ]);
    const missing = getMissingSegments(settledResults);

    if (missing.length === LEARNING_STATS_SEGMENTS.length) {
        throw buildAllSegmentsFailedError(settledResults);
    }

    const defaults = createLearningStatsDefaults();
    const heatmap = settledResults[0].status === 'fulfilled' ? settledResults[0].value : defaults.heatmap;
    const streakSummary = settledResults[1].status === 'fulfilled'
        ? settledResults[1].value
        : { currentStreak: defaults.currentStreak, lastStudyDate: defaults.lastStudyDate };
    const badges = settledResults[2].status === 'fulfilled' ? settledResults[2].value : defaults.badges;
    const metrics = settledResults[3].status === 'fulfilled'
        ? settledResults[3].value
        : {
            totalReviews: defaults.totalReviews,
            correctReviews: defaults.correctReviews,
            accuracy: defaults.accuracy,
            avgResponseTimeMs: defaults.avgResponseTimeMs,
        };
    const recentAttempts = settledResults[4].status === 'fulfilled' ? settledResults[4].value : defaults.recentAttempts;

    return {
        data: {
            heatmap,
            currentStreak: streakSummary.currentStreak,
            lastStudyDate: streakSummary.lastStudyDate,
            badges,
            activeDays: heatmap.filter((entry) => entry.activity_count > 0).length,
            totalActivity: heatmap.reduce((sum, entry) => sum + entry.activity_count, 0),
            todayActivity: heatmap[heatmap.length - 1]?.activity_count ?? 0,
            totalReviews: metrics.totalReviews,
            correctReviews: metrics.correctReviews,
            accuracy: metrics.accuracy,
            avgResponseTimeMs: metrics.avgResponseTimeMs,
            recentAttempts,
        },
        degraded: missing.length > 0,
        missing,
    };
}

/**
 * Load the full authenticated quiz attempt history for analytics export.
 */
export async function loadLearningStatsExportAttempts(
    supabase: AppSupabaseClient,
    _userId: string,
    options?: {
        cursor?: string | null;
        limit?: number;
        snapshotCreatedAt?: string;
    }
): Promise<{
    attempts: LearningRecentAttempt[];
    nextCursor: string | null;
    snapshotCreatedAt: string;
}> {
    const cursorState = (() => {
        const rawCursor = options?.cursor?.trim();
        if (!rawCursor) {
            return {
                snapshotCreatedAt: options?.snapshotCreatedAt ?? new Date().toISOString(),
                lastCreatedAt: null,
                lastId: null,
            } satisfies ExportCursorState;
        }

        return decodeExportCursor(rawCursor);
    })();
    const pageSize = Math.min(
        Math.max(1, options?.limit ?? DEFAULT_EXPORT_ATTEMPTS_PAGE_SIZE),
        MAX_EXPORT_ATTEMPTS_PAGE_SIZE
    );
    const fetchLimit = pageSize + 1;

    const { data, error } = await supabase.rpc('get_user_quiz_attempt_export_page', {
        p_snapshot_created_at: cursorState.snapshotCreatedAt,
        p_last_created_at: cursorState.lastCreatedAt,
        p_last_id: cursorState.lastId,
        p_limit: fetchLimit,
    });

    if (error) {
        throw new Error(error.message);
    }

    const rows = (data ?? []) as QuizAttemptLike[];
    const pageRows = rows.slice(0, pageSize);
    const attempts = pageRows.map(mapRecentAttempt);
    const lastRow = pageRows[pageRows.length - 1];
    const nextCursor = rows.length > pageSize && lastRow
        ? encodeExportCursor({
            snapshotCreatedAt: cursorState.snapshotCreatedAt,
            lastCreatedAt: lastRow.created_at,
            lastId: lastRow.id,
        })
        : null;

    return {
        attempts,
        nextCursor,
        snapshotCreatedAt: cursorState.snapshotCreatedAt,
    };
}
