'use server';

import { createApiError } from '@/lib/supabaseUtils';
import type { LearningStatsActionResult } from '@/types/gamification';
import { createOptionalClient } from '@/utils/supabase/server';
import type { LearningHeatmapEntry, UserBadgeSummary } from '@/types/gamification';
import { AUTH_REQUIRED_MESSAGE, safeGetSupabaseUser } from '@/lib/auth/session';
import { logger } from '@/lib/logger';

const sanitizeError = (
    code: string,
    message: string,
    status: number
): LearningStatsActionResult => ({
    ok: false,
    error: createApiError(code, message, status).error,
});

export async function getLearningStats(): Promise<LearningStatsActionResult> {
    try {
        const supabase = await createOptionalClient();

        if (!supabase) {
            return sanitizeError('UNAUTHORIZED', AUTH_REQUIRED_MESSAGE, 401);
        }

        const authState = await safeGetSupabaseUser(supabase);

        if (!authState.user) {
            if (!authState.ghostSession && authState.message && authState.message !== AUTH_REQUIRED_MESSAGE) {
                logger.warn('GET_LEARNING_STATS_AUTH_ERROR', {
                    route: 'getLearningStats',
                    message: authState.message,
                });
            }

            return sanitizeError('UNAUTHORIZED', AUTH_REQUIRED_MESSAGE, 401);
        }

        const userId = authState.user.id;

        const [heatmapResult, streakResult, badgesResult, reviewCountResult, correctReviewCountResult] = await Promise.all([
            supabase.rpc('get_user_learning_heatmap'),
            supabase.rpc('get_user_streak_summary', {
                p_user_id: userId,
            }),
            supabase
                .from('user_badges')
                .select('id, badge_key, badge_type, streak_days, unlocked_at, source_log_date')
                .eq('user_id', userId)
                .order('unlocked_at', { ascending: false }),
            supabase
                .from('quiz_attempts')
                .select('id', { count: 'exact', head: true })
                .eq('user_id', userId),
            supabase
                .from('quiz_attempts')
                .select('id', { count: 'exact', head: true })
                .eq('user_id', userId)
                .eq('is_correct', true),
        ]);

        if (heatmapResult.error) {
            logger.error('GET_LEARNING_STATS_HEATMAP_ERROR', {
                route: 'getLearningStats',
                userId,
                error: new Error(heatmapResult.error.message),
            });
            return sanitizeError('LEARNING_STATS_UNAVAILABLE', 'Unable to load learning stats.', 500);
        }

        if (streakResult.error) {
            logger.error('GET_LEARNING_STATS_STREAK_ERROR', {
                route: 'getLearningStats',
                userId,
                error: new Error(streakResult.error.message),
            });
            return sanitizeError('LEARNING_STATS_UNAVAILABLE', 'Unable to load learning stats.', 500);
        }

        if (badgesResult.error) {
            logger.error('GET_LEARNING_STATS_BADGES_ERROR', {
                route: 'getLearningStats',
                userId,
                error: new Error(badgesResult.error.message),
            });
            return sanitizeError('LEARNING_STATS_UNAVAILABLE', 'Unable to load learning stats.', 500);
        }

        if (reviewCountResult.error) {
            logger.warn('GET_LEARNING_STATS_REVIEW_COUNT_ERROR', {
                route: 'getLearningStats',
                userId,
                error: new Error(reviewCountResult.error.message),
            });
        }

        if (correctReviewCountResult.error) {
            logger.warn('GET_LEARNING_STATS_CORRECT_REVIEW_COUNT_ERROR', {
                route: 'getLearningStats',
                userId,
                error: new Error(correctReviewCountResult.error.message),
            });
        }

        const heatmap = (heatmapResult.data ?? []) as LearningHeatmapEntry[];
        const streakSummary = Array.isArray(streakResult.data)
            ? streakResult.data[0]
            : null;
        const badges = (badgesResult.data ?? []) as UserBadgeSummary[];
        const activeDays = heatmap.filter((entry) => entry.activity_count > 0).length;
        const totalActivity = heatmap.reduce((sum, entry) => sum + entry.activity_count, 0);
        const todayActivity = heatmap[heatmap.length - 1]?.activity_count ?? 0;
        const reviewCountsUnavailable = reviewCountResult.error || correctReviewCountResult.error;
        const totalReviews = reviewCountsUnavailable
            ? null
            : (reviewCountResult.count ?? 0);
        const correctReviews = reviewCountsUnavailable
            ? null
            : (correctReviewCountResult.count ?? 0);

        return {
            ok: true,
            data: {
                heatmap,
                currentStreak: streakSummary?.current_streak ?? 0,
                lastStudyDate: streakSummary?.last_study_date ?? null,
                badges,
                activeDays,
                totalActivity,
                todayActivity,
                totalReviews,
                correctReviews,
            },
        };
    } catch (error) {
        logger.error('GET_LEARNING_STATS_UNEXPECTED_ERROR', {
            route: 'getLearningStats',
            error: error instanceof Error ? error : undefined,
        });
        return sanitizeError('INTERNAL_ERROR', 'Unable to load learning stats.', 500);
    }
}
