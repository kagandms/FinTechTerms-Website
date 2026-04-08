// ============================================
// GlobalFinTerm - SRS (Spaced Repetition System) Logic
// Based on Leitner System with SuperMemo-2 enhancements
// ============================================

import { Term, SRSResult } from '@/types';
import { addUtcDays, endOfUtcDay } from '@/lib/time';

/**
 * Leitner Box Intervals (in days)
 * Box 1: 1 day   - New/Reset words
 * Box 2: 3 days  - Starting to learn
 * Box 3: 7 days  - Learning
 * Box 4: 14 days - Reviewing
 * Box 5: 30 days - Mastered
 */
export const SRS_INTERVALS: readonly number[] = [1, 3, 7, 14, 30] as const;

/**
 * Maximum SRS level (Leitner box number)
 */
export const MAX_SRS_LEVEL = 5;

/**
 * Minimum SRS level
 */
export const MIN_SRS_LEVEL = 1;

const normalizeSrsLevel = (level: number): number => {
    if (!Number.isFinite(level)) {
        return MIN_SRS_LEVEL;
    }

    return Math.min(
        MAX_SRS_LEVEL,
        Math.max(MIN_SRS_LEVEL, Math.trunc(level))
    );
};

/**
 * Calculate the next review schedule based on answer correctness
 * 
 * @param isCorrect - Whether the user answered correctly
 * @param currentLevel - Current Leitner box level (1-5)
 * @param currentDifficulty - Current difficulty score (0-5)
 * @returns SRSResult with new level, next review date, and difficulty change
 */
export function calculateNextReview(
    isCorrect: boolean,
    currentLevel: number,
    currentDifficulty: number
): SRSResult {
    let newLevel: number;
    let difficultyDelta: number;

    if (isCorrect) {
        // Move to next box (max 5)
        newLevel = Math.min(currentLevel + 1, MAX_SRS_LEVEL);
        // Decrease difficulty slightly (easier word)
        difficultyDelta = -0.1;
    } else {
        // Reset to box 1 (start over)
        newLevel = MIN_SRS_LEVEL;
        // Increase difficulty (harder word)
        difficultyDelta = 0.3;
    }

    // Calculate next review date
    const intervalDays = SRS_INTERVALS[newLevel - 1] ?? SRS_INTERVALS[0] ?? 1;
    const nextReviewDate = addUtcDays(new Date(), intervalDays);

    return {
        newLevel,
        nextReviewDate,
        difficultyDelta,
    };
}

/**
 * Get terms that are due for review today or earlier
 * 
 * @param terms - Array of all terms
 * @param favoriteIds - Array of favorite term IDs (only favorites are quizzed)
 * @returns Terms that need to be reviewed
 */
export function getTermsDueForReview(terms: Term[], favoriteIds: string[]): Term[] {
    const now = endOfUtcDay(new Date());

    return terms.filter(term => {
        // Only include favorited terms
        if (!favoriteIds.includes(term.id)) return false;

        // Check if review is due
        const reviewDate = new Date(term.next_review_date);
        return reviewDate <= now;
    }).sort((a, b) => {
        // Sort by review date (earliest first)
        return new Date(a.next_review_date).getTime() - new Date(b.next_review_date).getTime();
    });
}

/**
 * Update a term's SRS data after a quiz attempt
 * 
 * @param term - The term being reviewed
 * @param isCorrect - Whether the answer was correct
 * @returns Updated term with new SRS values
 */
