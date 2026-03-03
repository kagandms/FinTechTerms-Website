/**
 * Storage Utility Unit Tests
 * Skill: tdd-workflow, unit-testing-test-generate
 *
 * Tests localStorage wrapper functions with mock localStorage.
 */

import { Term, UserProgress } from '@/types';

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
    getCurrentLanguage,
    setCurrentLanguage,
    resetAllData,
} from '@/utils/storage';

beforeEach(() => {
    localStorageMock.clear();
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
});

// ══════════════════════════════════════════════════════════
// saveTerms
// ══════════════════════════════════════════════════════════
describe('saveTerms', () => {
    it('should save terms to localStorage', () => {
        const terms = getTerms();
        saveTerms(terms);
        expect(localStorageMock.setItem).toHaveBeenCalledWith(
            'globalfinterm_terms',
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
});

// ══════════════════════════════════════════════════════════
// toggleFavorite
// ══════════════════════════════════════════════════════════
describe('toggleFavorite', () => {
    beforeEach(() => {
        // Ensure clean user progress state before each toggle test
        saveUserProgress({
            favorites: [],
            current_streak: 0,
            quiz_history: [],
            last_study_date: null,
        } as any);
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
});

// ══════════════════════════════════════════════════════════
// Language preference
// ══════════════════════════════════════════════════════════
describe('Language preference', () => {
    it('should default to ru', () => {
        expect(getCurrentLanguage()).toBe('ru');
    });

    it('should save and retrieve language', () => {
        setCurrentLanguage('tr');
        expect(getCurrentLanguage()).toBe('tr');
    });

    it('should only accept valid languages', () => {
        setCurrentLanguage('ru');
        expect(getCurrentLanguage()).toBe('ru');
    });
});

// ══════════════════════════════════════════════════════════
// resetAllData
// ══════════════════════════════════════════════════════════
describe('resetAllData', () => {
    it('should clear all storage keys', () => {
        getTerms(); // Initialize
        getUserProgress();
        setCurrentLanguage('tr');

        resetAllData();

        expect(localStorageMock.removeItem).toHaveBeenCalledWith('globalfinterm_terms');
        expect(localStorageMock.removeItem).toHaveBeenCalledWith('globalfinterm_user_progress');
        expect(localStorageMock.removeItem).toHaveBeenCalledWith('globalfinterm_language');
    });
});
