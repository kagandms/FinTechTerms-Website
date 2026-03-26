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
    TERMS_LEGACY: 'globalfinterm_terms',
    TERMS_PREFIX: 'globalfinterm_terms',
    TERMS_VERSION_LEGACY: 'globalfinterm_data_version',
    TERMS_VERSION_PREFIX: 'globalfinterm_data_version',
    USER_PROGRESS_LEGACY: 'globalfinterm_user_progress',
    USER_PROGRESS_PREFIX: 'globalfinterm_user_progress',
    LANGUAGE: 'globalfinterm_language',
} as const;

const GUEST_PROGRESS_SCOPE = 'guest';
const GUEST_PROGRESS_USER_IDS = new Set(['guest', 'guest_user']);
const MAX_LOCAL_QUIZ_HISTORY = 500;
const MIN_LOCAL_QUIZ_HISTORY_ON_QUOTA_RETRY = 100;

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

const DATA_VERSION = '2026-03-25-v5'; // Force refresh after the catalog was reduced to the 5-term test set

const TERM_STATE_FIELDS = [
    'srs_level',
    'next_review_date',
    'last_reviewed',
    'difficulty_score',
    'retention_rate',
    'times_reviewed',
    'times_correct',
] as const;

const isGuestProgressUserId = (userId: string | null | undefined): boolean => (
    !userId || GUEST_PROGRESS_USER_IDS.has(userId)
);

const resolveProgressScopeUserId = (userId: string | null | undefined): string | null => (
    isGuestProgressUserId(userId) ? null : (userId ?? null)
);

const getProgressStorageKey = (userId: string | null | undefined): string => {
    const scopeUserId = resolveProgressScopeUserId(userId);

    if (!scopeUserId) {
        return `${STORAGE_KEYS.USER_PROGRESS_PREFIX}:${GUEST_PROGRESS_SCOPE}`;
    }

    return `${STORAGE_KEYS.USER_PROGRESS_PREFIX}:auth:${scopeUserId}`;
};

const getTermsStorageKey = (userId: string | null | undefined): string => {
    const scopeUserId = resolveProgressScopeUserId(userId);

    if (!scopeUserId) {
        return `${STORAGE_KEYS.TERMS_PREFIX}:${GUEST_PROGRESS_SCOPE}`;
    }

    return `${STORAGE_KEYS.TERMS_PREFIX}:auth:${scopeUserId}`;
};

const getTermsVersionStorageKey = (userId: string | null | undefined): string => {
    const scopeUserId = resolveProgressScopeUserId(userId);

    if (!scopeUserId) {
        return `${STORAGE_KEYS.TERMS_VERSION_PREFIX}:${GUEST_PROGRESS_SCOPE}`;
    }

    return `${STORAGE_KEYS.TERMS_VERSION_PREFIX}:auth:${scopeUserId}`;
};

const createDefaultProgress = (userId?: string | null): UserProgress => {
    const now = new Date().toISOString();
    const scopeUserId = resolveProgressScopeUserId(userId);

    return {
        ...defaultUserProgress,
        user_id: scopeUserId ?? defaultUserProgress.user_id,
        favorites: [...defaultUserProgress.favorites],
        quiz_history: [...defaultUserProgress.quiz_history],
        created_at: now,
        updated_at: now,
    };
};

const clampQuizHistory = (history: readonly QuizAttempt[]): QuizAttempt[] => (
    history.slice(-MAX_LOCAL_QUIZ_HISTORY)
);

const isQuotaExceededError = (error: unknown): boolean => (
    error instanceof DOMException
    && (
        error.name === 'QuotaExceededError'
        || error.name === 'NS_ERROR_DOM_QUOTA_REACHED'
    )
);

