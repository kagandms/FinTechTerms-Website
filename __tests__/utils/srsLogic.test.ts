/**
 * SRS Logic Unit Tests
 * Skill: tdd-workflow, unit-testing-test-generate
 *
 * Tests the core Spaced Repetition System (Leitner + SM-2) algorithm.
 * Covers: calculateNextReview, getTermsDueForReview, updateTermAfterReview,
 *         calculateRetentionRate, calculateProgressStats
 */

import {
    calculateNextReview,
    getTermsDueForReview,
    updateTermAfterReview,
    calculateRetentionRate,
    calculateProgressStats,
    getIntervalDescription,
    getMasteryLevel,
    SRS_INTERVALS,
    MAX_SRS_LEVEL,
    MIN_SRS_LEVEL,
} from '@/utils/srsLogic';
import { Term } from '@/types';

// ── Test Fixture ──────────────────────────────────────────
function createMockTerm(overrides: Partial<Term> = {}): Term {
    return {
        id: 'test_001',
        term_en: 'Blockchain',
        term_tr: 'Blokzincir',
        term_ru: 'Блокчейн',
        category: 'Fintech',
        definition_en: 'A distributed ledger technology',
        definition_tr: 'Dağıtık defter teknolojisi',
        definition_ru: 'Технология распределённого реестра',
        example_sentence_en: 'Blockchain enables...',
        example_sentence_tr: 'Blockchain sağlar...',
        example_sentence_ru: 'Блокчейн обеспечивает...',
        srs_level: 1,
        next_review_date: new Date().toISOString(),
        last_reviewed: null,
        difficulty_score: 2.5,
        retention_rate: 0,
        times_reviewed: 0,
        times_correct: 0,
        ...overrides,
    };
}

// ══════════════════════════════════════════════════════════
// calculateNextReview
// ══════════════════════════════════════════════════════════
describe('calculateNextReview', () => {
    it('should advance level by 1 on correct answer', () => {
        const result = calculateNextReview(true, 1, 2.5);
        expect(result.newLevel).toBe(2);
    });

    it('should cap level at MAX_SRS_LEVEL on correct answer', () => {
        const result = calculateNextReview(true, MAX_SRS_LEVEL, 2.5);
        expect(result.newLevel).toBe(MAX_SRS_LEVEL);
    });

    it('should decrease difficulty on correct answer', () => {
        const result = calculateNextReview(true, 1, 2.5);
        expect(result.difficultyDelta).toBe(-0.1);
    });

    it('should increase retention rate on correct answer', () => {
        const result = calculateNextReview(true, 1, 2.5);
        expect(result.retentionRateChange).toBe(0.05);
    });

    it('should reset level to MIN_SRS_LEVEL on incorrect answer', () => {
        const result = calculateNextReview(false, 4, 2.5);
        expect(result.newLevel).toBe(MIN_SRS_LEVEL);
    });

    it('should increase difficulty on incorrect answer', () => {
        const result = calculateNextReview(false, 1, 2.5);
        expect(result.difficultyDelta).toBe(0.3);
    });

    it('should decrease retention rate on incorrect answer', () => {
        const result = calculateNextReview(false, 1, 2.5);
        expect(result.retentionRateChange).toBe(-0.1);
    });

    it('should set next review date based on new level interval', () => {
        const result = calculateNextReview(true, 1, 2.5);
        const expectedInterval = SRS_INTERVALS[1] ?? 3; // Level 2 -> index 1, fallback 3 days
        const expectedDate = new Date();
        expectedDate.setDate(expectedDate.getDate() + expectedInterval);
        expectedDate.setHours(0, 0, 0, 0);
        expect(result.nextReviewDate.getTime()).toBe(expectedDate.getTime());
    });

    it('should handle level 0 (below minimum) gracefully', () => {
        const result = calculateNextReview(false, 0, 2.5);
        expect(result.newLevel).toBe(MIN_SRS_LEVEL);
    });

    it('should handle zero difficulty', () => {
        const result = calculateNextReview(true, 1, 0);
        expect(result.difficultyDelta).toBe(-0.1);
    });
});

