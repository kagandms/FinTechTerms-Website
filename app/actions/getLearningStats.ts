'use server';

import { createApiError } from '@/lib/supabaseUtils';
import type { LearningStatsActionResult } from '@/types/gamification';
import { createOptionalClient } from '@/utils/supabase/server';
import { AUTH_REQUIRED_MESSAGE, safeGetSupabaseUser } from '@/lib/auth/session';
import { logger } from '@/lib/logger';
import { loadLearningStatsData } from '@/lib/learning-stats';

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
        try {
            const learningStatsResult = await loadLearningStatsData(supabase, userId);

            return {
                ok: true,
                data: learningStatsResult.data,
                degraded: learningStatsResult.degraded,
                missing: learningStatsResult.missing,
            };
        } catch (error) {
            logger.error('GET_LEARNING_STATS_LOAD_FAILED', {
                route: 'getLearningStats',
                userId,
                error: error instanceof Error ? error : undefined,
            });
            return sanitizeError('LEARNING_STATS_UNAVAILABLE', 'Unable to load learning stats.', 500);
        }
    } catch (error) {
        logger.error('GET_LEARNING_STATS_UNEXPECTED_ERROR', {
            route: 'getLearningStats',
            error: error instanceof Error ? error : undefined,
        });
        return sanitizeError('INTERNAL_ERROR', 'Unable to load learning stats.', 500);
    }
}
