// ============================================
// GlobalFinTerm - LocalStorage Utilities
// Persistent state management
// ============================================

import { Term, UserProgress, QuizAttempt } from '@/types';
import { DEFAULT_LANGUAGE, LANGUAGE_COOKIE_NAME, normalizeLanguage } from '@/lib/language';
import { mockTerms, defaultUserProgress } from '@/data/mockData';
import { filterAcademicTerms } from '@/lib/academicQuarantine';
import { userProgressSchema } from '@/lib/userProgress';
import { createSafeTerm } from '@/utils/termUtils';
import { endOfUtcDay, startOfUtcDay } from '@/lib/time';
import { logger } from '@/lib/logger';

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

const TERM_STATE_FIELDS = [
    'srs_level',
    'next_review_date',
    'last_reviewed',
    'difficulty_score',
    'retention_rate',
    'times_reviewed',
    'times_correct',
] as const;

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
    logger.warn('STORAGE_CORRUPTED_PROGRESS_CLEARED', {
        route: 'storage',
    });

    try {
        localStorage.removeItem(STORAGE_KEYS.USER_PROGRESS);
    } catch {
        // localStorage is unavailable or already cleared.
    }

    return createDefaultProgress();
};

const parseStoredTerms = (stored: string | null): Term[] => {
    if (!stored) {
        return [];
    }

    return (JSON.parse(stored) as Array<Partial<Term>>)
        .map((term) => createSafeTerm(term))
        .filter((term): term is Term => Boolean(term));
};

const mergeTermStudyState = (fallbackTerms: Term[], storedTerms: Term[]): Term[] => {
    const storedTermsById = new Map(storedTerms.map((term) => [term.id, term] as const));

    return fallbackTerms.map((fallbackTerm) => {
        const storedTerm = storedTermsById.get(fallbackTerm.id);
        if (!storedTerm) {
            return fallbackTerm;
        }

        const preservedState = TERM_STATE_FIELDS.reduce<Pick<Term, typeof TERM_STATE_FIELDS[number]>>(
            (result, field) => ({
                ...result,
                [field]: storedTerm[field],
            }),
            {
                srs_level: fallbackTerm.srs_level,
                next_review_date: fallbackTerm.next_review_date,
                last_reviewed: fallbackTerm.last_reviewed,
                difficulty_score: fallbackTerm.difficulty_score,
                retention_rate: fallbackTerm.retention_rate,
                times_reviewed: fallbackTerm.times_reviewed,
                times_correct: fallbackTerm.times_correct,
            }
        );

        return {
            ...fallbackTerm,
            ...preservedState,
        };
    });
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
        const parsedTerms = parseStoredTerms(stored);

        // Refresh content schema while preserving compatible local SRS state.
        if (storedVersion !== DATA_VERSION) {
            const migratedTerms = mergeTermStudyState(fallbackTerms, parsedTerms);
            localStorage.setItem(STORAGE_KEYS.TERMS, JSON.stringify(migratedTerms));
            localStorage.setItem('globalfinterm_data_version', DATA_VERSION);
            return migratedTerms;
        }

        if (parsedTerms.length > 0) {
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
        logger.error('STORAGE_SAVE_TERMS_FAILED', {
            route: 'storage',
            error: error instanceof Error ? error : undefined,
        });
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
        logger.error('STORAGE_SAVE_PROGRESS_FAILED', {
            route: 'storage',
            error: error instanceof Error ? error : undefined,
        });
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
    const today = startOfUtcDay(new Date()).getTime();
    const lastStudy = progress.last_study_date
        ? startOfUtcDay(progress.last_study_date).getTime()
        : null;

    if (lastStudy !== today) {
        const yesterday = startOfUtcDay(new Date(Date.now() - (24 * 60 * 60 * 1000))).getTime();

        if (lastStudy === yesterday) {
            progress.current_streak += 1;
        } else {
            progress.current_streak = 1;
        }
        progress.last_study_date = endOfUtcDay(new Date()).toISOString();
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
    const cookieLanguage = typeof document !== 'undefined'
        ? document.cookie
            .split(';')
            .map(cookie => cookie.trim())
            .find(cookie => cookie.startsWith(`${LANGUAGE_COOKIE_NAME}=`))
        : null;
    const normalizedCookieLanguage = normalizeLanguage(cookieLanguage?.split('=')[1] ?? null);

    if (!isLocalStorageAvailable()) {
        return normalizedCookieLanguage ?? DEFAULT_LANGUAGE;
    }

    try {
        const stored = localStorage.getItem(STORAGE_KEYS.LANGUAGE);
        const normalizedStoredLanguage = normalizeLanguage(stored);
        if (normalizedStoredLanguage) {
            return normalizedStoredLanguage;
        }

        return normalizedCookieLanguage ?? DEFAULT_LANGUAGE;
    } catch {
        return normalizedCookieLanguage ?? DEFAULT_LANGUAGE;
    }
}

/**
 * Set language preference
 */
export function setCurrentLanguage(language: 'tr' | 'en' | 'ru'): void {
    const normalizedLanguage = normalizeLanguage(language) ?? DEFAULT_LANGUAGE;

    if (typeof document !== 'undefined') {
        document.cookie = `${LANGUAGE_COOKIE_NAME}=${normalizedLanguage}; Path=/; Max-Age=31536000; SameSite=Lax`;
    }

    if (!isLocalStorageAvailable()) return;

    try {
        localStorage.setItem(STORAGE_KEYS.LANGUAGE, normalizedLanguage);
    } catch (error) {
        logger.error('STORAGE_SAVE_LANGUAGE_FAILED', {
            route: 'storage',
            error: error instanceof Error ? error : undefined,
        });
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
        if (typeof document !== 'undefined') {
            document.cookie = `${LANGUAGE_COOKIE_NAME}=; Path=/; Max-Age=0; SameSite=Lax`;
        }
    } catch (error) {
        logger.error('STORAGE_RESET_FAILED', {
            route: 'storage',
            error: error instanceof Error ? error : undefined,
        });
    }
}