// ══════════════════════════════════════════════════════════
// getTermsDueForReview
// ══════════════════════════════════════════════════════════
describe('getTermsDueForReview', () => {
    it('should return empty array when no terms are favorited', () => {
        const terms = [createMockTerm()];
        const result = getTermsDueForReview(terms, []);
        expect(result).toEqual([]);
    });

    it('should return empty array when terms list is empty', () => {
        const result = getTermsDueForReview([], ['test_001']);
        expect(result).toEqual([]);
    });

    it('should include favorited terms with past review dates', () => {
        const pastDate = new Date();
        pastDate.setDate(pastDate.getDate() - 1);
        const term = createMockTerm({ next_review_date: pastDate.toISOString() });
        const result = getTermsDueForReview([term], ['test_001']);
        expect(result).toHaveLength(1);
        expect(result[0]?.id).toBe('test_001');
    });

    it('should exclude favorited terms with future review dates', () => {
        const futureDate = new Date();
        futureDate.setDate(futureDate.getDate() + 7);
        const term = createMockTerm({ next_review_date: futureDate.toISOString() });
        const result = getTermsDueForReview([term], ['test_001']);
        expect(result).toHaveLength(0);
    });

    it('should include terms due today', () => {
        const today = new Date();
        today.setHours(12, 0, 0, 0);
        const term = createMockTerm({ next_review_date: today.toISOString() });
        const result = getTermsDueForReview([term], ['test_001']);
        expect(result).toHaveLength(1);
    });

    it('should exclude non-favorited terms', () => {
        const term = createMockTerm({ next_review_date: new Date().toISOString() });
        const result = getTermsDueForReview([term], ['other_id']);
        expect(result).toHaveLength(0);
    });

    it('should sort by review date (earliest first)', () => {
        const date1 = new Date();
        date1.setDate(date1.getDate() - 3);
        const date2 = new Date();
        date2.setDate(date2.getDate() - 1);

        const term1 = createMockTerm({ id: 'a', next_review_date: date2.toISOString() });
        const term2 = createMockTerm({ id: 'b', next_review_date: date1.toISOString() });

        const result = getTermsDueForReview([term1, term2], ['a', 'b']);
        expect(result[0]?.id).toBe('b');
    });
});

// ══════════════════════════════════════════════════════════
// updateTermAfterReview
// ══════════════════════════════════════════════════════════
describe('updateTermAfterReview', () => {
    it('should increment srs_level on correct answer', () => {
        const term = createMockTerm({ srs_level: 2 });
        const result = updateTermAfterReview(term, true);
        expect(result.srs_level).toBe(3);
    });

    it('should reset srs_level to 1 on incorrect answer', () => {
        const term = createMockTerm({ srs_level: 4 });
        const result = updateTermAfterReview(term, false);
        expect(result.srs_level).toBe(1);
    });

    it('should clamp difficulty_score between 0 and 5', () => {
        const hardTerm = createMockTerm({ difficulty_score: 4.9 });
        const harder = updateTermAfterReview(hardTerm, false);
        expect(harder.difficulty_score).toBeLessThanOrEqual(5);

        const easyTerm = createMockTerm({ difficulty_score: 0.05 });
        const easier = updateTermAfterReview(easyTerm, true);
        expect(easier.difficulty_score).toBeGreaterThanOrEqual(0);
    });

    it('should clamp retention_rate between 0 and 1', () => {
        const lowRetention = createMockTerm({ retention_rate: 0.05 });
        const result = updateTermAfterReview(lowRetention, false);
        expect(result.retention_rate).toBeGreaterThanOrEqual(0);

        const highRetention = createMockTerm({ retention_rate: 0.98 });
        const result2 = updateTermAfterReview(highRetention, true);
        expect(result2.retention_rate).toBeLessThanOrEqual(1);
    });

    it('should increment times_reviewed', () => {
        const term = createMockTerm({ times_reviewed: 5 });
        const result = updateTermAfterReview(term, true);
        expect(result.times_reviewed).toBe(6);
    });

    it('should increment times_correct only when correct', () => {
        const term = createMockTerm({ times_correct: 3 });
        expect(updateTermAfterReview(term, true).times_correct).toBe(4);
        expect(updateTermAfterReview(term, false).times_correct).toBe(3);
    });

    it('should set last_reviewed to current timestamp', () => {
        const term = createMockTerm({ last_reviewed: null });
        const result = updateTermAfterReview(term, true);
        expect(result.last_reviewed).not.toBeNull();
    });

    it('should round difficulty_score to 2 decimal places', () => {
        const term = createMockTerm({ difficulty_score: 2.5555 });
        const result = updateTermAfterReview(term, true);
        const decimals = result.difficulty_score.toString().split('.')[1]?.length ?? 0;
        expect(decimals).toBeLessThanOrEqual(2);
    });
});

