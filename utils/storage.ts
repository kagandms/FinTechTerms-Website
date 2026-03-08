// ============================================
// GlobalFinTerm - LocalStorage Utilities
// Persistent state management
// ============================================

import { Term, UserProgress, QuizAttempt } from '@/types';
import { mockTerms, defaultUserProgress } from '@/data/mockData';
import { filterAcademicTerms } from '@/lib/academicQuarantine';
import { userProgressSchema } from '@/lib/userProgress';
import { createSafeTerm } from '@/utils/termUtils';

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

const DATA_VERSION = '2026-03-08-v4'; // Force refresh after academic quarantine fields were added

const createDefaultProgress = (): UserProgress => {
    const now = new Date().toISOString();

    return {
        ...defaultUserProgress,
        favorites: [...defaultUserProgress.favorites],
        quiz_history: [...defaultUserProgress.quiz_history],
        created_at: now,
        updated_at: now,
    };
};

const clearCorruptedProgress = (): UserProgress => {
    console.warn('[storage] Corrupted progress data cleared');

    try {
        localStorage.removeItem(STORAGE_KEYS.USER_PROGRESS);
    } catch {
        // localStorage is unavailable or already cleared.
    }

    return createDefaultProgress();
};

/**
 * Get all terms from storage (or initialize with mock data)
 * Refresh cached data only when the schema version changes
 */
export function getTerms(): Term[] {
    const fallbackTerms = filterAcademicTerms(mockTerms);

    if (!isLocalStorageAvailable()) return fallbackTerms;

    try {
        const storedVersion = localStorage.getItem('globalfinterm_data_version');
        const stored = localStorage.getItem(STORAGE_KEYS.TERMS);

        // Force update if version mismatch
        if (storedVersion !== DATA_VERSION) {
            localStorage.setItem(STORAGE_KEYS.TERMS, JSON.stringify(fallbackTerms));
            localStorage.setItem('globalfinterm_data_version', DATA_VERSION);
            return fallbackTerms;
        }

        if (stored) {
            const parsedTerms = (JSON.parse(stored) as Array<Partial<Term>>).map((term) => createSafeTerm(term));
            return filterAcademicTerms(parsedTerms);
        }

        // Initialize with mock data
        localStorage.setItem(STORAGE_KEYS.TERMS, JSON.stringify(fallbackTerms));
        localStorage.setItem('globalfinterm_data_version', DATA_VERSION);
        return fallbackTerms;
    } catch {
        return fallbackTerms;
    }
}

/**
 * Save terms to storage
 */
export function saveTerms(terms: Term[]): void {
    if (!isLocalStorageAvailable()) return;

    try {
        localStorage.setItem(STORAGE_KEYS.TERMS, JSON.stringify(filterAcademicTerms(terms)));
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
    if (!isLocalStorageAvailable()) return createDefaultProgress();

    try {
        const stored = localStorage.getItem(STORAGE_KEYS.USER_PROGRESS);
        if (stored) {
            const parsed = JSON.parse(stored) as unknown;
            const result = userProgressSchema.safeParse(parsed);

            if (result.success) {
                return result.data;
            }

            return clearCorruptedProgress();
        }
        const newProgress = createDefaultProgress();
        localStorage.setItem(STORAGE_KEYS.USER_PROGRESS, JSON.stringify(newProgress));
        return newProgress;
    } catch {
        return clearCorruptedProgress();
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
    const newFavorites = [...progress.favorites];
    const index = newFavorites.indexOf(termId);

    if (index === -1) {
        newFavorites.push(termId);
    } else {
        newFavorites.splice(index, 1);
    }

    const updated = { ...progress, favorites: newFavorites };
    saveUserProgress(updated);
    return updated;
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
    if (!isLocalStorageAvailable()) return 'ru';

    try {
        const stored = localStorage.getItem(STORAGE_KEYS.LANGUAGE);
        if (stored && ['tr', 'en', 'ru'].includes(stored)) {
            return stored as 'tr' | 'en' | 'ru';
        }
        return 'ru';
    } catch {
        return 'ru';
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
