// ============================================
// GlobalFinTerm - LocalStorage Utilities
// Persistent state management
// ============================================

import { Term, UserProgress, QuizAttempt } from '@/types';
import { terms as catalogTerms } from '@/data/terms';
import { DEFAULT_LANGUAGE, LANGUAGE_COOKIE_NAME, normalizeLanguage } from '@/lib/language';
import { defaultUserProgress } from '@/data/mockData';
import { filterAcademicTerms } from '@/lib/academicQuarantine';
import { RECENT_QUIZ_HISTORY_LIMIT, userProgressSchema } from '@/lib/userProgress';
import { createSafeTerm } from '@/utils/termUtils';
import { startOfUtcDay, toUtcDateKey } from '@/lib/time';
import { logger } from '@/lib/logger';

const STORAGE_KEYS = {
    TERMS_LEGACY: 'globalfinterm_terms',
    TERMS_PREFIX: 'globalfinterm_terms',
    TERMS_VERSION_LEGACY: 'globalfinterm_data_version',
    TERMS_VERSION_PREFIX: 'globalfinterm_data_version',
    USER_PROGRESS_LEGACY: 'globalfinterm_user_progress',
    USER_PROGRESS_PREFIX: 'globalfinterm_user_progress',
    LANGUAGE: 'globalfinterm_language',
    GUEST_ENTITLEMENT_POLICY: 'globalfinterm_guest_entitlement_policy',
    GUEST_QUIZ_PREVIEW: 'globalfinterm_guest_quiz_preview',
    MISTAKE_REVIEW_QUEUE_PREFIX: 'globalfinterm_mistake_review_queue',
} as const;

const GUEST_PROGRESS_SCOPE = 'guest';
const GUEST_PROGRESS_USER_IDS = new Set(['guest', 'guest_user']);
const MAX_LOCAL_QUIZ_HISTORY = RECENT_QUIZ_HISTORY_LIMIT;
const MIN_LOCAL_QUIZ_HISTORY_ON_QUOTA_RETRY = 25;
const GUEST_ENTITLEMENT_POLICY_VERSION = '2026-03-28-v1';
const MAX_MISTAKE_REVIEW_TERMS = 20;

export interface GuestQuizPreview {
    attemptCount: number;
    correctCount: number;
    avgResponseTimeMs: number | null;
}

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

function isSessionStorageAvailable(): boolean {
    try {
        const test = '__session_storage_test__';
        window.sessionStorage.setItem(test, test);
        window.sessionStorage.removeItem(test);
        return true;
    } catch {
        return false;
    }
}

const DATA_VERSION = '2026-04-09-v6'; // Force refresh after restoring the full runtime catalog

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

