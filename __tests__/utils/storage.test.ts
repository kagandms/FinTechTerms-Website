/**
 * Storage Utility Unit Tests
 * Skill: tdd-workflow, unit-testing-test-generate
 *
 * Tests localStorage wrapper functions with mock localStorage.
 */

import { Term, UserProgress } from '@/types';
import { DEFAULT_LANGUAGE, LANGUAGE_COOKIE_NAME } from '@/lib/language';
import { RECENT_QUIZ_HISTORY_LIMIT } from '@/lib/userProgress';

// ── Mock localStorage ─────────────────────────────────────
const localStorageMock = (() => {
    let store: Record<string, string> = {};
    return {
        getItem: jest.fn((key: string) => store[key] ?? null),
        setItem: jest.fn((key: string, value: string) => { store[key] = value; }),
        removeItem: jest.fn((key: string) => { delete store[key]; }),
        clear: jest.fn(() => { store = {}; }),
        get length() { return Object.keys(store).length; },
        key: jest.fn((i: number) => Object.keys(store)[i] ?? null),
    };
})();

Object.defineProperty(window, 'localStorage', { value: localStorageMock });

// Import after mocking
import {
    getTerms,
    saveTerms,
    updateTerm,
    getUserProgress,
    saveUserProgress,
    toggleFavorite,
    addQuizAttempt,
    getGuestQuizPreview,
    recordGuestQuizPreviewAttempt,
    getMistakeReviewQueue,
    recordMistakeReviewMiss,
    removeMistakeReviewTerm,
    getCurrentLanguage,
    setCurrentLanguage,
    resetAllData,
} from '@/utils/storage';

const createProgress = (overrides: Partial<UserProgress> = {}): UserProgress => ({
    user_id: 'user_1',
    favorites: [],
    current_language: 'ru',
    quiz_history: [],
    total_words_learned: 0,
    current_streak: 0,
    last_study_date: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
});

beforeEach(() => {
    localStorageMock.clear();
    document.cookie = `${LANGUAGE_COOKIE_NAME}=; Path=/; Max-Age=0; SameSite=Lax`;
    jest.clearAllMocks();
});

// ══════════════════════════════════════════════════════════
// getTerms
// ══════════════════════════════════════════════════════════
describe('getTerms', () => {
    it('should return terms from localStorage when available', () => {
        const terms = getTerms();
        expect(Array.isArray(terms)).toBe(true);
        expect(terms.length).toBeGreaterThan(0);
    });

    it('should initialize localStorage with mock data on first call', () => {
        getTerms();
        expect(localStorageMock.setItem).toHaveBeenCalled();
    });

    it('should preserve compatible local SRS fields when migrating cached terms to a new data version', () => {
        const baselineTerms = getTerms();
        const baselineTerm = baselineTerms[0];

        expect(baselineTerm).toBeDefined();
        if (!baselineTerm) {
            throw new Error('Expected at least one baseline term.');
        }

        const staleCachedTerm = {
            ...baselineTerm,
            srs_level: 4,
            next_review_date: '2099-01-01T00:00:00.000Z',
            last_reviewed: '2026-03-18T00:00:00.000Z',
            difficulty_score: 1.75,
            retention_rate: 0.91,
            times_reviewed: 12,
            times_correct: 11,
        };

        localStorageMock.removeItem('globalfinterm_terms:guest');
        localStorageMock.removeItem('globalfinterm_data_version:guest');
        localStorageMock.setItem('globalfinterm_terms', JSON.stringify([staleCachedTerm]));
        localStorageMock.setItem('globalfinterm_data_version', '2026-02-01-v1');

        const migratedTerms = getTerms();
        const migratedTerm = migratedTerms.find((term) => term.id === baselineTerm.id);

        expect(migratedTerm).toMatchObject({
            id: baselineTerm.id,
            srs_level: 4,
            next_review_date: '2099-01-01T00:00:00.000Z',
            last_reviewed: '2026-03-18T00:00:00.000Z',
            difficulty_score: 1.75,
            retention_rate: 0.91,
            times_reviewed: 12,
            times_correct: 11,
        });
        expect(localStorageMock.getItem('globalfinterm_terms:guest')).not.toBeNull();
        expect(localStorageMock.getItem('globalfinterm_data_version:guest')).toBe('2026-03-25-v5');
        expect(localStorageMock.getItem('globalfinterm_terms')).toBeNull();
        expect(localStorageMock.getItem('globalfinterm_data_version')).toBeNull();
    });

    it('should isolate authenticated terms from guest cached term state', () => {
        const guestTerms = getTerms();
        const guestFirstTerm = guestTerms[0];

        expect(guestFirstTerm).toBeDefined();
        if (!guestFirstTerm) {
            throw new Error('Expected at least one guest term.');
        }

        saveTerms([
            {
                ...guestFirstTerm,
                times_reviewed: 9,
                times_correct: 8,
                retention_rate: 0.89,
            },
            ...guestTerms.slice(1),
        ]);

        const authenticatedTerms = getTerms('user_42');
        const authenticatedFirstTerm = authenticatedTerms.find((term) => term.id === guestFirstTerm.id);

        expect(authenticatedFirstTerm).toBeDefined();
        expect(authenticatedFirstTerm).toMatchObject({
            id: guestFirstTerm.id,
            times_reviewed: guestFirstTerm.times_reviewed,
            times_correct: guestFirstTerm.times_correct,
            retention_rate: guestFirstTerm.retention_rate,
        });
    });
});

