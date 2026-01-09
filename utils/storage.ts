// ============================================
// GlobalFinTerm - LocalStorage Utilities
// Persistent state management
// ============================================

import { Term, UserProgress, QuizAttempt } from '@/types';
import { mockTerms, defaultUserProgress } from '@/data/mockData';

const STORAGE_KEYS = {
    TERMS: 'globalfinterm_terms',
    USER_PROGRESS: 'globalfinterm_user_progress',
    LANGUAGE: 'globalfinterm_language',
} as const;

/**
 * Check if localStorage is available
 */
function isLocalStorageAvailable(): boolean {
    try {
        const test = '__storage_test__';
        window.localStorage.setItem(test, test);
        window.localStorage.removeItem(test);
        return true;
    } catch {
        return false;
    }
}

/**
 * Get all terms from storage (or initialize with mock data)
 * Always sync with mockTerms if local data is outdated
 */
export function getTerms(): Term[] {
    if (!isLocalStorageAvailable()) return mockTerms;

    try {
        const stored = localStorage.getItem(STORAGE_KEYS.TERMS);
        if (stored) {
            const parsedTerms = JSON.parse(stored) as Term[];
            // If mockTerms has more terms, update localStorage with new data
            if (parsedTerms.length < mockTerms.length) {
                localStorage.setItem(STORAGE_KEYS.TERMS, JSON.stringify(mockTerms));
                return mockTerms;
            }
            return parsedTerms;
        }
        // Initialize with mock data
        localStorage.setItem(STORAGE_KEYS.TERMS, JSON.stringify(mockTerms));
        return mockTerms;
    } catch {
        return mockTerms;
    }
}

/**
 * Save terms to storage
 */
export function saveTerms(terms: Term[]): void {
    if (!isLocalStorageAvailable()) return;

    try {
        localStorage.setItem(STORAGE_KEYS.TERMS, JSON.stringify(terms));
    } catch (error) {
        console.error('Failed to save terms:', error);
    }
}

/**
 * Update a single term
 */
export function updateTerm(updatedTerm: Term): Term[] {
    const terms = getTerms();
    const index = terms.findIndex(t => t.id === updatedTerm.id);

    if (index !== -1) {
        terms[index] = updatedTerm;
        saveTerms(terms);
    }

    return terms;
}

/**
 * Get user progress from storage
 */
export function getUserProgress(): UserProgress {
    if (!isLocalStorageAvailable()) return defaultUserProgress;

    try {
        const stored = localStorage.getItem(STORAGE_KEYS.USER_PROGRESS);
        if (stored) {
            return JSON.parse(stored) as UserProgress;
        }
        localStorage.setItem(STORAGE_KEYS.USER_PROGRESS, JSON.stringify(defaultUserProgress));
        return defaultUserProgress;
    } catch {
        return defaultUserProgress;
    }
}

/**
 * Save user progress to storage
 */
export function saveUserProgress(progress: UserProgress): void {
    if (!isLocalStorageAvailable()) return;

    try {
        const updated = {
            ...progress,
            updated_at: new Date().toISOString(),
        };
        localStorage.setItem(STORAGE_KEYS.USER_PROGRESS, JSON.stringify(updated));
    } catch (error) {
        console.error('Failed to save user progress:', error);
    }
}

/**
 * Toggle a term as favorite
 */
export function toggleFavorite(termId: string): UserProgress {
    const progress = getUserProgress();
    const index = progress.favorites.indexOf(termId);

    if (index === -1) {
        progress.favorites.push(termId);
    } else {
        progress.favorites.splice(index, 1);
    }

    saveUserProgress(progress);
    return progress;
}

/**
 * Add a quiz attempt to history
 */
export function addQuizAttempt(attempt: QuizAttempt): UserProgress {
    const progress = getUserProgress();
    progress.quiz_history.push(attempt);

    // Update streak
    const today = new Date().toDateString();
    const lastStudy = progress.last_study_date
        ? new Date(progress.last_study_date).toDateString()
        : null;

    if (lastStudy !== today) {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);

        if (lastStudy === yesterday.toDateString()) {
            progress.current_streak += 1;
        } else {
            progress.current_streak = 1;
        }
        progress.last_study_date = new Date().toISOString();
    }

    // Update words learned count
    if (attempt.is_correct) {
        const term = getTerms().find(t => t.id === attempt.term_id);
        if (term && term.srs_level >= 4) {
            progress.total_words_learned = Math.max(
                progress.total_words_learned,
                progress.favorites.filter(id => {
                    const t = getTerms().find(tm => tm.id === id);
                    return t && t.srs_level >= 4;
                }).length
            );
        }
    }

    saveUserProgress(progress);
    return progress;
}

/**
 * Get current language preference
 */
export function getCurrentLanguage(): 'tr' | 'en' | 'ru' {
    if (!isLocalStorageAvailable()) return 'tr';

    try {
        const stored = localStorage.getItem(STORAGE_KEYS.LANGUAGE);
        if (stored && ['tr', 'en', 'ru'].includes(stored)) {
            return stored as 'tr' | 'en' | 'ru';
        }
        return 'tr';
    } catch {
        return 'tr';
    }
}

/**
 * Set language preference
 */
export function setCurrentLanguage(language: 'tr' | 'en' | 'ru'): void {
    if (!isLocalStorageAvailable()) return;

    try {
        localStorage.setItem(STORAGE_KEYS.LANGUAGE, language);
    } catch (error) {
        console.error('Failed to save language preference:', error);
    }
}

/**
 * Reset all data to defaults
 */
export function resetAllData(): void {
    if (!isLocalStorageAvailable()) return;

    try {
        localStorage.removeItem(STORAGE_KEYS.TERMS);
        localStorage.removeItem(STORAGE_KEYS.USER_PROGRESS);
        localStorage.removeItem(STORAGE_KEYS.LANGUAGE);
    } catch (error) {
        console.error('Failed to reset data:', error);
    }
}
