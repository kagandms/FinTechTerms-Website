import type { UserProgress } from '@/types';
import type { UserProgressLoadMissingSegment } from '@/lib/supabaseStorage';

export interface PendingReview {
    reviewId: string;
    termId: string;
    isCorrect: boolean;
    responseTimeMs: number;
    idempotencyKey: string;
}

export const createSafeProgress = (userId?: string | null): UserProgress => ({
    user_id: userId && userId.trim().length > 0 ? userId : 'guest',
    favorites: [],
    current_language: 'ru',
    quiz_history: [],
    total_words_learned: 0,
    current_streak: 0,
    last_study_date: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
});

export const getErrorMessage = (error: unknown, fallbackMessage: string): string => {
    if (error instanceof Error && error.message.trim().length > 0) {
        return error.message;
    }

    return fallbackMessage;
};

export const hasCachedStudyData = (progress: UserProgress): boolean => (
    progress.favorites.length > 0
    || progress.quiz_history.length > 0
    || progress.total_words_learned > 0
    || progress.current_streak > 0
    || progress.last_study_date !== null
);

export const isPendingReview = (value: unknown): value is PendingReview => {
    if (!value || typeof value !== 'object') {
        return false;
    }

    const candidate = value as Partial<PendingReview>;
    return (
        typeof candidate.reviewId === 'string'
        && typeof candidate.termId === 'string'
        && typeof candidate.isCorrect === 'boolean'
        && typeof candidate.responseTimeMs === 'number'
        && Number.isFinite(candidate.responseTimeMs)
        && typeof candidate.idempotencyKey === 'string'
    );
};

export const mergeUserProgressSnapshot = (
    localProgress: UserProgress,
    remoteProgress: UserProgress,
    missingSegments: readonly UserProgressLoadMissingSegment[]
): UserProgress => {
    const missing = new Set<UserProgressLoadMissingSegment>(missingSegments);

    return {
        ...remoteProgress,
        favorites: missing.has('favorites')
            ? localProgress.favorites
            : remoteProgress.favorites,
        current_language: missing.has('user_settings')
            ? localProgress.current_language
            : remoteProgress.current_language,
        quiz_history: missing.has('recent_quiz_history')
            ? localProgress.quiz_history
            : remoteProgress.quiz_history,
        total_words_learned: missing.has('user_progress')
            ? localProgress.total_words_learned
            : remoteProgress.total_words_learned,
        current_streak: missing.has('streak_summary')
            ? localProgress.current_streak
            : remoteProgress.current_streak,
        last_study_date: missing.has('streak_summary')
            ? localProgress.last_study_date
            : remoteProgress.last_study_date,
        created_at: missing.has('user_progress')
            ? localProgress.created_at
            : remoteProgress.created_at,
        updated_at: missing.has('user_progress')
            ? localProgress.updated_at
            : remoteProgress.updated_at,
    };
};