// ══════════════════════════════════════════════════════════
// saveTerms
// ══════════════════════════════════════════════════════════
describe('saveTerms', () => {
    it('should save terms to localStorage', () => {
        const terms = getTerms();
        saveTerms(terms);
        expect(localStorageMock.setItem).toHaveBeenCalledWith(
            'globalfinterm_terms:guest',
            expect.any(String)
        );
    });
});

// ══════════════════════════════════════════════════════════
// getUserProgress
// ══════════════════════════════════════════════════════════
describe('getUserProgress', () => {
    it('should return default progress when nothing stored', () => {
        const progress = getUserProgress();
        expect(progress).toHaveProperty('favorites');
        expect(progress).toHaveProperty('current_streak');
        expect(progress).toHaveProperty('quiz_history');
        expect(Array.isArray(progress.favorites)).toBe(true);
    });

    it('should clear corrupted progress and return a fresh default state', () => {
        localStorageMock.setItem('globalfinterm_user_progress:guest', JSON.stringify({
            favorites: 'not-an-array',
        }));

        const progress = getUserProgress();

        expect(progress).toMatchObject({
            favorites: [],
            current_language: 'ru',
            quiz_history: [],
        });
        expect(localStorageMock.getItem('globalfinterm_user_progress:guest')).not.toBeNull();
    });

    it('should isolate authenticated progress from guest cache', () => {
        localStorageMock.setItem('globalfinterm_user_progress:guest', JSON.stringify(createProgress({
            user_id: 'guest_user',
            current_streak: 5,
            favorites: ['term_001'],
        })));

        const progress = getUserProgress('user_42');

        expect(progress).toMatchObject({
            user_id: 'user_42',
            current_streak: 0,
            favorites: [],
        });
    });

    it('should migrate matching legacy authenticated progress into the scoped key', () => {
        localStorageMock.setItem('globalfinterm_user_progress', JSON.stringify(createProgress({
            user_id: 'user_99',
            current_streak: 7,
        })));

        const progress = getUserProgress('user_99');

        expect(progress.current_streak).toBe(7);
        expect(localStorageMock.getItem('globalfinterm_user_progress')).toBeNull();
        expect(localStorageMock.getItem('globalfinterm_user_progress:auth:user_99')).not.toBeNull();
    });

    it('should keep only the shared recent quiz history window', () => {
        const history = Array.from({ length: RECENT_QUIZ_HISTORY_LIMIT + 5 }, (_value, index) => ({
            id: `attempt-${index + 1}`,
            term_id: `term-${index + 1}`,
            is_correct: index % 2 === 0,
            response_time_ms: 1000 + index,
            timestamp: new Date(Date.UTC(2026, 2, 1, 0, index, 0)).toISOString(),
            quiz_type: 'daily' as const,
        }));

        saveUserProgress(createProgress({
            quiz_history: history,
        }), 'user_77');

        const progress = getUserProgress('user_77');

        expect(progress.quiz_history).toHaveLength(RECENT_QUIZ_HISTORY_LIMIT);
        expect(progress.quiz_history[0]?.id).toBe('attempt-6');
        expect(progress.quiz_history.at(-1)?.id).toBe(`attempt-${RECENT_QUIZ_HISTORY_LIMIT + 5}`);
    });
});

