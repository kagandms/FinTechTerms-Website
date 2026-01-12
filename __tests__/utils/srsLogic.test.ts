import {
    calculateNextReview,
    updateTermAfterReview,
    calculateRetentionRate,
    SRS_INTERVALS,
    MAX_SRS_LEVEL,
    MIN_SRS_LEVEL
} from '../../utils/srsLogic';
import { Term } from '../../types';

describe('SRS Logic', () => {
    describe('calculateNextReview', () => {
        it('should advance level and set easy difficulty on correct answer', () => {
            const currentLevel = 1;
            const currentDifficulty = 2.5;
            const result = calculateNextReview(true, currentLevel, currentDifficulty);

            expect(result.newLevel).toBe(2);
            expect(result.difficultyDelta).toBeLessThan(0); // Should decrease difficulty
            // Date should be tomorrow (1 day interval for level 2, index 1 is 3 days, wait index 0 is 1 day. Let's check logic)
            // Logic: SRS_INTERVALS[newLevel - 1]
            // newLevel 2 -> index 1 -> 3 days
            const expectedDays = SRS_INTERVALS[1];
            const now = new Date();
            const expectedDate = new Date();
            expectedDate.setDate(now.getDate() + expectedDays);

            // Check if date matches roughly (ignoring exact time ms)
            const resultDate = new Date(result.nextReviewDate);
            expect(resultDate.getDate()).toBe(expectedDate.getDate());
        });

        it('should reset to level 1 and increase difficulty on incorrect answer', () => {
            const currentLevel = 3;
            const currentDifficulty = 2.0;
            const result = calculateNextReview(false, currentLevel, currentDifficulty);

            expect(result.newLevel).toBe(MIN_SRS_LEVEL);
            expect(result.difficultyDelta).toBeGreaterThan(0); // Should increase difficulty

            // Should verify schedule for level 1
            const expectedDays = SRS_INTERVALS[0]; // 1 day
            const now = new Date();
            const expectedDate = new Date();
            expectedDate.setDate(now.getDate() + expectedDays);

            const resultDate = new Date(result.nextReviewDate);
            expect(resultDate.getDate()).toBe(expectedDate.getDate());
        });

        it('should not exceed MAX_SRS_LEVEL', () => {
            const result = calculateNextReview(true, MAX_SRS_LEVEL, 1.0);
            expect(result.newLevel).toBe(MAX_SRS_LEVEL);
        });
    });

    describe('calculateRetentionRate', () => {
        it('should calculate correct percentage', () => {
            expect(calculateRetentionRate(8, 10)).toBe(0.8);
            expect(calculateRetentionRate(1, 3)).toBe(0.33);
            expect(calculateRetentionRate(0, 5)).toBe(0);
        });

        it('should handle zero reviews', () => {
            expect(calculateRetentionRate(0, 0)).toBe(0);
        });
    });

    describe('updateTermAfterReview', () => {
        const mockTerm: Term = {
            id: 'test_1',
            term_en: 'Test',
            term_ru: 'Test',
            term_tr: 'Test',
            definition_en: 'Test def',
            definition_ru: 'Test def',
            definition_tr: 'Test def',
            example_sentence_en: 'Ex',
            example_sentence_ru: 'Ex',
            example_sentence_tr: 'Ex',
            category: 'Finance',
            srs_level: 2,
            difficulty_score: 2.5,
            retention_rate: 0.5,
            times_reviewed: 10,
            times_correct: 5,
            next_review_date: new Date().toISOString(),
            last_reviewed: null
        };

        it('should update term stats correctly on success', () => {
            const updated = updateTermAfterReview(mockTerm, true);

            expect(updated.srs_level).toBe(3);
            expect(updated.times_reviewed).toBe(11);
            expect(updated.times_correct).toBe(6);
            expect(updated.difficulty_score).toBeLessThan(mockTerm.difficulty_score);
            expect(updated.retention_rate).toBeGreaterThan(mockTerm.retention_rate);
        });
    });
});