export function updateTermAfterReview(term: Term, isCorrect: boolean): Term {
    const normalizedCurrentLevel = normalizeSrsLevel(term.srs_level);
    const result = calculateNextReview(isCorrect, normalizedCurrentLevel, term.difficulty_score);

    // Calculate new difficulty (clamp between 0 and 5)
    const newDifficulty = Math.max(0, Math.min(5, term.difficulty_score + result.difficultyDelta));

    // Update review counts
    const newTimesReviewed = term.times_reviewed + 1;
    const newTimesCorrect = isCorrect ? term.times_correct + 1 : term.times_correct;
    const newRetentionRate = calculateRetentionRate(newTimesCorrect, newTimesReviewed);

    return {
        ...term,
        srs_level: result.newLevel,
        next_review_date: result.nextReviewDate.toISOString(),
        last_reviewed: new Date().toISOString(),
        difficulty_score: Math.round(newDifficulty * 100) / 100, // Round to 2 decimals
        retention_rate: Math.round(newRetentionRate * 100) / 100,
        times_reviewed: newTimesReviewed,
        times_correct: newTimesCorrect,
    };
}

/**
 * Calculate the retention rate based on review history
 * 
 * @param timesCorrect - Number of correct answers
 * @param timesReviewed - Total number of reviews
 * @returns Retention rate as decimal (0-1)
 */
export function calculateRetentionRate(timesCorrect: number, timesReviewed: number): number {
    if (timesReviewed === 0) return 0;
    return Math.round((timesCorrect / timesReviewed) * 100) / 100;
}

/**
 * Get the interval description for a given SRS level
 * 
 * @param level - SRS level (1-5)
 * @param language - Display language
 * @returns Human-readable interval string
 */
export function getIntervalDescription(level: number, language: 'tr' | 'en' | 'ru'): string {
    const safeLevel = normalizeSrsLevel(level);
    const intervalDays = SRS_INTERVALS[safeLevel - 1] ?? 1;

    const descriptions = {
        tr: {
            1: '1 gün',
            3: '3 gün',
            7: '1 hafta',
            14: '2 hafta',
            30: '1 ay',
        },
        en: {
            1: '1 day',
            3: '3 days',
            7: '1 week',
            14: '2 weeks',
            30: '1 month',
        },
        ru: {
            1: '1 день',
            3: '3 дня',
            7: '1 неделя',
            14: '2 недели',
            30: '1 месяц',
        },
    };

    return descriptions[language][intervalDays as keyof typeof descriptions.tr] ?? `${intervalDays} days`;
}

/**
 * Get the mastery level description based on SRS level
 * 
 * @param level - SRS level (1-5)
 * @param language - Display language
 * @returns Mastery level string
 */
export function getMasteryLevel(level: number, language: 'tr' | 'en' | 'ru'): string {
    const safeLevel = normalizeSrsLevel(level);
    const levels = {
        tr: ['Yeni', 'Öğrenme', 'Geliştirme', 'Pekiştirme', 'Ustalaşmış'],
        en: ['New', 'Learning', 'Developing', 'Reviewing', 'Mastered'],
        ru: ['Новое', 'Изучение', 'Развитие', 'Повторение', 'Освоено'],
    };

    return levels[language][safeLevel - 1] ?? levels[language][0] ?? '';
}

/**
 * Calculate overall progress statistics
 * 
 * @param terms - All terms
 * @param favoriteIds - Favorite term IDs
 * @returns Progress statistics
 */
export function calculateProgressStats(
    terms: Term[],
    favoriteIds: string[]
): {
    totalFavorites: number;
    mastered: number;
    learning: number;
    dueToday: number;
    averageRetention: number;
} {
    const favoriteTerms = terms.filter(t => favoriteIds.includes(t.id));
    const now = endOfUtcDay(new Date());

    const mastered = favoriteTerms.filter(t => t.srs_level >= 4).length;
    const learning = favoriteTerms.filter(t => t.srs_level < 4).length;
    const dueToday = favoriteTerms.filter(t => new Date(t.next_review_date) <= now).length;

    const totalRetention = favoriteTerms.reduce((sum, t) => sum + t.retention_rate, 0);
    const averageRetention = favoriteTerms.length > 0
        ? Math.round((totalRetention / favoriteTerms.length) * 100)
        : 0;

    return {
        totalFavorites: favoriteTerms.length,
        mastered,
        learning,
        dueToday,
        averageRetention,
    };
}
