import type { Database } from '@/types/supabase';

export type LearningHeatmapEntry =
    Database['public']['Functions']['get_user_learning_heatmap']['Returns'][number];

export type UserBadgeSummary = Pick<
    Database['public']['Tables']['user_badges']['Row'],
    'id' | 'badge_key' | 'badge_type' | 'streak_days' | 'unlocked_at' | 'source_log_date'
>;

export interface LearningStatsData {
    heatmap: LearningHeatmapEntry[];
    currentStreak: number;
    lastStudyDate: string | null;
    badges: UserBadgeSummary[];
    activeDays: number;
    totalActivity: number;
    todayActivity: number;
    totalReviews: number | null;
    correctReviews: number | null;
}

export interface ActionErrorPayload {
    code: string;
    message: string;
    status: number;
}

export type LearningStatsActionResult =
    | { ok: true; data: LearningStatsData }
    | { ok: false; error: ActionErrorPayload };
