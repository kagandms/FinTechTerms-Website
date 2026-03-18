'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';
import { Term, UserProgress, QuizAttempt } from '@/types';
import {
    getTerms,
    saveTerms,
    updateTerm as updateTermInStorage,
    getUserProgress as getLocalUserProgress,
    toggleFavorite as toggleFavoriteInStorage,
    addQuizAttempt as addQuizAttemptToStorage,
    saveUserProgress as saveLocalUserProgress,
} from '@/utils/storage';
import {
    getTermsDueForReview,
    updateTermAfterReview,
    calculateProgressStats
} from '@/utils/srsLogic';
import { useAuth } from '@/contexts/AuthContext';
import {
    getUserProgressFromSupabase,
    toggleFavoriteInSupabase,
    saveQuizAttemptToSupabase,
    getAllTermSRSFromSupabase,
    type RecordQuizResult,
} from '@/lib/supabaseStorage';
import { filterAcademicTerms } from '@/lib/academicQuarantine';
import { createIdempotencyKey } from '@/lib/idempotency';
import { isUserProgress } from '@/lib/userProgress';
import { useToast } from '@/contexts/ToastContext';

type AsyncDataStatus = 'loading' | 'ready' | 'degraded' | 'error';

interface FavoriteToggleResult {
    success: boolean;
    limitReached: boolean;
    isFavorite?: boolean;
    error?: string;
}

interface SRSContextType {
    terms: Term[];
    userProgress: UserProgress;
    dueTerms: Term[];
    toggleFavorite: (termId: string) => Promise<FavoriteToggleResult>;
    isFavorite: (termId: string) => boolean;
    isFavoriteUpdating: (termId: string) => boolean;
    submitQuizAnswer: (termId: string, isCorrect: boolean, responseTimeMs: number | undefined, reviewId: string) => Promise<void>;
    refreshData: () => void;
    canAddMoreFavorites: boolean;
    favoritesRemaining: number;
    isSyncing: boolean;
    isLoading: boolean;
    termsStatus: AsyncDataStatus;
    progressStatus: AsyncDataStatus;
    termsError: string | null;
    progressError: string | null;
    stats: {
        totalFavorites: number;
        mastered: number;
        learning: number;
        dueToday: number;
        averageRetention: number;
    };
}

const SRSContext = createContext<SRSContextType | undefined>(undefined);

const SRS_SYNC_CHANNEL = 'srs_sync';
const SRS_SYNC_STORAGE_KEY = 'fintechterms_srs_sync';
const PENDING_REVIEW_STORAGE_KEY = 'fintechterms_pending_review';

interface PendingReview {
    reviewId: string;
    termId: string;
    isCorrect: boolean;
    responseTimeMs: number;
    idempotencyKey: string;
}

interface SrsSyncMessage {
    type: 'REVIEW_COMMITTED';
    reviewId: string;
    termId: string;
    termSrs: RecordQuizResult['termSrs'];
    userProgress: Pick<RecordQuizResult['userProgress'], 'current_streak' | 'last_study_date' | 'total_words_learned' | 'updated_at'>;
}

interface SRSProviderProps {
    children: ReactNode;
}

const createSafeProgress = (): UserProgress => ({
    user_id: 'guest',
    favorites: [],
    current_language: 'ru',
    quiz_history: [],
    total_words_learned: 0,
    current_streak: 0,
    last_study_date: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
});

const getErrorMessage = (error: unknown, fallbackMessage: string): string => {
    if (error instanceof Error && error.message.trim().length > 0) {
        return error.message;
    }

    return fallbackMessage;
};

const hasCachedStudyData = (progress: UserProgress): boolean => (
    progress.favorites.length > 0
    || progress.quiz_history.length > 0
    || progress.total_words_learned > 0
    || progress.current_streak > 0
    || progress.last_study_date !== null
);