const clearCorruptedProgress = (userId?: string | null): UserProgress => {
    logger.warn('STORAGE_CORRUPTED_PROGRESS_CLEARED', {
        route: 'storage',
    });

    const progressKey = getProgressStorageKey(userId);

    try {
        localStorage.removeItem(progressKey);
        localStorage.removeItem(STORAGE_KEYS.USER_PROGRESS_LEGACY);
    } catch {
        // localStorage is unavailable or already cleared.
    }

    return createDefaultProgress(userId);
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

const clearLegacyTermsCache = (): void => {
    localStorage.removeItem(STORAGE_KEYS.TERMS_LEGACY);
    localStorage.removeItem(STORAGE_KEYS.TERMS_VERSION_LEGACY);
};

const migrateLegacyUserProgress = (userId?: string | null): void => {
    const legacyProgress = localStorage.getItem(STORAGE_KEYS.USER_PROGRESS_LEGACY);
    if (!legacyProgress) {
        return;
    }

    const scopeUserId = resolveProgressScopeUserId(userId);

    try {
        const parsedProgress = JSON.parse(legacyProgress) as unknown;
        const result = userProgressSchema.safeParse(parsedProgress);

        if (!result.success) {
            localStorage.removeItem(STORAGE_KEYS.USER_PROGRESS_LEGACY);
            return;
        }

        const legacyUserId = resolveProgressScopeUserId(result.data.user_id);
        const guestProgressKey = getProgressStorageKey(null);
        const authProgressKey = legacyUserId ? getProgressStorageKey(legacyUserId) : null;

        if (!legacyUserId) {
            if (!localStorage.getItem(guestProgressKey)) {
                localStorage.setItem(guestProgressKey, JSON.stringify({
                    ...result.data,
                    user_id: defaultUserProgress.user_id,
                }));
            }
            localStorage.removeItem(STORAGE_KEYS.USER_PROGRESS_LEGACY);
            return;
        }

        if (scopeUserId && scopeUserId === legacyUserId && authProgressKey && !localStorage.getItem(authProgressKey)) {
            localStorage.setItem(authProgressKey, JSON.stringify(result.data));
        }

        localStorage.removeItem(STORAGE_KEYS.USER_PROGRESS_LEGACY);
    } catch {
        localStorage.removeItem(STORAGE_KEYS.USER_PROGRESS_LEGACY);
    }
};

/**
 * Get all terms from storage (or initialize with mock data)
 * Refresh cached data only when the schema version changes
 */
export function getTerms(userId?: string | null): Term[] {
    const fallbackTerms = filterAcademicTerms(mockTerms);

    if (!isLocalStorageAvailable()) return fallbackTerms;

    try {
        const termsStorageKey = getTermsStorageKey(userId);
        const versionStorageKey = getTermsVersionStorageKey(userId);
        const isGuestScope = resolveProgressScopeUserId(userId) === null;
        let storedVersion = localStorage.getItem(versionStorageKey);
        let stored = localStorage.getItem(termsStorageKey);

        if (!stored && isGuestScope) {
            stored = localStorage.getItem(STORAGE_KEYS.TERMS_LEGACY);
            storedVersion = storedVersion ?? localStorage.getItem(STORAGE_KEYS.TERMS_VERSION_LEGACY);
        }

        const parsedTerms = parseStoredTerms(stored);

        // Refresh content schema while preserving compatible local SRS state.
        if (storedVersion !== DATA_VERSION) {
            const migratedTerms = mergeTermStudyState(fallbackTerms, parsedTerms);
            localStorage.setItem(termsStorageKey, JSON.stringify(migratedTerms));
            localStorage.setItem(versionStorageKey, DATA_VERSION);
            if (isGuestScope) {
                clearLegacyTermsCache();
            }
            return migratedTerms;
        }

        if (parsedTerms.length > 0) {
            localStorage.setItem(termsStorageKey, JSON.stringify(parsedTerms));
            localStorage.setItem(versionStorageKey, storedVersion ?? DATA_VERSION);
            if (isGuestScope) {
                clearLegacyTermsCache();
            }
            return filterAcademicTerms(parsedTerms);
        }

        // Initialize with mock data
        localStorage.setItem(termsStorageKey, JSON.stringify(fallbackTerms));
        localStorage.setItem(versionStorageKey, DATA_VERSION);
        if (isGuestScope) {
            clearLegacyTermsCache();
        }
        return fallbackTerms;
    } catch {
        return fallbackTerms;
    }
}

/**
 * Save terms to storage
 */
export function saveTerms(terms: Term[], userId?: string | null): void {
    if (!isLocalStorageAvailable()) return;

    try {
        localStorage.setItem(
            getTermsStorageKey(userId),
            JSON.stringify(filterAcademicTerms(terms))
        );
        localStorage.setItem(getTermsVersionStorageKey(userId), DATA_VERSION);
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
export function updateTerm(updatedTerm: Term, userId?: string | null): Term[] {
    const terms = getTerms(userId);
    const index = terms.findIndex(t => t.id === updatedTerm.id);

    if (index !== -1) {
        terms[index] = updatedTerm;
        saveTerms(terms, userId);
    }

    return terms;
}

/**
 * Get user progress from storage
 */
export function getUserProgress(userId?: string | null): UserProgress {
    if (!isLocalStorageAvailable()) return createDefaultProgress(userId);

    try {
        migrateLegacyUserProgress(userId);

        const progressKey = getProgressStorageKey(userId);
        const stored = localStorage.getItem(progressKey);
        if (stored) {
            const parsed = JSON.parse(stored) as unknown;
            const result = userProgressSchema.safeParse(parsed);

            if (result.success) {
                return result.data;
            }

            return clearCorruptedProgress(userId);
        }
        const newProgress = createDefaultProgress(userId);
        localStorage.setItem(progressKey, JSON.stringify(newProgress));
        return newProgress;
    } catch {
        return clearCorruptedProgress(userId);
    }
}

/**
 * Save user progress to storage
 */
export function saveUserProgress(progress: UserProgress, userId?: string | null): void {
    if (!isLocalStorageAvailable()) return;

    try {
        const scopeUserId = resolveProgressScopeUserId(userId ?? progress.user_id);
        let updated = {
            ...progress,
            quiz_history: clampQuizHistory(progress.quiz_history),
            user_id: scopeUserId ?? defaultUserProgress.user_id,
            updated_at: new Date().toISOString(),
        };
        const progressKey = getProgressStorageKey(scopeUserId);

        while (true) {
            try {
                localStorage.setItem(
                    progressKey,
                    JSON.stringify(updated)
                );
                break;
            } catch (error) {
                if (!isQuotaExceededError(error) || updated.quiz_history.length <= MIN_LOCAL_QUIZ_HISTORY_ON_QUOTA_RETRY) {
                    throw error;
                }

                const nextHistorySize = Math.max(
                    MIN_LOCAL_QUIZ_HISTORY_ON_QUOTA_RETRY,
                    Math.floor(updated.quiz_history.length / 2)
                );
                updated = {
                    ...updated,
                    quiz_history: updated.quiz_history.slice(-nextHistorySize),
                };
                logger.warn('STORAGE_PROGRESS_PRUNED_FOR_QUOTA', {
                    route: 'storage',
                    retainedQuizHistory: updated.quiz_history.length,
                });
            }
        }

        localStorage.removeItem(STORAGE_KEYS.USER_PROGRESS_LEGACY);
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
export function toggleFavorite(termId: string, userId?: string | null): UserProgress {
    const progress = getUserProgress(userId);
    const newFavorites = [...progress.favorites];
    const index = newFavorites.indexOf(termId);

    if (index === -1) {
        newFavorites.push(termId);
    } else {
        newFavorites.splice(index, 1);
    }

    const updated = { ...progress, favorites: newFavorites };
    saveUserProgress(updated, userId);
    return updated;
}

/**
 * Add a quiz attempt to history
 */
export function addQuizAttempt(attempt: QuizAttempt, userId?: string | null): UserProgress {
    const progress = getUserProgress(userId);
    const nextQuizHistory = clampQuizHistory([
        ...progress.quiz_history,
        attempt,
    ]);
    const updatedProgress: UserProgress = {
        ...progress,
        quiz_history: nextQuizHistory,
    };

    // Update streak
    const today = startOfUtcDay(new Date()).getTime();
    const lastStudy = updatedProgress.last_study_date
        ? startOfUtcDay(updatedProgress.last_study_date).getTime()
        : null;

    if (lastStudy !== today) {
        const yesterday = startOfUtcDay(new Date(Date.now() - (24 * 60 * 60 * 1000))).getTime();

        if (lastStudy === yesterday) {
            updatedProgress.current_streak += 1;
        } else {
            updatedProgress.current_streak = 1;
        }
        updatedProgress.last_study_date = endOfUtcDay(new Date()).toISOString();
    }

    // Update words learned count
    if (attempt.is_correct) {
        const term = getTerms(userId).find(t => t.id === attempt.term_id);
        if (term && term.srs_level >= 4) {
            updatedProgress.total_words_learned = Math.max(
                updatedProgress.total_words_learned,
                updatedProgress.favorites.filter(id => {
                    const t = getTerms(userId).find(tm => tm.id === id);
                    return t && t.srs_level >= 4;
                }).length
            );
        }
    }

    saveUserProgress(updatedProgress, userId);
    return updatedProgress;
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
        clearLegacyTermsCache();
        localStorage.removeItem(STORAGE_KEYS.USER_PROGRESS_LEGACY);
        localStorage.removeItem(STORAGE_KEYS.LANGUAGE);
        const progressKeys: string[] = [];
        const termKeys: string[] = [];
        for (let index = 0; index < localStorage.length; index += 1) {
            const key = localStorage.key(index);
            if (key?.startsWith(`${STORAGE_KEYS.USER_PROGRESS_PREFIX}:`)) {
                progressKeys.push(key);
            }
            if (
                key?.startsWith(`${STORAGE_KEYS.TERMS_PREFIX}:`)
                || key?.startsWith(`${STORAGE_KEYS.TERMS_VERSION_PREFIX}:`)
            ) {
                termKeys.push(key);
            }
        }
        progressKeys.forEach((key) => {
            localStorage.removeItem(key);
        });
        termKeys.forEach((key) => {
            localStorage.removeItem(key);
        });
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

/**
 * Remove the scoped progress cache for a specific user (or guest scope).
 */
export function clearStoredUserProgress(userId?: string | null): void {
    if (!isLocalStorageAvailable()) return;

    try {
        localStorage.removeItem(getProgressStorageKey(userId));
    } catch (error) {
        logger.error('STORAGE_CLEAR_PROGRESS_FAILED', {
            route: 'storage',
            error: error instanceof Error ? error : undefined,
        });
    }
}

/**
 * Remove the deprecated global progress cache key after migration.
 */
export function clearLegacyUserProgress(): void {
    if (!isLocalStorageAvailable()) return;

    try {
        localStorage.removeItem(STORAGE_KEYS.USER_PROGRESS_LEGACY);
    } catch (error) {
        logger.error('STORAGE_CLEAR_LEGACY_PROGRESS_FAILED', {
            route: 'storage',
            error: error instanceof Error ? error : undefined,
        });
    }
}
