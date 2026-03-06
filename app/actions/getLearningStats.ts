'use server';

import { createApiError } from '@/lib/supabaseUtils';
import type { LearningStatsActionResult } from '@/types/gamification';
import { createClient } from '@/utils/supabase/server';
import type { LearningHeatmapEntry, UserBadgeSummary } from '@/types/gamification';

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
        const supabase = await createClient();
        const { data: authData, error: authError } = await supabase.auth.getUser();

        if (authError || !authData.user) {
            if (authError) {
                console.error('GET_LEARNING_STATS_AUTH_ERROR', authError);
            }

            return sanitizeError('UNAUTHORIZED', 'Authentication required.', 401);
        }

        const userId = authData.user.id;

        const [heatmapResult, streakResult, badgesResult] = await Promise.all([
            supabase.rpc('get_user_learning_heatmap'),
            supabase.rpc('get_user_streak_summary', {
                p_user_id: userId,
            }),
            supabase
                .from('user_badges')
                .select('id, badge_key, badge_type, streak_days, unlocked_at, source_log_date')
                .eq('user_id', userId)
                .order('unlocked_at', { ascending: false }),
        ]);

        if (heatmapResult.error) {
            console.error('GET_LEARNING_STATS_HEATMAP_ERROR', heatmapResult.error);
            return sanitizeError('LEARNING_STATS_UNAVAILABLE', 'Unable to load learning stats.', 500);
        }

        if (streakResult.error) {
            console.error('GET_LEARNING_STATS_STREAK_ERROR', streakResult.error);
            return sanitizeError('LEARNING_STATS_UNAVAILABLE', 'Unable to load learning stats.', 500);
        }

        if (badgesResult.error) {
            console.error('GET_LEARNING_STATS_BADGES_ERROR', badgesResult.error);
            return sanitizeError('LEARNING_STATS_UNAVAILABLE', 'Unable to load learning stats.', 500);
        }

        const heatmap = (heatmapResult.data ?? []) as LearningHeatmapEntry[];
        const streakSummary = Array.isArray(streakResult.data)
            ? streakResult.data[0]
            : null;
        const badges = (badgesResult.data ?? []) as UserBadgeSummary[];
        const activeDays = heatmap.filter((entry) => entry.activity_count > 0).length;
        const totalActivity = heatmap.reduce((sum, entry) => sum + entry.activity_count, 0);
        const todayActivity = heatmap[heatmap.length - 1]?.activity_count ?? 0;

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
            },
        };
    } catch (error) {
        console.error('GET_LEARNING_STATS_UNEXPECTED_ERROR', error);
        return sanitizeError('INTERNAL_ERROR', 'Unable to load learning stats.', 500);
    }
}