// ══════════════════════════════════════════════════════════
// toggleFavorite
// ══════════════════════════════════════════════════════════
describe('toggleFavorite', () => {
    beforeEach(() => {
        // Ensure clean user progress state before each toggle test
        saveUserProgress(createProgress());
    });

    it('should add term to favorites when not yet favorited', () => {
        const progress = toggleFavorite('term_001');
        expect(progress.favorites).toContain('term_001');
    });

    it('should remove term from favorites when already favorited', () => {
        const added = toggleFavorite('term_001'); // Add
        expect(added.favorites).toContain('term_001');
        const removed = toggleFavorite('term_001'); // Remove
        expect(removed.favorites).not.toContain('term_001');
    });

    it('should handle toggling multiple terms', () => {
        toggleFavorite('term_001');
        const progress = toggleFavorite('term_002');
        expect(progress.favorites).toContain('term_001');
        expect(progress.favorites).toContain('term_002');
    });
});

// ══════════════════════════════════════════════════════════
// addQuizAttempt
// ══════════════════════════════════════════════════════════
describe('addQuizAttempt', () => {
    it('should add attempt to quiz history', () => {
        const attempt = {
            id: 'attempt_1',
            term_id: 'term_001',
            is_correct: true,
            response_time_ms: 1500,
            timestamp: new Date().toISOString(),
            quiz_type: 'daily' as const,
        };
        const progress = addQuizAttempt(attempt);
        expect(progress.quiz_history).toContainEqual(attempt);
    });

    it('should update streak on first quiz of the day', () => {
        const attempt = {
            id: 'attempt_1',
            term_id: 'term_001',
            is_correct: true,
            response_time_ms: 1000,
            timestamp: new Date().toISOString(),
            quiz_type: 'daily' as const,
        };
        const progress = addQuizAttempt(attempt);
        expect(progress.current_streak).toBeGreaterThanOrEqual(1);
    });

    it('should set last_study_date', () => {
        const attempt = {
            id: 'attempt_1',
            term_id: 'term_001',
            is_correct: false,
            response_time_ms: 2000,
            timestamp: new Date().toISOString(),
            quiz_type: 'practice' as const,
        };
        const progress = addQuizAttempt(attempt);
        expect(progress.last_study_date).not.toBeNull();
    });

    it('should keep only the shared recent quiz history window in local progress', () => {
        const seedHistory = Array.from({ length: RECENT_QUIZ_HISTORY_LIMIT }, (_, index) => ({
            id: `attempt_${index}`,
            term_id: `term_${index}`,
            is_correct: true,
            response_time_ms: 1000,
            timestamp: new Date().toISOString(),
            quiz_type: 'daily' as const,
        }));

        saveUserProgress(createProgress({
            user_id: 'user_99',
            quiz_history: seedHistory,
        }), 'user_99');

        const progress = addQuizAttempt({
            id: 'attempt_latest',
            term_id: 'term_latest',
            is_correct: true,
            response_time_ms: 900,
            timestamp: new Date().toISOString(),
            quiz_type: 'daily' as const,
        }, 'user_99');

        expect(progress.quiz_history).toHaveLength(RECENT_QUIZ_HISTORY_LIMIT);
        expect(progress.quiz_history[0]?.id).toBe('attempt_1');
        expect(progress.quiz_history[RECENT_QUIZ_HISTORY_LIMIT - 1]?.id).toBe('attempt_latest');
    });
});

