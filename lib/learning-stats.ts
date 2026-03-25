import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/supabase';
import type {
    LearningRecentAttempt,
    LearningStatsData,
    UserBadgeSummary,
} from '@/types/gamification';

type AppSupabaseClient = SupabaseClient;

interface QuizMetricsRow {
    total_reviews: number | null;
    correct_reviews: number | null;
    avg_response_time_ms: number | null;
}

const RECENT_ATTEMPTS_LIMIT = 10;
const EXPORT_ATTEMPTS_PAGE_SIZE = 1000;

const mapRecentAttempt = (
    attempt: Database['public']['Tables']['quiz_attempts']['Row']
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

/**
 * Load the authenticated user's exact learning summary and recent quiz activity.
 */
export async function loadLearningStatsData(
    supabase: AppSupabaseClient,
    userId: string
): Promise<LearningStatsData> {
    const [heatmapResult, streakResult, badgesResult, metricsResult, recentAttemptsResult] = await Promise.all([
        supabase.rpc('get_user_learning_heatmap'),
        supabase.rpc('get_user_streak_summary', {
            p_user_id: userId,
        }),
        supabase
            .from('user_badges')
            .select('id, badge_key, badge_type, streak_days, unlocked_at, source_log_date')
            .eq('user_id', userId)
            .order('unlocked_at', { ascending: false }),
        supabase.rpc('get_user_quiz_metrics', {
            p_user_id: userId,
        }),
        supabase
            .from('quiz_attempts')
            .select('id, term_id, is_correct, response_time_ms, created_at, quiz_type')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .order('id', { ascending: false })
            .limit(RECENT_ATTEMPTS_LIMIT),
    ]);

    if (heatmapResult.error) {
        throw new Error(heatmapResult.error.message);
    }

    if (streakResult.error) {
        throw new Error(streakResult.error.message);
    }

    if (badgesResult.error) {
        throw new Error(badgesResult.error.message);
    }

    if (metricsResult.error) {
        throw new Error(metricsResult.error.message);
    }

    if (recentAttemptsResult.error) {
        throw new Error(recentAttemptsResult.error.message);
    }

    const heatmap = (heatmapResult.data ?? []) as LearningStatsData['heatmap'];
    const streakSummary = Array.isArray(streakResult.data)
        ? streakResult.data[0]
        : null;
    const badges = (badgesResult.data ?? []) as UserBadgeSummary[];
    const metricsRow = (Array.isArray(metricsResult.data) ? metricsResult.data[0] : metricsResult.data) as QuizMetricsRow | null;
    const totalReviews = metricsRow?.total_reviews ?? null;
    const correctReviews = metricsRow?.correct_reviews ?? null;

    return {
        heatmap,
        currentStreak: streakSummary?.current_streak ?? 0,
        lastStudyDate: streakSummary?.last_study_date ?? null,
        badges,
        activeDays: heatmap.filter((entry) => entry.activity_count > 0).length,
        totalActivity: heatmap.reduce((sum, entry) => sum + entry.activity_count, 0),
        todayActivity: heatmap[heatmap.length - 1]?.activity_count ?? 0,
        totalReviews,
        correctReviews,
        accuracy: roundAccuracy(totalReviews, correctReviews),
        avgResponseTimeMs: metricsRow?.avg_response_time_ms ?? null,
        recentAttempts: ((recentAttemptsResult.data ?? []) as Database['public']['Tables']['quiz_attempts']['Row'][]).map(mapRecentAttempt),
    };
}

/**
 * Load the full authenticated quiz attempt history for analytics export.
 */
export async function loadLearningStatsExportAttempts(
    supabase: AppSupabaseClient,
    userId: string
): Promise<LearningRecentAttempt[]> {
    const attempts: LearningRecentAttempt[] = [];

    for (let start = 0; ; start += EXPORT_ATTEMPTS_PAGE_SIZE) {
        const end = start + EXPORT_ATTEMPTS_PAGE_SIZE - 1;
        const { data, error } = await supabase
            .from('quiz_attempts')
            .select('id, term_id, is_correct, response_time_ms, created_at, quiz_type')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .order('id', { ascending: false })
            .range(start, end);

        if (error) {
            throw new Error(error.message);
        }

        const page = ((data ?? []) as Database['public']['Tables']['quiz_attempts']['Row'][]).map(mapRecentAttempt);
        attempts.push(...page);

        if (page.length < EXPORT_ATTEMPTS_PAGE_SIZE) {
            return attempts;
        }
    }
}
