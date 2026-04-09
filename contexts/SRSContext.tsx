'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';
import { Term, UserProgress, QuizAttempt, type QuizType } from '@/types';
import {
    type GuestQuizPreview,
    getTerms,
    saveTerms,
    updateTerm as updateTermInStorage,
    getUserProgress as getLocalUserProgress,
    toggleFavorite as toggleFavoriteInStorage,
    addQuizAttempt as addQuizAttemptToStorage,
    saveUserProgress as saveLocalUserProgress,
    getGuestQuizPreview,
    recordGuestQuizPreviewAttempt as recordGuestQuizPreviewAttemptInStorage,
    getMistakeReviewQueue,
    recordMistakeReviewMiss as recordMistakeReviewMissInStorage,
    removeMistakeReviewTerm as removeMistakeReviewTermInStorage,
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
import { readTrackedStudySessionContext, STUDY_SESSION_READY_EVENT } from '@/lib/study-session-storage';
import {
    createSafeProgress,
    getErrorMessage,
    hasCachedStudyData,
    hasPendingRetryEntries,
    markPendingReviewActionRequired,
    markPendingReviewRetryPending,
    readPendingReviewQueueSnapshotFromStorage,
    removePendingReviewQueueEntry,
    upsertPendingReviewQueueEntry,
    mergeUserProgressSnapshot,
    type PendingReview,
    type QueuedPendingReview,
} from '@/contexts/srs-context-helpers';

type AsyncDataStatus = 'loading' | 'ready' | 'degraded' | 'error';

interface FavoriteToggleResult {
    success: boolean;
    limitReached: boolean;
    isFavorite?: boolean;
    error?: string;
    authExpired?: boolean;
}

export interface ReviewSubmissionResult {
    persistence: 'persisted' | 'queued';
}

interface SRSContextType {
    terms: Term[];
    userProgress: UserProgress;
    dueTerms: Term[];
    quizPreview: GuestQuizPreview;
    mistakeReviewQueue: string[];
    toggleFavorite: (termId: string) => Promise<FavoriteToggleResult>;
    isFavorite: (termId: string) => boolean;
    isFavoriteUpdating: (termId: string) => boolean;
    submitQuizAnswer: (termId: string, isCorrect: boolean, responseTimeMs: number | undefined, reviewId: string, quizType?: QuizType) => Promise<ReviewSubmissionResult>;
    recordQuizPreviewAttempt: (isCorrect: boolean, responseTimeMs: number) => void;
    recordMistakeReviewMiss: (termId: string) => void;
    clearMistakeReviewTerm: (termId: string) => void;
    refreshData: () => void;
    canAddMoreFavorites: boolean;
    favoritesRemaining: number;
    isSyncing: boolean;
    isLoading: boolean;
    termsStatus: AsyncDataStatus;
    progressStatus: AsyncDataStatus;
    termsError: string | null;
    progressError: string | null;
    actionRequiredReviewCount: number;
    actionRequiredReviewMessage: string | null;
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
const PENDING_REVIEW_SYNC_MESSAGE = 'This answer was queued for sync on this device.';
const AUTH_EXPIRED_PENDING_REVIEW_MESSAGE = 'Session expired. This answer will retry after you sign in again.';
const PENDING_REVIEW_CORRUPTION_WARNING = 'Some queued answers could not be restored on this device because stored data was corrupted.';
const PENDING_REVIEW_PARTIAL_RESTORE_WARNING = 'Some queued answers were restored, but corrupted entries were dropped.';
const PENDING_REVIEW_ACTION_REQUIRED_MESSAGE = 'A queued answer now needs manual attention before it can be synced.';

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

const buildFavoriteFailureResult = (
    isFavorite: boolean,
    error: string,
    options: {
        authExpired?: boolean;
        limitReached?: boolean;
    } = {}
): FavoriteToggleResult => ({
    success: false,
    limitReached: options.limitReached ?? false,
    isFavorite,
    error,
    authExpired: options.authExpired,
});

const resolveOptimisticFavorites = (
    favorites: readonly string[],
    optimisticState: Readonly<Record<string, boolean>>
): string[] => {
    const nextFavorites = new Set(favorites);

    Object.entries(optimisticState).forEach(([termId, shouldFavorite]) => {
        if (shouldFavorite) {
            nextFavorites.add(termId);
            return;
        }

        nextFavorites.delete(termId);
    });

    return Array.from(nextFavorites);
};

export function SRSProvider({ children }: SRSProviderProps) {
    const { entitlements, favoriteLimit, isAuthenticated, user, isLoading: isAuthLoading } = useAuth();
    const { showToast } = useToast();
    const userId = user?.id ?? null;
    const [terms, setTerms] = useState<Term[]>(() => getTerms(userId));
    const [userProgress, setUserProgress] = useState<UserProgress | null>(() => getLocalUserProgress(userId));
    const [quizPreview, setQuizPreview] = useState<GuestQuizPreview>(() => getGuestQuizPreview());
    const [mistakeReviewQueue, setMistakeReviewQueue] = useState<string[]>(() => getMistakeReviewQueue(userId));
    const [isSyncing, setIsSyncing] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [termsStatus, setTermsStatus] = useState<AsyncDataStatus>(() => (getTerms(userId).length > 0 ? 'ready' : 'loading'));
    const [progressStatus, setProgressStatus] = useState<AsyncDataStatus>(() => (isAuthenticated ? 'loading' : 'ready'));
    const [termsError, setTermsError] = useState<string | null>(null);
    const [progressError, setProgressError] = useState<string | null>(null);
    const [favoriteOptimisticState, setFavoriteOptimisticState] = useState<Record<string, boolean>>({});
    const [favoritePendingState, setFavoritePendingState] = useState<Record<string, boolean>>({});
    const [pendingReviewQueueVersion, setPendingReviewQueueVersion] = useState(0);
    const reviewIdempotencyKeysRef = useRef<Record<string, string>>({});
    const pendingReviewQueueRef = useRef<QueuedPendingReview[]>([]);
    const isReplayingPendingReviewQueueRef = useRef(false);
    const authTransitionReplayReadyRef = useRef(false);
    const pendingReviewReplayReadyRef = useRef(false);
    const favoriteOperationCounterRef = useRef(0);
    const favoriteLatestOperationRef = useRef<Record<string, number>>({});
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

    const syncPendingReviewQueue = useCallback((queue: QueuedPendingReview[]) => {
        pendingReviewQueueRef.current = queue;
        queue.forEach((entry) => {
            reviewIdempotencyKeysRef.current[entry.reviewId] = entry.idempotencyKey;
        });
        setPendingReviewQueueVersion((value) => value + 1);
    }, []);

    const persistPendingReview = useCallback((pendingReview: PendingReview) => {
        const nextQueue = upsertPendingReviewQueueEntry(userId, pendingReview);
        syncPendingReviewQueue(nextQueue);
        pendingReviewReplayReadyRef.current = false;
    }, [syncPendingReviewQueue, userId]);

    const removePendingReview = useCallback((reviewId: string) => {
        const nextQueue = removePendingReviewQueueEntry(userId, reviewId);
        clearReviewKey(reviewId);
        syncPendingReviewQueue(nextQueue);
        if (!hasPendingRetryEntries(nextQueue)) {
            pendingReviewReplayReadyRef.current = false;
        }
    }, [clearReviewKey, syncPendingReviewQueue, userId]);

    const restorePendingReviewQueue = useCallback(() => {
        const restoredSnapshot = readPendingReviewQueueSnapshotFromStorage(userId);
        syncPendingReviewQueue(restoredSnapshot.queue);
        pendingReviewReplayReadyRef.current = hasPendingRetryEntries(restoredSnapshot.queue);

        if (restoredSnapshot.storageCorrupted) {
            showToast(PENDING_REVIEW_CORRUPTION_WARNING, 'warning');
            return;
        }

        if (restoredSnapshot.invalidEntryCount > 0) {
            showToast(PENDING_REVIEW_PARTIAL_RESTORE_WARNING, 'warning');
        }
    }, [showToast, syncPendingReviewQueue, userId]);

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

            saveTerms(reconciledTerms, userId);
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
        updateTermInStorage(updatedTerm, userId);
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

    const recordQuizPreviewAttempt = useCallback((isCorrect: boolean, responseTimeMs: number) => {
        setQuizPreview(recordGuestQuizPreviewAttemptInStorage(isCorrect, responseTimeMs));
    }, []);

    const recordMistakeReviewMiss = useCallback((termId: string) => {
        setMistakeReviewQueue(recordMistakeReviewMissInStorage(termId, userId));
    }, [userId]);

    const clearMistakeReviewTerm = useCallback((termId: string) => {
        setMistakeReviewQueue(removeMistakeReviewTermInStorage(termId, userId));
    }, [userId]);

    const applySyncedReview = useCallback((message: SrsSyncMessage) => {
        const { attempt, termId, termSrs, userProgress: syncedProgress } = message;
        const { term_id: _termId, ...serverTermSrs } = termSrs;

        setTerms(prev => {
            const reconciledTerms = prev.map(existingTerm => (
                existingTerm.id === termId
                    ? { ...existingTerm, ...serverTermSrs }
                    : existingTerm
            ));

            saveTerms(reconciledTerms, userId);
            return reconciledTerms;
        });

        setUserProgress(prev => {
            if (!prev) {
                return prev;
            }

            const nextQuizHistory = prev.quiz_history.some((existingAttempt) => existingAttempt.id === attempt.id)
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
            let currentTerms = getTerms(userId);

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
                saveTerms(currentTerms, userId);
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
        favoriteLatestOperationRef.current = {};
    }, [isAuthenticated, userId]);

    useEffect(() => {
        const localTerms = getTerms(userId);
        const localProgress = getLocalUserProgress(userId);

        setTerms(localTerms);
        setUserProgress(localProgress);

        if (localTerms.length > 0) {
            setTermsStatus('ready');
        }

        if (!isAuthenticated) {
            setProgressStatus('ready');
        }
    }, [isAuthenticated, userId]);

    useEffect(() => {
        setMistakeReviewQueue(getMistakeReviewQueue(userId));
    }, [userId]);

    useEffect(() => {
        if (isAuthLoading) {
            return;
        }

        restorePendingReviewQueue();
    }, [isAuthLoading, restorePendingReviewQueue]);

    useEffect(() => {
        if (typeof window === 'undefined') {
            return undefined;
        }

        const handleOnline = () => {
            if (!hasPendingRetryEntries(pendingReviewQueueRef.current)) {
                return;
            }

            pendingReviewReplayReadyRef.current = true;
            setPendingReviewQueueVersion((value) => value + 1);
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

        const handleStudySessionReady = () => {
            if (!hasPendingRetryEntries(pendingReviewQueueRef.current)) {
                return;
            }

            pendingReviewReplayReadyRef.current = true;
            setPendingReviewQueueVersion((value) => value + 1);
        };

        window.addEventListener(STUDY_SESSION_READY_EVENT, handleStudySessionReady);

        return () => {
            window.removeEventListener(STUDY_SESSION_READY_EVENT, handleStudySessionReady);
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

    const replayPendingReviewQueue = useCallback(async (reason: 'auth' | 'restore') => {
        if (!isAuthenticated || !userId) {
            return;
        }

        let hasShownReplayMessage = false;

        while (pendingReviewQueueRef.current.length > 0) {
            const nextPendingReview = pendingReviewQueueRef.current.find((entry) => entry.status === 'pending_retry');
            if (!nextPendingReview) {
                return;
            }

            if (!hasShownReplayMessage) {
                showToast(
                    reason === 'auth'
                        ? 'Session refreshed — saving your queued answers…'
                        : 'Restoring your pending answers…',
                    'info'
                );
                hasShownReplayMessage = true;
            }

            const attempt: QuizAttempt = {
                id: nextPendingReview.idempotencyKey,
                term_id: nextPendingReview.termId,
                is_correct: nextPendingReview.isCorrect,
                response_time_ms: nextPendingReview.responseTimeMs,
                timestamp: nextPendingReview.occurredAt,
                quiz_type: nextPendingReview.quizType,
            };

            const result = await saveQuizAttemptToSupabase(userId, {
                ...attempt,
                sessionId: nextPendingReview.sessionId,
                sessionToken: nextPendingReview.sessionToken,
            });

            if (result.status === 'ok') {
                applyCommittedReview(nextPendingReview.termId, attempt, result.data);
                broadcastCommittedReview({
                    type: 'REVIEW_COMMITTED',
                    reviewId: nextPendingReview.reviewId,
                    termId: nextPendingReview.termId,
                    attempt,
                    termSrs: result.data.termSrs,
                    userProgress: result.data.userProgress,
                });
                removePendingReview(nextPendingReview.reviewId);
                continue;
            }

            if (result.status === 'non_retryable') {
                const nextQueue = markPendingReviewActionRequired(
                    userId,
                    nextPendingReview.reviewId,
                    result.message
                );
                syncPendingReviewQueue(nextQueue);
                showToast(PENDING_REVIEW_ACTION_REQUIRED_MESSAGE, 'warning');
                continue;
            }

            const nextQueue = markPendingReviewRetryPending(
                userId,
                nextPendingReview.reviewId,
                result.message
            );
            syncPendingReviewQueue(nextQueue);

            showToast(
                result.status === 'auth_expired'
                    ? AUTH_EXPIRED_PENDING_REVIEW_MESSAGE
                    : result.message,
                'warning'
            );
            return;
        }
    }, [
        applyCommittedReview,
        broadcastCommittedReview,
        isAuthenticated,
        syncPendingReviewQueue,
        removePendingReview,
        showToast,
        userId,
    ]);

    const safeProgress = userProgress ?? createSafeProgress(userId);
    const optimisticFavorites = React.useMemo(
        () => resolveOptimisticFavorites(safeProgress.favorites, favoriteOptimisticState),
        [favoriteOptimisticState, safeProgress.favorites]
    );
    const resolvedUserProgress = React.useMemo<UserProgress>(() => ({
        ...safeProgress,
        favorites: optimisticFavorites,
    }), [optimisticFavorites, safeProgress]);
    const actionRequiredReviews = pendingReviewQueueRef.current
        .filter((entry) => entry.status === 'action_required');
    const actionRequiredReviewCount = actionRequiredReviews.length;
    const actionRequiredReviewMessage = actionRequiredReviews[0]?.reason ?? null;

    // Calculate due terms
    const dueTerms = entitlements.canUseReviewMode
        ? getTermsDueForReview(terms, resolvedUserProgress.favorites)
        : [];

    // Calculate stats
    const stats = calculateProgressStats(terms, resolvedUserProgress.favorites);

    // Check if user can add more favorites
    const hasFiniteFavoriteLimit = Number.isFinite(favoriteLimit);
    const favoriteCount = resolvedUserProgress.favorites.length;
    const canAddMoreFavorites = !hasFiniteFavoriteLimit || favoriteCount < favoriteLimit;
    const favoritesRemaining = hasFiniteFavoriteLimit
        ? Math.max(0, favoriteLimit - favoriteCount)
        : Infinity;

    /**
     * Toggle a term's favorite status with limit check
     */
    const toggleFavorite = useCallback(async (termId: string): Promise<FavoriteToggleResult> => {
        const currentFavorites = resolvedUserProgress.favorites;
        const isCurrentlyFavorite = currentFavorites.includes(termId);
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

            // If trying to add and the entitlement limit is exhausted.
            if (!isCurrentlyFavorite && hasFiniteFavoriteLimit && currentFavorites.length >= favoriteLimit) {
                return {
                    success: false,
                    limitReached: true,
                    isFavorite: isCurrentlyFavorite,
                };
            }

            if (isAuthenticated && userId) {
                const operationId = favoriteOperationCounterRef.current + 1;
                favoriteOperationCounterRef.current = operationId;
                favoriteLatestOperationRef.current[termId] = operationId;
                setFavoritePendingState(prev => ({ ...prev, [termId]: true }));
                setFavoriteOptimisticState(prev => ({ ...prev, [termId]: shouldFavorite }));

                try {
                    const response = await toggleFavoriteInSupabase(userId, termId, shouldFavorite);
                    const isLatestOperation = favoriteLatestOperationRef.current[termId] === operationId;
                    if (!isLatestOperation) {
                        return buildFavoriteFailureResult(
                            resolveOptimisticFavorites(
                                userProgress?.favorites ?? [],
                                favoriteOptimisticState
                            ).includes(termId),
                            'A newer favorite change superseded this result.'
                        );
                    }

                    if (response.status === 'auth_expired') {
                        return buildFavoriteFailureResult(
                            isCurrentlyFavorite,
                            response.message,
                            { authExpired: true }
                        );
                    }

                    if (response.status === 'limit_reached') {
                        return buildFavoriteFailureResult(
                            isCurrentlyFavorite,
                            response.message,
                            { limitReached: true }
                        );
                    }

                    if (response.status !== 'ok') {
                        return buildFavoriteFailureResult(isCurrentlyFavorite, response.message);
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

                    return buildFavoriteFailureResult(
                        isCurrentlyFavorite,
                        error instanceof Error ? error.message : 'Failed to update favorite.'
                    );
                } finally {
                    if (favoriteLatestOperationRef.current[termId] === operationId) {
                        delete favoriteLatestOperationRef.current[termId];
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
    }, [
        favoriteLimit,
        favoriteOptimisticState,
        favoritePendingState,
        hasFiniteFavoriteLimit,
        isAuthLoading,
        isAuthenticated,
        resolvedUserProgress.favorites,
        userId,
        userProgress?.favorites,
    ]);

    /**
     * Check if a term is favorited
     */
    const isFavorite = useCallback((termId: string): boolean => {
        if (Object.prototype.hasOwnProperty.call(favoriteOptimisticState, termId)) {
            return favoriteOptimisticState[termId] ?? false;
        }

        return resolvedUserProgress.favorites.includes(termId);
    }, [favoriteOptimisticState, resolvedUserProgress.favorites]);

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
        reviewId: string,
        quizType: QuizType = 'daily',
    ): Promise<ReviewSubmissionResult> => {
        if (!entitlements.canUseReviewMode) {
            removePendingReview(reviewId);
            clearReviewKey(reviewId);
            throw new Error('Review mode is unavailable until your member account is fully unlocked.');
        }

        const idempotencyKey = getOrCreateReviewKey(reviewId);
        const normalizedResponseTimeMs = Math.max(0, Math.round(responseTimeMs));
        const occurredAt = new Date().toISOString();
        const sessionContext = readTrackedStudySessionContext();
        const attempt: QuizAttempt = {
            id: idempotencyKey,
            term_id: termId,
            is_correct: isCorrect,
            response_time_ms: normalizedResponseTimeMs,
            timestamp: occurredAt,
            quiz_type: quizType,
        };

        if (!isAuthenticated || !userId) {
            const didApplyLocalReview = applyLocalReview(termId, isCorrect, attempt);
            if (!didApplyLocalReview) {
                removePendingReview(reviewId);
                clearReviewKey(reviewId);
                throw new Error('QUIZ_TERM_MISSING: Quiz term is unavailable. Refresh the study data and try again.');
            }
            clearReviewKey(reviewId);
            removePendingReview(reviewId);
            return { persistence: 'persisted' };
        }

        const result = await saveQuizAttemptToSupabase(userId, {
            ...attempt,
            sessionId: sessionContext?.sessionId ?? null,
            sessionToken: sessionContext?.sessionToken ?? null,
        });

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
            removePendingReview(reviewId);
            clearReviewKey(reviewId);
            return { persistence: 'persisted' };
        }

        if (result.status === 'auth_expired') {
            persistPendingReview({
                reviewId,
                termId,
                isCorrect,
                responseTimeMs: normalizedResponseTimeMs,
                idempotencyKey,
                quizType,
                occurredAt,
                sessionId: sessionContext?.sessionId ?? null,
                sessionToken: sessionContext?.sessionToken ?? null,
            });
            showToast(AUTH_EXPIRED_PENDING_REVIEW_MESSAGE, 'warning');
            return { persistence: 'queued' };
        }

        if (result.status === 'retryable') {
            persistPendingReview({
                reviewId,
                termId,
                isCorrect,
                responseTimeMs: normalizedResponseTimeMs,
                idempotencyKey,
                quizType,
                occurredAt,
                sessionId: sessionContext?.sessionId ?? null,
                sessionToken: sessionContext?.sessionToken ?? null,
            });
            showToast(PENDING_REVIEW_SYNC_MESSAGE, 'warning');
            return { persistence: 'queued' };
        }

        removePendingReview(reviewId);
        clearReviewKey(reviewId);
        showToast('Progress could not be saved. Please try again.', 'error');
        throw new Error(result.message);
    }, [
        applyCommittedReview,
        broadcastCommittedReview,
        clearReviewKey,
        entitlements.canUseReviewMode,
        getOrCreateReviewKey,
        isAuthenticated,
        persistPendingReview,
        applyLocalReview,
        removePendingReview,
        showToast,
        userId,
    ]);

    useEffect(() => {
        const shouldReplayAfterAuth = authTransitionReplayReadyRef.current;
        const shouldReplayRestoredQueue = pendingReviewReplayReadyRef.current;
        if (
            !isAuthenticated
            || isLoading
            || pendingReviewQueueRef.current.length === 0
            || !userId
            || isReplayingPendingReviewQueueRef.current
            || (!shouldReplayAfterAuth && !shouldReplayRestoredQueue)
        ) {
            return;
        }

        authTransitionReplayReadyRef.current = false;
        pendingReviewReplayReadyRef.current = false;
        isReplayingPendingReviewQueueRef.current = true;

        void replayPendingReviewQueue(
            shouldReplayAfterAuth ? 'auth' : 'restore'
        ).catch((error) => {
            logger.error('SRS_PENDING_REVIEW_REPLAY_FAILED', {
                route: 'SRSProvider',
                userId,
                error: error instanceof Error ? error : undefined,
            });
        }).finally(() => {
            isReplayingPendingReviewQueueRef.current = false;
        });
    }, [isAuthenticated, isLoading, pendingReviewQueueVersion, replayPendingReviewQueue, userId]);

    useEffect(() => {
        if (!previousAuthStateRef.current && isAuthenticated) {
            authTransitionReplayReadyRef.current = true;
            setPendingReviewQueueVersion((value) => value + 1);
        }

        previousAuthStateRef.current = isAuthenticated;
    }, [isAuthenticated]);

    /**
     * Manually refresh all data from storage
     */
    const refreshData = useCallback(() => {
        void loadData();
    }, [loadData]);

    return (
        <SRSContext.Provider
            value={{
                terms,
                userProgress: resolvedUserProgress,
                dueTerms,
                quizPreview,
                mistakeReviewQueue,
                toggleFavorite,
                isFavorite,
                isFavoriteUpdating,
                submitQuizAnswer,
                recordQuizPreviewAttempt,
                recordMistakeReviewMiss,
                clearMistakeReviewTerm,
                refreshData,
                canAddMoreFavorites,
                favoritesRemaining,
                isSyncing,
                isLoading,
                termsStatus,
                progressStatus,
                termsError,
                progressError,
                actionRequiredReviewCount,
                actionRequiredReviewMessage,
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
