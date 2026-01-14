
import {
    calculateNextReview,
    getTermsDueForReview,
    updateTermAfterReview,
    calculateProgressStats,
    SRS_INTERVALS,
    MAX_SRS_LEVEL,
    MIN_SRS_LEVEL
} from '../../utils/srsLogic';
import { Term } from '../../types';

// Mock Term Factory
const createMockTerm = (overrides?: Partial<Term>): Term => ({
    id: 'term_1',
    term_en: 'Test',
    term_tr: 'Test',
    term_ru: 'Test',
    category: 'Fintech',
    definition_en: 'Def',
    definition_tr: 'Tanım',
    definition_ru: 'Def',
    example_sentence_en: 'Ex',
    example_sentence_tr: 'Ex',
    example_sentence_ru: 'Ex',
    srs_level: 1,
    next_review_date: new Date().toISOString(), // Due now
    last_reviewed: null,
    difficulty_score: 2.5,
    retention_rate: 0,
    times_reviewed: 0,
    times_correct: 0,
    ...overrides
});

describe('SRS Logic Utils', () => {

    describe('calculateNextReview', () => {
        it('should advance level and set correct interval on correct answer', () => {
            const currentLevel = 1;
            const result = calculateNextReview(true, currentLevel, 2.5);

            expect(result.newLevel).toBe(2);
            expect(result.difficultyDelta).toBeLessThan(0); // Should get easier
            expect(result.retentionRateChange).toBeGreaterThan(0); // Retention should improve

            // Check date calculation (approximate to avoid milliseconds drift)
            const expectedDate = new Date();
            expectedDate.setDate(new Date().getDate() + SRS_INTERVALS[1]); // New level 2 -> index 1 (3 days)
            expectedDate.setHours(0, 0, 0, 0);

            expect(result.nextReviewDate.getTime()).toBe(expectedDate.getTime());
        });

        it('should reset level to 1 on incorrect answer', () => {
            const currentLevel = 4;
            const result = calculateNextReview(false, currentLevel, 2.5);

            expect(result.newLevel).toBe(MIN_SRS_LEVEL);
            expect(result.difficultyDelta).toBeGreaterThan(0); // Should get harder
            expect(result.retentionRateChange).toBeLessThan(0); // Retention should drop

            // Check date calculation (Day 1 interval)
            const expectedDate = new Date();
            expectedDate.setDate(new Date().getDate() + SRS_INTERVALS[0]);
            expectedDate.setHours(0, 0, 0, 0);

            expect(result.nextReviewDate.getTime()).toBe(expectedDate.getTime());
        });

        it('should cap level at MAX_SRS_LEVEL', () => {
            const result = calculateNextReview(true, MAX_SRS_LEVEL, 2.5);
            expect(result.newLevel).toBe(MAX_SRS_LEVEL);
        });
    });

    describe('getTermsDueForReview', () => {
        it('should return only favorited terms that are due', () => {
            const pastDate = new Date();
            pastDate.setDate(pastDate.getDate() - 1);

            const futureDate = new Date();
            futureDate.setDate(futureDate.getDate() + 1);

            const terms = [
                createMockTerm({ id: '1', next_review_date: pastDate.toISOString() }), // Due
                createMockTerm({ id: '2', next_review_date: futureDate.toISOString() }), // Not Due
                createMockTerm({ id: '3', next_review_date: pastDate.toISOString() }), // Due but not favorite
            ];

            const favorites = ['1', '2']; // 3 is not favorite

            const due = getTermsDueForReview(terms, favorites);

            expect(due).toHaveLength(1);
            expect(due[0].id).toBe('1');
        });

        it('should sort terms by review date (earliest first)', () => {
            const pastDate1 = new Date(); // Today
            const pastDate2 = new Date();
            pastDate2.setDate(pastDate2.getDate() - 5); // 5 days ago (Overdue)

            const terms = [
                createMockTerm({ id: '1', next_review_date: pastDate1.toISOString() }),
                createMockTerm({ id: '2', next_review_date: pastDate2.toISOString() }),
            ];

            const due = getTermsDueForReview(terms, ['1', '2']);

            expect(due[0].id).toBe('2'); // Oldest overdue first
            expect(due[1].id).toBe('1');
        });
    });

    describe('updateTermAfterReview', () => {
        it('should correctly update term properties', () => {
            const term = createMockTerm({ srs_level: 1, difficulty_score: 2.5, retention_rate: 0.5 });

            const updated = updateTermAfterReview(term, true);

            expect(updated.srs_level).toBe(2);
            expect(updated.times_reviewed).toBe(1);
            expect(updated.times_correct).toBe(1);
            expect(updated.difficulty_score).toBeLessThan(2.5);
            expect(updated.retention_rate).toBeGreaterThan(0.5);
            expect(updated.last_reviewed).toBeDefined();
        });

        it('should clamp difficulty score between 0 and 5', () => {
            // Case 1: Try to go below 0
            const easyTerm = createMockTerm({ srs_level: 1, difficulty_score: 0.05 });
            const updatedEasy = updateTermAfterReview(easyTerm, true); // Correct usually reduces difficulty
            expect(updatedEasy.difficulty_score).toBeGreaterThanOrEqual(0);

            // Case 2: Try to go above 5
            const hardTerm = createMockTerm({ srs_level: 1, difficulty_score: 4.9 });
            const updatedHard = updateTermAfterReview(hardTerm, false); // Incorrect increases difficulty
            expect(updatedHard.difficulty_score).toBeLessThanOrEqual(5);
        });
    });

    describe('calculateProgressStats', () => {
        it('should calculate stats correctly', () => {
            const today = new Date();
            const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);

            const terms = [
                // Mastered (> level 4)
                createMockTerm({ id: '1', srs_level: 4, next_review_date: tomorrow.toISOString(), retention_rate: 0.9 }),
                createMockTerm({ id: '2', srs_level: 5, next_review_date: tomorrow.toISOString(), retention_rate: 1.0 }),
                // Learning (< level 4)
                createMockTerm({ id: '3', srs_level: 1, next_review_date: today.toISOString(), retention_rate: 0.2 }),
                // Not Favorite
                createMockTerm({ id: '4', srs_level: 5 }),
            ];

            const favorites = ['1', '2', '3'];

            const stats = calculateProgressStats(terms, favorites);

            expect(stats.totalFavorites).toBe(3);
            expect(stats.mastered).toBe(2); // Term 1 and 2
            expect(stats.learning).toBe(1); // Term 3
            expect(stats.dueToday).toBe(1); // Term 3 is due today

            // Average Retention: (0.9 + 1.0 + 0.2) / 3 = 2.1 / 3 = 0.7 -> 70%
            expect(stats.averageRetention).toBe(70);
        });
    });
});
