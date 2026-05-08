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

const DATA_VERSION = '2026-05-07-v7';
const TERM_STATE_OVERRIDES_SCHEMA = 'term-state-overrides-v1';

const TERM_STATE_FIELDS = [
    'srs_level',
    'next_review_date',
    'last_reviewed',
    'difficulty_score',
    'retention_rate',
    'times_reviewed',
    'times_correct',
] as const;
type TermStateField = typeof TERM_STATE_FIELDS[number];
type TermStateValues = Pick<Term, TermStateField>;
type TermStateOverride = { id: string } & Partial<TermStateValues>;

interface ParsedTermOverrides {
    overrides: TermStateOverride[];
    requiresRewrite: boolean;
}

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

const countMasteredTerms = (
    terms: readonly Term[]
): number => {
    return terms.reduce((count, term) => (
        term.srs_level >= 4
            ? count + 1
            : count
    ), 0);
};

const restoreStorageSnapshot = (key: string, value: string | null): void => {
    if (value === null) {
        localStorage.removeItem(key);
        return;
    }

    localStorage.setItem(key, value);
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

const parseTermStateOverride = (value: unknown): TermStateOverride | null => {
    if (!value || typeof value !== 'object') {
        return null;
    }

    const candidate = value as Partial<Term>;
    if (typeof candidate.id !== 'string' || candidate.id.trim().length === 0) {
        return null;
    }

    const override: TermStateOverride = { id: candidate.id.trim() };

    TERM_STATE_FIELDS.forEach((field) => {
        const fieldValue = candidate[field];

        if (field === 'last_reviewed') {
            if (typeof fieldValue === 'string' || fieldValue === null) {
                Object.assign(override, { [field]: fieldValue });
            }
            return;
        }

        if (field === 'next_review_date') {
            if (typeof fieldValue === 'string' && Number.isFinite(Date.parse(fieldValue))) {
                Object.assign(override, { [field]: fieldValue });
            }
            return;
        }

        if (typeof fieldValue === 'number' && Number.isFinite(fieldValue)) {
            Object.assign(override, { [field]: fieldValue });
        }
    });

    return override;
};

const parseStoredTermOverrides = (stored: string | null): ParsedTermOverrides => {
    if (!stored) {
        return {
            overrides: [],
            requiresRewrite: false,
        };
    }

    const parsed = JSON.parse(stored) as unknown;

    if (Array.isArray(parsed)) {
        return {
            overrides: parsed
                .map((entry) => parseTermStateOverride(entry))
                .filter((entry): entry is TermStateOverride => Boolean(entry)),
            requiresRewrite: true,
        };
    }

    if (
        parsed
        && typeof parsed === 'object'
        && 'schema' in parsed
        && parsed.schema === TERM_STATE_OVERRIDES_SCHEMA
        && 'overrides' in parsed
        && Array.isArray(parsed.overrides)
    ) {
        return {
            overrides: parsed.overrides
                .map((entry) => parseTermStateOverride(entry))
                .filter((entry): entry is TermStateOverride => Boolean(entry)),
            requiresRewrite: false,
        };
    }

    return {
        overrides: [],
        requiresRewrite: true,
    };
};

const mergeTermStudyState = (fallbackTerms: Term[], storedOverrides: readonly TermStateOverride[]): Term[] => {
    const storedOverridesById = new Map(storedOverrides.map((term) => [term.id, term] as const));

    return fallbackTerms.map((fallbackTerm) => {
        const storedOverride = storedOverridesById.get(fallbackTerm.id);
        if (!storedOverride) {
            return fallbackTerm;
        }

        const preservedState = TERM_STATE_FIELDS.reduce<Partial<TermStateValues>>((result, field) => {
            if (!Object.prototype.hasOwnProperty.call(storedOverride, field)) {
                return result;
            }

            return {
                ...result,
                [field]: storedOverride[field],
            };
        }, {});

        return {
            ...fallbackTerm,
            ...preservedState,
        };
    });
};

const buildTermStateOverride = (
    term: Term,
    fallbackTerm: Term
): TermStateOverride | null => {
    const override: TermStateOverride = { id: term.id };
    let hasChangedState = false;

    TERM_STATE_FIELDS.forEach((field) => {
        if (term[field] === fallbackTerm[field]) {
            return;
        }

        Object.assign(override, { [field]: term[field] });
        hasChangedState = true;
    });

    return hasChangedState ? override : null;
};

const persistTermStateOverrides = (
    terms: readonly Term[],
    fallbackTerms: readonly Term[],
    termsStorageKey: string,
    versionStorageKey: string,
    isGuestScope: boolean
): void => {
    const fallbackTermsById = new Map(fallbackTerms.map((term) => [term.id, term] as const));
    const overrides = terms
        .map((term) => {
            const fallbackTerm = fallbackTermsById.get(term.id);
            return fallbackTerm ? buildTermStateOverride(term, fallbackTerm) : null;
        })
        .filter((override): override is TermStateOverride => Boolean(override));

    if (overrides.length === 0) {
        localStorage.removeItem(termsStorageKey);
    } else {
        localStorage.setItem(termsStorageKey, JSON.stringify({
            schema: TERM_STATE_OVERRIDES_SCHEMA,
            version: DATA_VERSION,
            overrides,
        }));
    }

    localStorage.setItem(versionStorageKey, DATA_VERSION);

    if (isGuestScope) {
        clearLegacyTermsCache();
    }
};

const persistReconciledTerms = (
    fallbackTerms: Term[],
    storedOverrides: readonly TermStateOverride[],
    termsStorageKey: string,
    versionStorageKey: string,
    isGuestScope: boolean
): Term[] => {
    const reconciledTerms = mergeTermStudyState(fallbackTerms, storedOverrides);
    persistTermStateOverrides(
        reconciledTerms,
        fallbackTerms,
        termsStorageKey,
        versionStorageKey,
        isGuestScope
    );

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

    persistTermStateOverrides(
        fallbackTerms,
        fallbackTerms,
        getTermsStorageKey(null),
        getTermsVersionStorageKey(null),
        true
    );
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

        const parsedOverrides = parseStoredTermOverrides(stored);

        // Refresh content schema while preserving compatible local SRS state.
        if (storedVersion !== DATA_VERSION || parsedOverrides.requiresRewrite) {
            return persistReconciledTerms(
                fallbackTerms,
                parsedOverrides.overrides,
                termsStorageKey,
                versionStorageKey,
                isGuestScope
            );
        }

        if (isGuestScope) {
            clearLegacyTermsCache();
        }

        if (!storedVersion) {
            localStorage.setItem(versionStorageKey, DATA_VERSION);
        }

        return mergeTermStudyState(fallbackTerms, parsedOverrides.overrides);
    } catch {
        return fallbackTerms;
    }
}

