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
    type UserProgressLoadMissingSegment,
    type RecordQuizResult,
} from '@/lib/supabaseStorage';
import { filterAcademicTerms } from '@/lib/academicQuarantine';
import { createIdempotencyKey } from '@/lib/idempotency';
import { useToast } from '@/contexts/ToastContext';
import { logger } from '@/lib/logger';
import {
    createSafeProgress,
    getErrorMessage,
    hasCachedStudyData,
    isPendingReview,
    mergeUserProgressSnapshot,
    type PendingReview,
} from '@/contexts/srs-context-helpers';

type AsyncDataStatus = 'loading' | 'ready' | 'degraded' | 'error';

interface FavoriteToggleResult {
    success: boolean;
    limitReached: boolean;
    isFavorite?: boolean;
    error?: string;
    authExpired?: boolean;
    syncDeferred?: boolean;
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
const PENDING_REVIEW_SYNC_MESSAGE = 'Answer saved locally. It will sync when connection returns.';

interface SrsSyncMessage {
    type: 'REVIEW_COMMITTED';
    reviewId: string;
    termId: string;
    attempt: QuizAttempt;
    termSrs: RecordQuizResult['termSrs'];
    userProgress: Pick<RecordQuizResult['userProgress'], 'current_streak' | 'last_study_date' | 'total_words_learned' | 'updated_at'>;
}

interface SRSProviderProps {
    children: ReactNode;
}

const mergeProgressSnapshots = (
    localProgress: UserProgress,
    remoteProgress: UserProgress,
    missingSegments: readonly UserProgressLoadMissingSegment[]
): UserProgress => mergeUserProgressSnapshot(localProgress, remoteProgress, missingSegments);

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
    const [pendingReviewVersion, setPendingReviewVersion] = useState(0);
    const reviewIdempotencyKeysRef = useRef<Record<string, string>>({});
    const pendingReviewRef = useRef<PendingReview | null>(null);
    const isReplayingPendingReviewRef = useRef(false);
    const replayedPendingReviewIdRef = useRef<string | null>(null);
    const authTransitionReplayReadyRef = useRef(false);
    const pendingReviewReplayReadyRef = useRef(false);
    const syncChannelRef = useRef<BroadcastChannel | null>(null);
    const previousAuthStateRef = useRef(isAuthenticated);
    const loadRequestIdRef = useRef(0);

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
        replayedPendingReviewIdRef.current = null;
        pendingReviewReplayReadyRef.current = false;
        setPendingReviewVersion((value) => value + 1);

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
        pendingReviewReplayReadyRef.current = false;
        setPendingReviewVersion((value) => value + 1);

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
            replayedPendingReviewIdRef.current = null;
            pendingReviewReplayReadyRef.current = true;
            setPendingReviewVersion((value) => value + 1);
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
            const baseProgress = prev ?? getLocalUserProgress(userId);
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