// ══════════════════════════════════════════════════════════
// calculateRetentionRate
// ══════════════════════════════════════════════════════════
describe('calculateRetentionRate', () => {
    it('should return 0 when no reviews', () => {
        expect(calculateRetentionRate(0, 0)).toBe(0);
    });

    it('should return 1 when all correct', () => {
        expect(calculateRetentionRate(10, 10)).toBe(1);
    });

    it('should return 0.5 when half correct', () => {
        expect(calculateRetentionRate(5, 10)).toBe(0.5);
    });

    it('should round to 2 decimal places', () => {
        expect(calculateRetentionRate(1, 3)).toBe(0.33);
    });
});

// ══════════════════════════════════════════════════════════
// calculateProgressStats
// ══════════════════════════════════════════════════════════
describe('calculateProgressStats', () => {
    it('should return zeros for empty favorites', () => {
        const stats = calculateProgressStats([createMockTerm()], []);
        expect(stats.totalFavorites).toBe(0);
        expect(stats.mastered).toBe(0);
        expect(stats.learning).toBe(0);
        expect(stats.averageRetention).toBe(0);
    });

    it('should count mastered terms (srs_level >= 4)', () => {
        const terms = [
            createMockTerm({ id: 'a', srs_level: 5 }),
            createMockTerm({ id: 'b', srs_level: 4 }),
            createMockTerm({ id: 'c', srs_level: 2 }),
        ];
        const stats = calculateProgressStats(terms, ['a', 'b', 'c']);
        expect(stats.mastered).toBe(2);
        expect(stats.learning).toBe(1);
    });

    it('should calculate average retention correctly', () => {
        const terms = [
            createMockTerm({ id: 'a', retention_rate: 0.8 }),
            createMockTerm({ id: 'b', retention_rate: 0.6 }),
        ];
        const stats = calculateProgressStats(terms, ['a', 'b']);
        expect(stats.averageRetention).toBe(70);
    });

    it('should count due-today terms', () => {
        const pastDate = new Date();
        pastDate.setDate(pastDate.getDate() - 1);
        const futureDate = new Date();
        futureDate.setDate(futureDate.getDate() + 7);
        const terms = [
            createMockTerm({ id: 'a', next_review_date: pastDate.toISOString() }),
            createMockTerm({ id: 'b', next_review_date: futureDate.toISOString() }),
        ];
        const stats = calculateProgressStats(terms, ['a', 'b']);
        expect(stats.dueToday).toBe(1);
    });
});

// ══════════════════════════════════════════════════════════
// getIntervalDescription & getMasteryLevel
// ══════════════════════════════════════════════════════════
describe('getIntervalDescription', () => {
    it('should return correct Turkish descriptions', () => {
        expect(getIntervalDescription(1, 'tr')).toBe('1 gün');
        expect(getIntervalDescription(3, 'tr')).toBe('1 hafta');
        expect(getIntervalDescription(5, 'tr')).toBe('1 ay');
    });

    it('should return correct English descriptions', () => {
        expect(getIntervalDescription(1, 'en')).toBe('1 day');
        expect(getIntervalDescription(5, 'en')).toBe('1 month');
    });

    it('should return correct Russian descriptions', () => {
        expect(getIntervalDescription(1, 'ru')).toBe('1 день');
    });
});

describe('getMasteryLevel', () => {
    it('should return correct mastery labels', () => {
        expect(getMasteryLevel(1, 'en')).toBe('New');
        expect(getMasteryLevel(5, 'en')).toBe('Mastered');
        expect(getMasteryLevel(1, 'tr')).toBe('Yeni');
        expect(getMasteryLevel(5, 'ru')).toBe('Освоено');
    });
});

describe('SRS_INTERVALS', () => {
    it('should have 5 intervals in ascending order', () => {
        expect(SRS_INTERVALS).toHaveLength(5);
        for (let i = 1; i < SRS_INTERVALS.length; i++) {
            expect(SRS_INTERVALS[i]).toBeGreaterThan(SRS_INTERVALS[i - 1]!);
        }
    });

    it('should match [1, 3, 7, 14, 30]', () => {
        expect(Array.from(SRS_INTERVALS)).toEqual([1, 3, 7, 14, 30]);
    });
});