const getMistakeReviewQueueStorageKey = (userId: string | null | undefined): string => {
    const scopeUserId = resolveProgressScopeUserId(userId);

    if (!scopeUserId) {
        return `${STORAGE_KEYS.MISTAKE_REVIEW_QUEUE_PREFIX}:${GUEST_PROGRESS_SCOPE}`;
    }

    return `${STORAGE_KEYS.MISTAKE_REVIEW_QUEUE_PREFIX}:auth:${scopeUserId}`;
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

const createDefaultGuestQuizPreview = (): GuestQuizPreview => ({
    attemptCount: 0,
    correctCount: 0,
    avgResponseTimeMs: null,
});

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

const hasCatalogDrift = (fallbackTerms: readonly Term[], storedTerms: readonly Term[]): boolean => {
    if (storedTerms.length !== fallbackTerms.length) {
        return true;
    }

    const fallbackTermIds = new Set(fallbackTerms.map((term) => term.id));
    return storedTerms.some((term) => !fallbackTermIds.has(term.id));
};

const persistReconciledTerms = (
    fallbackTerms: Term[],
    storedTerms: Term[],
    termsStorageKey: string,
    versionStorageKey: string,
    isGuestScope: boolean
): Term[] => {
    const reconciledTerms = mergeTermStudyState(fallbackTerms, storedTerms);
    localStorage.setItem(termsStorageKey, JSON.stringify(reconciledTerms));
    localStorage.setItem(versionStorageKey, DATA_VERSION);

    if (isGuestScope) {
        clearLegacyTermsCache();
    }

    return reconciledTerms;
};

const applyGuestEntitlementPolicyMigration = (fallbackTerms: Term[]): void => {
    if (!isLocalStorageAvailable()) {
        return;
    }

    const currentPolicyVersion = localStorage.getItem(STORAGE_KEYS.GUEST_ENTITLEMENT_POLICY);
    if (currentPolicyVersion === GUEST_ENTITLEMENT_POLICY_VERSION) {
        return;
    }

    const guestProgressKey = getProgressStorageKey(null);
    const storedProgress = localStorage.getItem(guestProgressKey);
    const parsedProgress = storedProgress ? userProgressSchema.safeParse(JSON.parse(storedProgress)) : null;
    const guestProgress = parsedProgress?.success
        ? parsedProgress.data
        : createDefaultProgress(null);
    const migratedGuestProgress: UserProgress = {
        ...guestProgress,
        quiz_history: [],
        total_words_learned: 0,
        current_streak: 0,
        last_study_date: null,
        updated_at: new Date().toISOString(),
    };

    localStorage.setItem(getTermsStorageKey(null), JSON.stringify(fallbackTerms));
    localStorage.setItem(getTermsVersionStorageKey(null), DATA_VERSION);
    localStorage.setItem(guestProgressKey, JSON.stringify(migratedGuestProgress));
    localStorage.removeItem(STORAGE_KEYS.USER_PROGRESS_LEGACY);
    clearLegacyTermsCache();
    localStorage.setItem(STORAGE_KEYS.GUEST_ENTITLEMENT_POLICY, GUEST_ENTITLEMENT_POLICY_VERSION);
}

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
    const fallbackTerms = filterAcademicTerms(catalogTerms);

    if (!isLocalStorageAvailable()) return fallbackTerms;

    try {
        if (resolveProgressScopeUserId(userId) === null) {
            applyGuestEntitlementPolicyMigration(fallbackTerms);
        }

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
            return persistReconciledTerms(
                fallbackTerms,
                parsedTerms,
                termsStorageKey,
                versionStorageKey,
                isGuestScope
            );
        }

        if (parsedTerms.length > 0) {
            if (hasCatalogDrift(fallbackTerms, parsedTerms)) {
                return persistReconciledTerms(
                    fallbackTerms,
                    parsedTerms,
                    termsStorageKey,
                    versionStorageKey,
                    isGuestScope
                );
            }

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
        if (resolveProgressScopeUserId(userId) === null) {
            applyGuestEntitlementPolicyMigration(filterAcademicTerms(catalogTerms));
        }

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
        updatedProgress.last_study_date = toUtcDateKey(new Date());
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
        const mistakeQueueKeys: string[] = [];
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
            if (key?.startsWith(`${STORAGE_KEYS.MISTAKE_REVIEW_QUEUE_PREFIX}:`)) {
                mistakeQueueKeys.push(key);
            }
        }
        progressKeys.forEach((key) => {
            localStorage.removeItem(key);
        });
        termKeys.forEach((key) => {
            localStorage.removeItem(key);
        });
        mistakeQueueKeys.forEach((key) => {
            localStorage.removeItem(key);
        });
        if (typeof document !== 'undefined') {
            document.cookie = `${LANGUAGE_COOKIE_NAME}=; Path=/; Max-Age=0; SameSite=Lax`;
        }
        if (isSessionStorageAvailable()) {
            sessionStorage.removeItem(STORAGE_KEYS.GUEST_QUIZ_PREVIEW);
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
        localStorage.removeItem(getMistakeReviewQueueStorageKey(userId));
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

export function getGuestQuizPreview(): GuestQuizPreview {
    if (!isSessionStorageAvailable()) {
        return createDefaultGuestQuizPreview();
    }

    try {
        const stored = sessionStorage.getItem(STORAGE_KEYS.GUEST_QUIZ_PREVIEW);
        if (!stored) {
            return createDefaultGuestQuizPreview();
        }

        const parsed = JSON.parse(stored) as Partial<GuestQuizPreview>;
        return {
            attemptCount: typeof parsed.attemptCount === 'number' ? parsed.attemptCount : 0,
            correctCount: typeof parsed.correctCount === 'number' ? parsed.correctCount : 0,
            avgResponseTimeMs: typeof parsed.avgResponseTimeMs === 'number'
                ? parsed.avgResponseTimeMs
                : null,
        };
    } catch {
        return createDefaultGuestQuizPreview();
    }
}

export function recordGuestQuizPreviewAttempt(
    isCorrect: boolean,
    responseTimeMs: number
): GuestQuizPreview {
    const currentPreview = getGuestQuizPreview();
    const nextAttemptCount = currentPreview.attemptCount + 1;
    const nextCorrectCount = currentPreview.correctCount + (isCorrect ? 1 : 0);
    const normalizedResponseTimeMs = Math.max(0, Math.round(responseTimeMs));
    const nextAvgResponseTimeMs = currentPreview.avgResponseTimeMs === null
        ? normalizedResponseTimeMs
        : Math.round(
            ((currentPreview.avgResponseTimeMs * currentPreview.attemptCount) + normalizedResponseTimeMs)
            / nextAttemptCount
        );
    const nextPreview: GuestQuizPreview = {
        attemptCount: nextAttemptCount,
        correctCount: nextCorrectCount,
        avgResponseTimeMs: nextAvgResponseTimeMs,
    };

    if (!isSessionStorageAvailable()) {
        return nextPreview;
    }

    try {
        sessionStorage.setItem(STORAGE_KEYS.GUEST_QUIZ_PREVIEW, JSON.stringify(nextPreview));
    } catch (error) {
        logger.error('STORAGE_SAVE_GUEST_QUIZ_PREVIEW_FAILED', {
            route: 'storage',
            error: error instanceof Error ? error : undefined,
        });
    }

    return nextPreview;
}

export function clearGuestQuizPreview(): void {
    if (!isSessionStorageAvailable()) {
        return;
    }

    try {
        sessionStorage.removeItem(STORAGE_KEYS.GUEST_QUIZ_PREVIEW);
    } catch (error) {
        logger.error('STORAGE_CLEAR_GUEST_QUIZ_PREVIEW_FAILED', {
            route: 'storage',
            error: error instanceof Error ? error : undefined,
        });
    }
}

export function getMistakeReviewQueue(userId?: string | null): string[] {
    if (!isLocalStorageAvailable()) {
        return [];
    }

    try {
        const stored = localStorage.getItem(getMistakeReviewQueueStorageKey(userId));
        if (!stored) {
            return [];
        }

        const parsed = JSON.parse(stored) as unknown;
        if (!Array.isArray(parsed)) {
            localStorage.removeItem(getMistakeReviewQueueStorageKey(userId));
            return [];
        }

        return parsed
            .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
            .slice(0, MAX_MISTAKE_REVIEW_TERMS);
    } catch {
        localStorage.removeItem(getMistakeReviewQueueStorageKey(userId));
        return [];
    }
}

export function recordMistakeReviewMiss(termId: string, userId?: string | null): string[] {
    const currentQueue = getMistakeReviewQueue(userId);
    const nextQueue = [termId, ...currentQueue.filter((queuedTermId) => queuedTermId !== termId)]
        .slice(0, MAX_MISTAKE_REVIEW_TERMS);

    if (!isLocalStorageAvailable()) {
        return nextQueue;
    }

    try {
        localStorage.setItem(getMistakeReviewQueueStorageKey(userId), JSON.stringify(nextQueue));
    } catch (error) {
        logger.error('STORAGE_SAVE_MISTAKE_REVIEW_QUEUE_FAILED', {
            route: 'storage',
            error: error instanceof Error ? error : undefined,
        });
    }

    return nextQueue;
}

export function removeMistakeReviewTerm(termId: string, userId?: string | null): string[] {
    const nextQueue = getMistakeReviewQueue(userId).filter((queuedTermId) => queuedTermId !== termId);

    if (!isLocalStorageAvailable()) {
        return nextQueue;
    }

    try {
        if (nextQueue.length === 0) {
            localStorage.removeItem(getMistakeReviewQueueStorageKey(userId));
        } else {
            localStorage.setItem(getMistakeReviewQueueStorageKey(userId), JSON.stringify(nextQueue));
        }
    } catch (error) {
        logger.error('STORAGE_REMOVE_MISTAKE_REVIEW_TERM_FAILED', {
            route: 'storage',
            error: error instanceof Error ? error : undefined,
        });
    }

    return nextQueue;
}