/**
 * Save terms to storage
 */
export function saveTerms(terms: Term[], userId?: string | null): boolean {
    if (!isLocalStorageAvailable()) return false;

    try {
        const fallbackTerms = filterAcademicTerms(catalogTerms);
        persistTermStateOverrides(
            filterAcademicTerms(terms),
            fallbackTerms,
            getTermsStorageKey(userId),
            getTermsVersionStorageKey(userId),
            resolveProgressScopeUserId(userId) === null
        );
        return true;
    } catch (error) {
        logger.error('STORAGE_SAVE_TERMS_FAILED', {
            route: 'storage',
            error: error instanceof Error ? error : undefined,
        });
        return false;
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
export function saveUserProgress(progress: UserProgress, userId?: string | null): boolean {
    if (!isLocalStorageAvailable()) return false;

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
        return true;
    } catch (error) {
        logger.error('STORAGE_SAVE_PROGRESS_FAILED', {
            route: 'storage',
            error: error instanceof Error ? error : undefined,
        });
        return false;
    }
}

const buildProgressAfterQuizAttempt = (
    progress: UserProgress,
    attempt: QuizAttempt,
    terms: readonly Term[]
): UserProgress => {
    const nextQuizHistory = clampQuizHistory([
        ...progress.quiz_history,
        attempt,
    ]);
    const updatedProgress: UserProgress = {
        ...progress,
        quiz_history: nextQuizHistory,
    };
    const today = startOfUtcDay(new Date()).getTime();
    const lastStudy = updatedProgress.last_study_date
        ? startOfUtcDay(updatedProgress.last_study_date).getTime()
        : null;

    if (lastStudy !== today) {
        const yesterday = startOfUtcDay(new Date(Date.now() - (24 * 60 * 60 * 1000))).getTime();
        updatedProgress.current_streak = lastStudy === yesterday ? updatedProgress.current_streak + 1 : 1;
        updatedProgress.last_study_date = toUtcDateKey(new Date());
    }

    updatedProgress.total_words_learned = countMasteredTerms(terms);
    return updatedProgress;
};

export interface GuestQuizReviewSaveResult {
    readonly ok: boolean;
    readonly terms?: readonly Term[];
    readonly progress?: UserProgress;
}

/**
 * Persist a guest quiz review as one visible operation.
 */
export function saveGuestQuizReview(
    updatedTerm: Term,
    attempt: QuizAttempt,
    userId?: string | null
): GuestQuizReviewSaveResult {
    if (!isLocalStorageAvailable()) {
        return { ok: false };
    }

    const terms = getTerms(userId);
    const updatedTerms = terms.map((term) => (
        term.id === updatedTerm.id ? updatedTerm : term
    ));
    const updatedProgress = buildProgressAfterQuizAttempt(
        getUserProgress(userId),
        attempt,
        updatedTerms
    );
    const termsKey = getTermsStorageKey(userId);
    const versionKey = getTermsVersionStorageKey(userId);
    const progressKey = getProgressStorageKey(userId ?? updatedProgress.user_id);
    const previousTerms = localStorage.getItem(termsKey);
    const previousVersion = localStorage.getItem(versionKey);
    const previousProgress = localStorage.getItem(progressKey);

    if (!saveTerms(updatedTerms, userId) || !saveUserProgress(updatedProgress, userId)) {
        try {
            restoreStorageSnapshot(termsKey, previousTerms);
            restoreStorageSnapshot(versionKey, previousVersion);
            restoreStorageSnapshot(progressKey, previousProgress);
        } catch (error) {
            logger.error('STORAGE_GUEST_QUIZ_REVIEW_ROLLBACK_FAILED', {
                route: 'storage',
                error: error instanceof Error ? error : undefined,
            });
        }

        return { ok: false };
    }

    return {
        ok: true,
        terms: updatedTerms,
        progress: updatedProgress,
    };
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
    const updatedProgress = buildProgressAfterQuizAttempt(progress, attempt, getTerms(userId));

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