describe('guest quiz preview', () => {
    it('should start with an empty session preview', () => {
        expect(getGuestQuizPreview()).toEqual({
            attemptCount: 0,
            correctCount: 0,
            avgResponseTimeMs: null,
        });
    });

    it('should accumulate session-only quick quiz stats', () => {
        const firstPreview = recordGuestQuizPreviewAttempt(true, 1200);
        const secondPreview = recordGuestQuizPreviewAttempt(false, 800);

        expect(firstPreview).toEqual({
            attemptCount: 1,
            correctCount: 1,
            avgResponseTimeMs: 1200,
        });
        expect(secondPreview).toEqual({
            attemptCount: 2,
            correctCount: 1,
            avgResponseTimeMs: 1000,
        });
        expect(getGuestQuizPreview()).toEqual(secondPreview);
    });
});

describe('mistake review queue', () => {
    it('stores the most recent mistake first and keeps entries unique', () => {
        expect(recordMistakeReviewMiss('term_001', 'user_1')).toEqual(['term_001']);
        expect(recordMistakeReviewMiss('term_002', 'user_1')).toEqual(['term_002', 'term_001']);
        expect(recordMistakeReviewMiss('term_001', 'user_1')).toEqual(['term_001', 'term_002']);
        expect(getMistakeReviewQueue('user_1')).toEqual(['term_001', 'term_002']);
    });

    it('removes a reviewed mistake from the queue', () => {
        recordMistakeReviewMiss('term_001', 'user_1');
        recordMistakeReviewMiss('term_002', 'user_1');

        expect(removeMistakeReviewTerm('term_002', 'user_1')).toEqual(['term_001']);
        expect(getMistakeReviewQueue('user_1')).toEqual(['term_001']);
    });
});

// ══════════════════════════════════════════════════════════
// Language preference
// ══════════════════════════════════════════════════════════
describe('Language preference', () => {
    it('should default to the configured repository language', () => {
        expect(getCurrentLanguage()).toBe(DEFAULT_LANGUAGE);
    });

    it('should save and retrieve language from localStorage and cookie', () => {
        setCurrentLanguage('tr');
        expect(document.cookie).toContain(`${LANGUAGE_COOKIE_NAME}=tr`);
        expect(getCurrentLanguage()).toBe('tr');
    });

    it('should read language from the cookie when localStorage is empty', () => {
        document.cookie = `${LANGUAGE_COOKIE_NAME}=en; Path=/; SameSite=Lax`;
        expect(getCurrentLanguage()).toBe('en');
    });
});

// ══════════════════════════════════════════════════════════
// resetAllData
// ══════════════════════════════════════════════════════════
describe('resetAllData', () => {
    it('should clear all storage keys', () => {
        getTerms(); // Initialize
        saveTerms(getTerms(), 'user_7');
        getUserProgress();
        saveUserProgress(createProgress({ user_id: 'user_7', current_streak: 3 }), 'user_7');
        recordGuestQuizPreviewAttempt(true, 900);
        recordMistakeReviewMiss('term_001', 'user_7');
        setCurrentLanguage('tr');

        resetAllData();

        expect(localStorageMock.removeItem).toHaveBeenCalledWith('globalfinterm_user_progress');
        expect(localStorageMock.removeItem).toHaveBeenCalledWith('globalfinterm_language');
        expect(localStorageMock.getItem('globalfinterm_terms')).toBeNull();
        expect(localStorageMock.getItem('globalfinterm_data_version')).toBeNull();
        expect(localStorageMock.getItem('globalfinterm_terms:guest')).toBeNull();
        expect(localStorageMock.getItem('globalfinterm_data_version:guest')).toBeNull();
        expect(localStorageMock.getItem('globalfinterm_terms:auth:user_7')).toBeNull();
        expect(localStorageMock.getItem('globalfinterm_data_version:auth:user_7')).toBeNull();
        expect(localStorageMock.getItem('globalfinterm_user_progress:guest')).toBeNull();
        expect(localStorageMock.getItem('globalfinterm_user_progress:auth:user_7')).toBeNull();
        expect(localStorageMock.getItem('globalfinterm_mistake_review_queue:auth:user_7')).toBeNull();
        expect(sessionStorage.getItem('globalfinterm_guest_quiz_preview')).toBeNull();
        expect(document.cookie).not.toContain(`${LANGUAGE_COOKIE_NAME}=tr`);
    });
});