            saveLocalUserProgress(reconciledProgress, userId);
            return reconciledProgress;
        });
    }, [userId]);

    const applyLocalReview = useCallback((
        termId: string,
        isCorrect: boolean,
        attempt: QuizAttempt
    ): boolean => {
        const term = terms.find((entry) => entry.id === termId);
        if (!term) {
            return false;
        }

        const updatedTerm = updateTermAfterReview(term, isCorrect);
        const updatedTerms = terms.map((entry) => (
            entry.id === termId
                ? updatedTerm
                : entry
        ));
        updateTermInStorage(updatedTerm);
        const updatedProgress = addQuizAttemptToStorage(attempt, userId);

        setTerms(updatedTerms);
        setUserProgress(updatedProgress);
        return true;
    }, [terms, userId]);

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
        const { attempt, termId, termSrs, userProgress: syncedProgress } = message;
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

            const nextQuizHistory = prev.quiz_history.some((attempt) => attempt.id === message.reviewId)
                ? prev.quiz_history
                : [
                    ...prev.quiz_history,
                    attempt,
                ];
            const reconciledProgress = {
                ...prev,
                quiz_history: nextQuizHistory,
                current_streak: syncedProgress.current_streak,
                last_study_date: syncedProgress.last_study_date,
                total_words_learned: syncedProgress.total_words_learned,
                updated_at: syncedProgress.updated_at,
            };

            saveLocalUserProgress(reconciledProgress, userId);
            return reconciledProgress;
        });
    }, [userId]);

    /**
     * Load data from appropriate source
     */
    const loadData = useCallback(async () => {
        const requestId = loadRequestIdRef.current + 1;
        loadRequestIdRef.current = requestId;
        const isCurrentRequest = (): boolean => loadRequestIdRef.current === requestId;

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
                if (!uniqueLocalTerms.has(term.id)) {
                    uniqueLocalTerms.set(term.id, term);
                }
            });

            // Convert back to array
            currentTerms = filterAcademicTerms(Array.from(uniqueLocalTerms.values()));

            // Show cached progress immediately, then reconcile with server data when available.
            const localProgress = getLocalUserProgress(userId);
            const optimisticProgress = localProgress;
            let resolvedProgress = optimisticProgress;
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
                logger.warn('SRS_LOAD_TERMS_EMPTY_RELOAD', {
                    route: 'SRSProvider',
                });
                const { mockTerms } = await import('@/data/mockData');
                currentTerms = filterAcademicTerms(mockTerms);
                saveTerms(currentTerms);
                nextTermsStatus = 'ready';
            }

            if (isAuthenticated && userId) {
                try {
                    const cloudProgress = await getUserProgressFromSupabase(userId);
                    if (!isCurrentRequest()) {
                        return;
                    }

                    if (cloudProgress.status === 'ok' || cloudProgress.status === 'partial') {
                        const mergedProgress = cloudProgress.status === 'partial'
                            ? mergeProgressSnapshots(
                                optimisticProgress,
                                cloudProgress.data,
                                cloudProgress.missing
                            )
                            : cloudProgress.data;

                        saveLocalUserProgress(mergedProgress, userId);

                        const srsData = mergedProgress.favorites.length > 0
                            ? await getAllTermSRSFromSupabase(userId, mergedProgress.favorites)
                            : {
                                status: 'ok' as const,
                                data: new Map<string, Partial<Term>>(),
                            };

                        if (!isCurrentRequest()) {
                            return;
                        }

                        resolvedProgress = mergedProgress;

                        if (srsData.status !== 'ok') {
                            nextProgressError = getErrorMessage(
                                new Error(srsData.message),
                                'Failed to load SRS progress from Supabase.'
                            );
                            nextProgressStatus = hasCachedStudyData(mergedProgress) ? 'degraded' : 'error';
                        } else {
                            currentTerms = currentTerms.map((term) => {
                                const override = srsData.data.get(term.id);
                                if (override) {
                                    return { ...term, ...override };
                                }
                                return term;
                            });

                            nextProgressStatus = cloudProgress.status === 'ok' ? 'ready' : 'degraded';
                            nextProgressError = cloudProgress.status === 'partial'
                                ? cloudProgress.message
                                : null;
                        }
                    } else {
                        resolvedProgress = optimisticProgress;
                        nextProgressError = cloudProgress.message;
                        nextProgressStatus = hasCachedStudyData(optimisticProgress) ? 'degraded' : 'error';
                    }
                } catch (error) {
                    logger.error('SRS_LOAD_CLOUD_PROGRESS_FAILED', {
                        route: 'SRSProvider',
                        userId,
                        error: error instanceof Error ? error : undefined,
                    });
                    if (!isCurrentRequest()) {
                        return;
                    }
                    resolvedProgress = optimisticProgress;
                    nextProgressError = getErrorMessage(error, 'Failed to load study progress from Supabase.');
                    nextProgressStatus = hasCachedStudyData(optimisticProgress) ? 'degraded' : 'error';
                }
            } else {
                resolvedProgress = optimisticProgress;
                nextProgressStatus = 'ready';
            }

            if (!isCurrentRequest()) {
                return;
            }

            setTerms(currentTerms);
            setUserProgress(resolvedProgress);
            setTermsError(nextTermsError);
            setProgressError(nextProgressError);
            setTermsStatus(nextTermsStatus);
            setProgressStatus(nextProgressStatus);
        } catch (error) {
            if (!isCurrentRequest()) {
                return;
            }
            const fallbackMessage = getErrorMessage(error, 'Failed to load study data.');
            logger.error('SRS_LOAD_UNEXPECTED_ERROR', {
                route: 'SRSProvider',
                userId,
                error: error instanceof Error ? error : undefined,
            });
            setTermsError(prev => prev ?? fallbackMessage);
            setProgressError(prev => prev ?? fallbackMessage);
            setTermsStatus(prev => (prev === 'ready' ? 'degraded' : 'error'));
            setProgressStatus(prev => (prev === 'ready' ? 'degraded' : 'error'));
        } finally {
            if (!isCurrentRequest()) {
                return;
            }
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

        const handleOnline = () => {
            if (!pendingReviewRef.current) {
                return;
            }

            pendingReviewReplayReadyRef.current = true;
            setPendingReviewVersion((value) => value + 1);
        };

        window.addEventListener('online', handleOnline);

        return () => {
            window.removeEventListener('online', handleOnline);
        };
    }, []);

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
        const optimisticFavorites = shouldFavorite
            ? [...currentFavorites, termId]
            : currentFavorites.filter((favoriteId) => favoriteId !== termId);

        const persistFavorites = (favorites: string[]) => {
            setUserProgress(prev => {
                const baseProgress = prev ?? getLocalUserProgress(userId);
                const reconciled = {
                    ...baseProgress,
                    favorites,
                    updated_at: new Date().toISOString(),
                };

                saveLocalUserProgress(reconciled, userId);
                return reconciled;
            });
        };

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
                persistFavorites(optimisticFavorites);

                try {
                    const response = await toggleFavoriteInSupabase(userId, termId, shouldFavorite);
                    if (response.status === 'auth_expired') {
                        return {
                            success: true,
                            limitReached: false,
                            isFavorite: shouldFavorite,
                            error: response.message,
                            authExpired: true,
                            syncDeferred: true,
                        };
                    }

                    if (response.status !== 'ok') {
                        if (response.status === 'retryable') {
                            return {
                                success: true,
                                limitReached: false,
                                isFavorite: shouldFavorite,
                                error: response.message,
                                syncDeferred: true,
                            };
                        }

                        persistFavorites(currentFavorites);
                        return {
                            success: false,
                            limitReached: false,
                            isFavorite: isCurrentlyFavorite,
                            error: response.message,
                        };
                    }

                    setUserProgress(prev => {
                        const baseProgress = prev ?? getLocalUserProgress(userId);
                        const reconciled = {
                            ...baseProgress,
                            favorites: response.data.favorites,
                            updated_at: new Date().toISOString(),
                        };

                        saveLocalUserProgress(reconciled, userId);
                        return reconciled;
                    });

                    return {
                        success: true,
                        limitReached: false,
                        isFavorite: response.data.isFavorite,
                    };
                } catch (error) {
                    logger.error('SRS_FAVORITE_SYNC_FAILED', {
                        route: 'SRSProvider',
                        userId,
                        termId,
                        error: error instanceof Error ? error : undefined,
                    });

                    return {
                        success: true,
                        limitReached: false,
                        isFavorite: shouldFavorite,
                        error: error instanceof Error ? error.message : 'Failed to update favorite.',
                        syncDeferred: true,
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
            const updated = toggleFavoriteInStorage(termId, userId);
            setUserProgress(updated);
            return {
                success: true,
                limitReached: false,
                isFavorite: updated.favorites.includes(termId),
            };
        } catch (error) {
            logger.error('SRS_FAVORITE_TOGGLE_FAILED', {
                route: 'SRSProvider',
                userId,
                termId,
                error: error instanceof Error ? error : undefined,
            });
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
        const idempotencyKey = getOrCreateReviewKey(reviewId);
        const normalizedResponseTimeMs = Math.max(0, Math.round(responseTimeMs));
        const attempt: QuizAttempt = {
            id: idempotencyKey,
            term_id: termId,
            is_correct: isCorrect,
            response_time_ms: normalizedResponseTimeMs,
            timestamp: new Date().toISOString(),
            quiz_type: 'daily',
        };

        if (!isAuthenticated || !userId) {
            const didApplyLocalReview = applyLocalReview(termId, isCorrect, attempt);
            if (!didApplyLocalReview) {
                clearPendingReview();
                clearReviewKey(reviewId);
                throw new Error('QUIZ_TERM_MISSING: Quiz term is unavailable. Refresh the study data and try again.');
            }
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
                attempt,
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
                responseTimeMs: normalizedResponseTimeMs,
                idempotencyKey,
            });
            const didApplyLocalReview = applyLocalReview(termId, isCorrect, attempt);
            if (!didApplyLocalReview) {
                throw new Error('QUIZ_TERM_MISSING: Quiz term is unavailable. Refresh the study data and try again.');
            }

            showToast(result.message, 'warning');
            return;
        }

        if (result.status === 'retryable') {
            persistPendingReview({
                reviewId,
                termId,
                isCorrect,
                responseTimeMs: normalizedResponseTimeMs,
                idempotencyKey,
            });
            const didApplyLocalReview = applyLocalReview(termId, isCorrect, attempt);
            if (!didApplyLocalReview) {
                throw new Error('QUIZ_TERM_MISSING: Quiz term is unavailable. Refresh the study data and try again.');
            }

            showToast(PENDING_REVIEW_SYNC_MESSAGE, 'warning');
            return;
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
        applyLocalReview,
        showToast,
        userId,
    ]);

    useEffect(() => {
        const pendingReview = pendingReviewRef.current;
        const shouldReplayAfterAuth = authTransitionReplayReadyRef.current;
        const shouldReplayRestoredReview = pendingReviewReplayReadyRef.current;
        if (
            !isAuthenticated
            || isLoading
            || !pendingReview
            || !userId
            || isReplayingPendingReviewRef.current
            || replayedPendingReviewIdRef.current === pendingReview.reviewId
            || (!shouldReplayAfterAuth && !shouldReplayRestoredReview)
        ) {
            return;
        }

        replayedPendingReviewIdRef.current = pendingReview.reviewId;
        authTransitionReplayReadyRef.current = false;
        pendingReviewReplayReadyRef.current = false;
        isReplayingPendingReviewRef.current = true;
        showToast(
            shouldReplayAfterAuth
                ? 'Session refreshed — saving your answer…'
                : 'Restoring your pending answer…',
            'info'
        );

        void submitQuizAnswer(
            pendingReview.termId,
            pendingReview.isCorrect,
            pendingReview.responseTimeMs,
            pendingReview.reviewId
        ).catch((error) => {
            logger.error('SRS_PENDING_REVIEW_REPLAY_FAILED', {
                route: 'SRSProvider',
                userId,
                error: error instanceof Error ? error : undefined,
            });
        }).finally(() => {
            isReplayingPendingReviewRef.current = false;
        });
    }, [isAuthenticated, isLoading, pendingReviewVersion, showToast, submitQuizAnswer, userId]);

    useEffect(() => {
        if (!previousAuthStateRef.current && isAuthenticated) {
            authTransitionReplayReadyRef.current = true;
            setPendingReviewVersion((value) => value + 1);
        }

        previousAuthStateRef.current = isAuthenticated;
    }, [isAuthenticated]);

    /**
     * Manually refresh all data from storage
     */
    const refreshData = useCallback(() => {
        void loadData();
    }, [loadData]);

    // Use default progress if not yet hydrated
    const safeProgress = userProgress ?? createSafeProgress(userId);

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