const isPendingReview = (value: unknown): value is PendingReview => {
    if (!value || typeof value !== 'object') {
        return false;
    }

    const candidate = value as Partial<PendingReview>;
    return (
        typeof candidate.reviewId === 'string'
        && typeof candidate.termId === 'string'
        && typeof candidate.isCorrect === 'boolean'
        && typeof candidate.responseTimeMs === 'number'
        && Number.isFinite(candidate.responseTimeMs)
        && typeof candidate.idempotencyKey === 'string'
    );
};

export function SRSProvider({ children }: SRSProviderProps) {
    const { favoriteLimit, isAuthenticated, user, isLoading: isAuthLoading } = useAuth();
    const { showToast } = useToast();
    const userId = user?.id ?? null;
    const [terms, setTerms] = useState<Term[]>([]);
    const [userProgress, setUserProgress] = useState<UserProgress | null>(null);
    const [isSyncing, setIsSyncing] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [termsStatus, setTermsStatus] = useState<AsyncDataStatus>('loading');
    const [progressStatus, setProgressStatus] = useState<AsyncDataStatus>('loading');
    const [termsError, setTermsError] = useState<string | null>(null);
    const [progressError, setProgressError] = useState<string | null>(null);
    const [favoriteOptimisticState, setFavoriteOptimisticState] = useState<Record<string, boolean>>({});
    const [favoritePendingState, setFavoritePendingState] = useState<Record<string, boolean>>({});
    const reviewIdempotencyKeysRef = useRef<Record<string, string>>({});
    const pendingReviewRef = useRef<PendingReview | null>(null);
    const isReplayingPendingReviewRef = useRef(false);
    const syncChannelRef = useRef<BroadcastChannel | null>(null);
    const previousAuthStateRef = useRef(isAuthenticated);

    const getOrCreateReviewKey = useCallback((reviewId: string): string => {
        const existingKey = reviewIdempotencyKeysRef.current[reviewId];
        if (existingKey) {
            return existingKey;
        }

        const nextKey = createIdempotencyKey();
        reviewIdempotencyKeysRef.current[reviewId] = nextKey;
        return nextKey;
    }, []);

    const clearReviewKey = useCallback((reviewId: string) => {
        delete reviewIdempotencyKeysRef.current[reviewId];
    }, []);

    const clearPendingReview = useCallback(() => {
        pendingReviewRef.current = null;

        if (typeof window === 'undefined') {
            return;
        }

        try {
            window.sessionStorage.removeItem(PENDING_REVIEW_STORAGE_KEY);
        } catch {
            // Best-effort pending review cleanup only.
        }
    }, []);

    const persistPendingReview = useCallback((pendingReview: PendingReview) => {
        pendingReviewRef.current = pendingReview;
        reviewIdempotencyKeysRef.current[pendingReview.reviewId] = pendingReview.idempotencyKey;

        if (typeof window === 'undefined') {
            return;
        }

        try {
            window.sessionStorage.setItem(
                PENDING_REVIEW_STORAGE_KEY,
                JSON.stringify(pendingReview)
            );
        } catch {
            // Best-effort pending review persistence only.
        }
    }, []);

    const restorePendingReview = useCallback(() => {
        if (typeof window === 'undefined') {
            return;
        }

        try {
            const storedPendingReview = window.sessionStorage.getItem(PENDING_REVIEW_STORAGE_KEY);
            if (!storedPendingReview) {
                return;
            }

            const parsedPendingReview = JSON.parse(storedPendingReview) as unknown;
            if (!isPendingReview(parsedPendingReview)) {
                window.sessionStorage.removeItem(PENDING_REVIEW_STORAGE_KEY);
                return;
            }

            pendingReviewRef.current = parsedPendingReview;
            reviewIdempotencyKeysRef.current[parsedPendingReview.reviewId] = parsedPendingReview.idempotencyKey;
        } catch {
            window.sessionStorage.removeItem(PENDING_REVIEW_STORAGE_KEY);
        }
    }, []);

    const applyCommittedReview = useCallback((
        termId: string,
        attempt: QuizAttempt,
        result: RecordQuizResult
    ) => {
        const { term_id: _termId, ...serverTermSrs } = result.termSrs;

        setTerms(prev => {
            const reconciledTerms = prev.map(existingTerm => (
                existingTerm.id === termId
                    ? { ...existingTerm, ...serverTermSrs }
                    : existingTerm
            ));

            saveTerms(reconciledTerms);
            return reconciledTerms;
        });

        setUserProgress(prev => {
            const baseProgress = prev ?? getLocalUserProgress();
            const reconciledProgress = {
                ...baseProgress,
                quiz_history: baseProgress.quiz_history.some((existingAttempt) => existingAttempt.id === attempt.id)
                    ? baseProgress.quiz_history
                    : [...baseProgress.quiz_history, attempt],
                current_streak: result.userProgress.current_streak,
                last_study_date: result.userProgress.last_study_date,
                total_words_learned: result.userProgress.total_words_learned,
                updated_at: result.userProgress.updated_at,
            };

            saveLocalUserProgress(reconciledProgress);
            return reconciledProgress;
        });
    }, []);

    const broadcastCommittedReview = useCallback((message: SrsSyncMessage) => {
        syncChannelRef.current?.postMessage(message);

        if (typeof window === 'undefined') {
            return;
        }

        try {
            window.localStorage.setItem(SRS_SYNC_STORAGE_KEY, JSON.stringify({
                ...message,
                emittedAt: Date.now(),
            }));
        } catch {
            // Best-effort cross-tab fallback only.
        }
    }, []);

    const applySyncedReview = useCallback((message: SrsSyncMessage) => {
        const { termId, termSrs, userProgress: syncedProgress } = message;
        const { term_id: _termId, ...serverTermSrs } = termSrs;

        setTerms(prev => {
            const reconciledTerms = prev.map(existingTerm => (
                existingTerm.id === termId
                    ? { ...existingTerm, ...serverTermSrs }
                    : existingTerm
            ));

            saveTerms(reconciledTerms);
            return reconciledTerms;
        });

        setUserProgress(prev => {
            if (!prev) {
                return prev;
            }

            const reconciledProgress = {
                ...prev,
                current_streak: syncedProgress.current_streak,
                last_study_date: syncedProgress.last_study_date,
                total_words_learned: syncedProgress.total_words_learned,
                updated_at: syncedProgress.updated_at,
            };

            saveLocalUserProgress(reconciledProgress);
            return reconciledProgress;
        });
    }, []);

    /**
     * Load data from appropriate source
     */
    const loadData = useCallback(async () => {
        setIsLoading(true);
        setIsSyncing(true);
        setTermsStatus('loading');
        setProgressStatus('loading');
        setTermsError(null);
        setProgressError(null);
        try {
            // Default to local storage or mock data initially
            let currentTerms = getTerms();

            // CLEANUP: Deduplicate local terms immediately (handle poisoned localStorage)
            const uniqueLocalTerms = new Map<string, Term>();
            currentTerms.forEach(term => {
                const key = term.term_en.toLowerCase().replace(/[^a-z0-9]/g, '');

                if (!uniqueLocalTerms.has(key)) {
                    uniqueLocalTerms.set(key, term);
                }
            });

            // Convert back to array
            currentTerms = filterAcademicTerms(Array.from(uniqueLocalTerms.values()));

            // Show cached progress immediately, then reconcile with server data when available.
            const localProgress = getLocalUserProgress();
            const optimisticProgress = localProgress;
            setUserProgress(optimisticProgress);

            // OPTIMIZATION: Show local data IMMEDIATELY (Stale-While-Revalidate)
            if (currentTerms.length > 0) {
                setTerms(currentTerms);
            }

            let nextTermsStatus: AsyncDataStatus = currentTerms.length > 0 ? 'ready' : 'error';
            let nextProgressStatus: AsyncDataStatus = isAuthenticated ? 'loading' : 'ready';
            let nextTermsError: string | null = null;
            let nextProgressError: string | null = null;

            // Final safety check: if we somehow definitely have 0 terms, force reload from utils
            if (!currentTerms || currentTerms.length === 0) {
                console.warn('[LoadData] Terms are still empty. FORCING mock data reload.');
                const { mockTerms } = await import('@/data/mockData');
                currentTerms = filterAcademicTerms(mockTerms);
                saveTerms(currentTerms);
                nextTermsStatus = 'ready';
            }

            setTerms(currentTerms);

            if (isAuthenticated && userId) {
                try {
                    const cloudProgress = await getUserProgressFromSupabase(userId);

                    if (cloudProgress && isUserProgress(cloudProgress)) {
                        const srsData = await getAllTermSRSFromSupabase(userId);
                        const mergedTerms = currentTerms.map(term => {
                            const override = srsData.get(term.id);
                            if (override) {
                                return { ...term, ...override };
                            }
                            return term;
                        });

                        setTerms(mergedTerms);
                        setUserProgress(cloudProgress);
                        saveLocalUserProgress(cloudProgress);
                        nextProgressStatus = 'ready';
                    } else {
                        setTerms(currentTerms);
                        setUserProgress(optimisticProgress);
                        nextProgressError = 'Failed to load study progress from Supabase.';
                        nextProgressStatus = hasCachedStudyData(optimisticProgress) ? 'degraded' : 'error';
                    }
                } catch (error) {
                    console.error('Failed to load user data from cloud:', error);
                    setTerms(currentTerms);
                    setUserProgress(optimisticProgress);
                    nextProgressError = getErrorMessage(error, 'Failed to load study progress from Supabase.');
                    nextProgressStatus = hasCachedStudyData(optimisticProgress) ? 'degraded' : 'error';
                }
            } else {
                setUserProgress(optimisticProgress);
                nextProgressStatus = 'ready';
            }

            setTermsError(nextTermsError);
            setProgressError(nextProgressError);
            setTermsStatus(nextTermsStatus);
            setProgressStatus(nextProgressStatus);
        } catch (error) {
            const fallbackMessage = getErrorMessage(error, 'Failed to load study data.');
            console.error('Unexpected SRS load error:', error);
            setTermsError(prev => prev ?? fallbackMessage);
            setProgressError(prev => prev ?? fallbackMessage);
            setTermsStatus(prev => (prev === 'ready' ? 'degraded' : 'error'));
            setProgressStatus(prev => (prev === 'ready' ? 'degraded' : 'error'));
        } finally {
            setIsLoading(false);
            setIsSyncing(false);
        }
    }, [isAuthenticated, userId]);

    // Load data on mount and when auth state changes
    useEffect(() => {
        if (isAuthLoading) {
            return;
        }

        loadData();
    }, [isAuthLoading, loadData]);

    useEffect(() => {
        setFavoriteOptimisticState({});
        setFavoritePendingState({});
    }, [isAuthenticated, userId]);

    useEffect(() => {
        restorePendingReview();
    }, [restorePendingReview]);

    useEffect(() => {
        if (typeof window === 'undefined') {
            return undefined;
        }

        const handleSyncMessage = (payload: unknown) => {
            if (
                !payload
                || typeof payload !== 'object'
                || (payload as { type?: string }).type !== 'REVIEW_COMMITTED'
            ) {
                return;
            }

            applySyncedReview(payload as SrsSyncMessage);
        };

        const channel = typeof BroadcastChannel !== 'undefined'
            ? new BroadcastChannel(SRS_SYNC_CHANNEL)
            : null;
        syncChannelRef.current = channel;

        const handleChannelMessage = (event: MessageEvent) => {
            handleSyncMessage(event.data);
        };

        const handleStorageEvent = (event: StorageEvent) => {
            if (event.key !== SRS_SYNC_STORAGE_KEY || !event.newValue) {
                return;
            }

            try {
                handleSyncMessage(JSON.parse(event.newValue));
            } catch {
                // Ignore malformed sync events from storage.
            }
        };

        channel?.addEventListener('message', handleChannelMessage);
        window.addEventListener('storage', handleStorageEvent);

        return () => {
            channel?.removeEventListener('message', handleChannelMessage);
            channel?.close();
            syncChannelRef.current = null;
            window.removeEventListener('storage', handleStorageEvent);
        };
    }, [applySyncedReview]);

    // Calculate due terms
    const dueTerms = userProgress
        ? getTermsDueForReview(terms, userProgress.favorites)
        : [];

    // Calculate stats
    const stats = userProgress
        ? calculateProgressStats(terms, userProgress.favorites)
        : { totalFavorites: 0, mastered: 0, learning: 0, dueToday: 0, averageRetention: 0 };

    // Check if user can add more favorites
    const canAddMoreFavorites = isAuthenticated || (userProgress?.favorites.length ?? 0) < favoriteLimit;
    const favoritesRemaining = isAuthenticated
        ? Infinity
        : Math.max(0, favoriteLimit - (userProgress?.favorites.length ?? 0));

    /**
     * Toggle a term's favorite status with limit check
     */
    const toggleFavorite = useCallback(async (termId: string): Promise<FavoriteToggleResult> => {
        const currentFavorites = userProgress?.favorites ?? [];
        const optimisticFavorite = favoriteOptimisticState[termId];
        const isCurrentlyFavorite = optimisticFavorite ?? currentFavorites.includes(termId);
        const shouldFavorite = !isCurrentlyFavorite;

        try {
            if (favoritePendingState[termId]) {
                return {
                    success: false,
                    limitReached: false,
                    isFavorite: isCurrentlyFavorite,
                };
            }

            if (isAuthLoading) {
                return {
                    success: false,
                    limitReached: false,
                    isFavorite: isCurrentlyFavorite,
                    error: 'Authentication is still loading.',
                };
            }

            // If trying to add and limit reached
            if (!isCurrentlyFavorite && !isAuthenticated && currentFavorites.length >= favoriteLimit) {
                return { success: false, limitReached: true };
            }

            if (isAuthenticated && userId) {
                setFavoritePendingState(prev => ({ ...prev, [termId]: true }));
                setFavoriteOptimisticState(prev => ({ ...prev, [termId]: shouldFavorite }));

                try {
                    const response = await toggleFavoriteInSupabase(userId, termId, shouldFavorite);
                    setUserProgress(prev => {
                        const baseProgress = prev ?? getLocalUserProgress();
                        const reconciled = {
                            ...baseProgress,
                            favorites: response.favorites,
                            updated_at: new Date().toISOString(),
                        };

                        saveLocalUserProgress(reconciled);
                        return reconciled;
                    });

                    return {
                        success: true,
                        limitReached: false,
                        isFavorite: response.isFavorite,
                    };
                } catch (error) {
                    console.error('Failed to sync favorite to cloud:', error);

                    return {
                        success: false,
                        limitReached: false,
                        isFavorite: isCurrentlyFavorite,
                        error: error instanceof Error ? error.message : 'Failed to update favorite.',
                    };
                } finally {
                    setFavoritePendingState(prev => {
                        const next = { ...prev };
                        delete next[termId];
                        return next;
                    });
                    setFavoriteOptimisticState(prev => {
                        const next = { ...prev };
                        delete next[termId];
                        return next;
                    });
                }
            }

            // Guest mode — local storage only
            const updated = toggleFavoriteInStorage(termId);
            setUserProgress(updated);
            return {
                success: true,
                limitReached: false,
                isFavorite: updated.favorites.includes(termId),
            };
        } catch (error) {
            console.error('Failed to toggle favorite:', error);
            return {
                success: false,
                limitReached: false,
                isFavorite: isCurrentlyFavorite,
                error: error instanceof Error ? error.message : 'Failed to update favorite.',
            };
        }
    }, [favoriteLimit, favoriteOptimisticState, favoritePendingState, isAuthLoading, isAuthenticated, userId, userProgress]);

    /**
     * Check if a term is favorited
     */
    const isFavorite = useCallback((termId: string): boolean => {
        if (Object.prototype.hasOwnProperty.call(favoriteOptimisticState, termId)) {
            return favoriteOptimisticState[termId] ?? false;
        }

        return userProgress?.favorites.includes(termId) ?? false;
    }, [favoriteOptimisticState, userProgress]);

    const isFavoriteUpdating = useCallback((termId: string): boolean => (
        favoritePendingState[termId] ?? false
    ), [favoritePendingState]);

    /**
     * Submit a quiz answer and update SRS data
     */
    const submitQuizAnswer = useCallback(async (
        termId: string,
        isCorrect: boolean,
        responseTimeMs: number = 0,
        reviewId: string
    ): Promise<void> => {
        const term = terms.find(t => t.id === termId);
        if (!term) return;

        const idempotencyKey = getOrCreateReviewKey(reviewId);
        const attempt: QuizAttempt = {
            id: idempotencyKey,
            term_id: termId,
            is_correct: isCorrect,
            response_time_ms: responseTimeMs,
            timestamp: new Date().toISOString(),
            quiz_type: 'daily',
        };

        if (!isAuthenticated || !userId) {
            const updatedTerm = updateTermAfterReview(term, isCorrect);
            const updatedTerms = updateTermInStorage(updatedTerm);
            setTerms(updatedTerms);

            const updatedProgress = addQuizAttemptToStorage(attempt);
            setUserProgress(updatedProgress);
            clearReviewKey(reviewId);
            clearPendingReview();
            return;
        }

        const result = await saveQuizAttemptToSupabase(userId, attempt);

        if (result.status === 'ok') {
            applyCommittedReview(termId, attempt, result.data);
            broadcastCommittedReview({
                type: 'REVIEW_COMMITTED',
                reviewId,
                termId,
                termSrs: result.data.termSrs,
                userProgress: result.data.userProgress,
            });
            clearPendingReview();
            clearReviewKey(reviewId);
            return;
        }

        if (result.status === 'auth_expired') {
            persistPendingReview({
                reviewId,
                termId,
                isCorrect,
                responseTimeMs,
                idempotencyKey,
            });
            throw new Error(result.message);
        }

        if (result.status === 'retryable') {
            throw new Error(result.message);
        }

        clearPendingReview();
        clearReviewKey(reviewId);
        showToast('Progress could not be saved. Please try again.', 'error');
        throw new Error(result.message);
    }, [
        applyCommittedReview,
        broadcastCommittedReview,
        clearPendingReview,
        clearReviewKey,
        getOrCreateReviewKey,
        isAuthenticated,
        persistPendingReview,
        showToast,
        terms,
        userId,
    ]);

    useEffect(() => {
        const becameAuthenticated = !previousAuthStateRef.current && isAuthenticated;
        previousAuthStateRef.current = isAuthenticated;

        if (
            !becameAuthenticated
            || !pendingReviewRef.current
            || !userId
            || isReplayingPendingReviewRef.current
        ) {
            return;
        }

        const pendingReview = pendingReviewRef.current;
        isReplayingPendingReviewRef.current = true;
        showToast('Session refreshed — saving your answer…', 'info');

        void submitQuizAnswer(
            pendingReview.termId,
            pendingReview.isCorrect,
            pendingReview.responseTimeMs,
            pendingReview.reviewId
        ).catch((error) => {
            console.error('Failed to replay pending quiz review:', error);
        }).finally(() => {
            isReplayingPendingReviewRef.current = false;
        });
    }, [isAuthenticated, showToast, submitQuizAnswer, userId]);

    /**
     * Manually refresh all data from storage
     */
    const refreshData = useCallback(() => {
        void loadData();
    }, [loadData]);

    // Use default progress if not yet hydrated
    const safeProgress = userProgress ?? createSafeProgress();

    return (
        <SRSContext.Provider
            value={{
                terms,
                userProgress: safeProgress,
                dueTerms,
                toggleFavorite,
                isFavorite,
                isFavoriteUpdating,
                submitQuizAnswer,
                refreshData,
                canAddMoreFavorites,
                favoritesRemaining,
                isSyncing,
                isLoading,
                termsStatus,
                progressStatus,
                termsError,
                progressError,
                stats,
            }}
        >
            {children}
        </SRSContext.Provider>
    );
}

/**
 * Hook to access SRS context
 */
export function useSRS() {
    const context = useContext(SRSContext);
    if (context === undefined) {
        throw new Error('useSRS must be used within an SRSProvider');
    }
    return context;
}
