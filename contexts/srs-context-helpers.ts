import type { QuizType, UserProgress } from '@/types';
import type { UserProgressLoadMissingSegment } from '@/lib/supabaseStorage';

export type PendingReviewStatus = 'pending_retry' | 'action_required';

export interface PendingReview {
    reviewId: string;
    termId: string;
    isCorrect: boolean;
    responseTimeMs: number;
    idempotencyKey: string;
    quizType: QuizType;
    occurredAt: string;
    sessionId: string | null;
    sessionToken: string | null;
    status?: PendingReviewStatus;
    reason?: string | null;
    firstSeenAt?: number;
    lastTriedAt?: number | null;
}

export interface QueuedPendingReview extends PendingReview {
    status: PendingReviewStatus;
    reason: string | null;
    firstSeenAt: number;
    lastTriedAt: number | null;
    queuedAt: number;
}

export interface PendingReviewQueueSnapshot {
    queue: QueuedPendingReview[];
    invalidEntryCount: number;
    storageCorrupted: boolean;
}

export const PENDING_REVIEW_QUEUE_STORAGE_PREFIX = 'pending_review_queue';
export const LEGACY_PENDING_REVIEW_STORAGE_KEY = 'fintechterms_pending_review';
export const MAX_PENDING_REVIEW_QUEUE_SIZE = 50;

const GUEST_PENDING_REVIEW_SCOPE = 'guest';
const DEFAULT_PENDING_REVIEW_QUIZ_TYPE: QuizType = 'daily';
const DEFAULT_PENDING_REVIEW_STATUS: PendingReviewStatus = 'pending_retry';

const resolvePendingReviewScope = (userId?: string | null): string => (
    typeof userId === 'string' && userId.trim().length > 0
        ? userId.trim()
        : GUEST_PENDING_REVIEW_SCOPE
);

export const buildPendingReviewQueueStorageKey = (userId?: string | null): string => (
    `${PENDING_REVIEW_QUEUE_STORAGE_PREFIX}:${resolvePendingReviewScope(userId)}`
);

export const createSafeProgress = (userId?: string | null): UserProgress => ({
    user_id: userId && userId.trim().length > 0 ? userId : 'guest',
    favorites: [],
    current_language: 'ru',
    quiz_history: [],
    total_words_learned: 0,
    current_streak: 0,
    last_study_date: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
});

export const getErrorMessage = (error: unknown, fallbackMessage: string): string => {
    if (error instanceof Error && error.message.trim().length > 0) {
        return error.message;
    }

    return fallbackMessage;
};

export const hasCachedStudyData = (progress: UserProgress): boolean => (
    progress.favorites.length > 0
    || progress.quiz_history.length > 0
    || progress.total_words_learned > 0
    || progress.current_streak > 0
    || progress.last_study_date !== null
);

const isQuizType = (value: unknown): value is QuizType => (
    value === 'daily'
    || value === 'practice'
    || value === 'review'
    || value === 'simulation'
    || value === 'telegram_bot'
);

const isPendingReviewStatus = (value: unknown): value is PendingReviewStatus => (
    value === 'pending_retry' || value === 'action_required'
);

const normalizeSessionValue = (value: unknown): string | null => (
    typeof value === 'string' && value.trim().length > 0
        ? value.trim()
        : null
);

const normalizeOccurredAt = (
    value: unknown,
    queuedAt: number
): string => {
    if (typeof value === 'string' && !Number.isNaN(Date.parse(value))) {
        return new Date(value).toISOString();
    }

    return new Date(queuedAt).toISOString();
};

export const isPendingReview = (value: unknown): value is PendingReview => {
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
        && (
            candidate.quizType === undefined
            || isQuizType(candidate.quizType)
        )
        && (
            candidate.occurredAt === undefined
            || (
                typeof candidate.occurredAt === 'string'
                && !Number.isNaN(Date.parse(candidate.occurredAt))
            )
        )
        && (
            candidate.sessionId === undefined
            || candidate.sessionId === null
            || typeof candidate.sessionId === 'string'
        )
        && (
            candidate.sessionToken === undefined
            || candidate.sessionToken === null
            || typeof candidate.sessionToken === 'string'
        )
        && (
            candidate.status === undefined
            || isPendingReviewStatus(candidate.status)
        )
        && (
            candidate.reason === undefined
            || candidate.reason === null
            || typeof candidate.reason === 'string'
        )
        && (
            candidate.firstSeenAt === undefined
            || (
                typeof candidate.firstSeenAt === 'number'
                && Number.isFinite(candidate.firstSeenAt)
            )
        )
        && (
            candidate.lastTriedAt === undefined
            || candidate.lastTriedAt === null
            || (
                typeof candidate.lastTriedAt === 'number'
                && Number.isFinite(candidate.lastTriedAt)
            )
        )
    );
};

export const isQueuedPendingReview = (value: unknown): value is QueuedPendingReview => {
    if (!isPendingReview(value)) {
        return false;
    }

    return (
        'queuedAt' in value
        && typeof value.queuedAt === 'number'
        && Number.isFinite(value.queuedAt)
    );
};

const normalizePendingReview = (value: unknown): QueuedPendingReview | null => {
    if (!isQueuedPendingReview(value)) {
        return null;
    }

    return {
        reviewId: value.reviewId,
        termId: value.termId,
        isCorrect: value.isCorrect,
        responseTimeMs: value.responseTimeMs,
        idempotencyKey: value.idempotencyKey,
        quizType: isQuizType(value.quizType)
            ? value.quizType
            : DEFAULT_PENDING_REVIEW_QUIZ_TYPE,
        occurredAt: normalizeOccurredAt(value.occurredAt, value.queuedAt),
        sessionId: normalizeSessionValue(value.sessionId),
        sessionToken: normalizeSessionValue(value.sessionToken),
        status: isPendingReviewStatus(value.status)
            ? value.status
            : DEFAULT_PENDING_REVIEW_STATUS,
        reason: typeof value.reason === 'string' && value.reason.trim().length > 0
            ? value.reason.trim()
            : null,
        firstSeenAt: typeof value.firstSeenAt === 'number' && Number.isFinite(value.firstSeenAt)
            ? value.firstSeenAt
            : value.queuedAt,
        lastTriedAt: typeof value.lastTriedAt === 'number' && Number.isFinite(value.lastTriedAt)
            ? value.lastTriedAt
            : value.queuedAt,
        queuedAt: value.queuedAt,
    };
};

const normalizePendingReviewQueue = (
    queue: readonly QueuedPendingReview[]
): QueuedPendingReview[] => {
    const deduped = new Map<string, QueuedPendingReview>();

    for (const entry of queue) {
        deduped.set(entry.reviewId, entry);
    }

    return Array.from(deduped.values())
        .sort((left, right) => left.firstSeenAt - right.firstSeenAt)
        .slice(-MAX_PENDING_REVIEW_QUEUE_SIZE);
};

const canUseStorage = (): boolean => typeof window !== 'undefined';

const writePendingReviewQueueToStorage = (
    userId: string | null | undefined,
    queue: readonly QueuedPendingReview[]
): QueuedPendingReview[] => {
    if (!canUseStorage()) {
        return normalizePendingReviewQueue(queue);
    }

    const normalizedQueue = normalizePendingReviewQueue(queue);
    const storageKey = buildPendingReviewQueueStorageKey(userId);

    if (normalizedQueue.length === 0) {
        window.localStorage.removeItem(storageKey);
        return normalizedQueue;
    }

    window.localStorage.setItem(storageKey, JSON.stringify(normalizedQueue));
    return normalizedQueue;
};

export const hasPendingRetryEntries = (
    queue: readonly QueuedPendingReview[]
): boolean => queue.some((entry) => entry.status === 'pending_retry');

export const readPendingReviewQueueSnapshotFromStorage = (
    userId?: string | null
): PendingReviewQueueSnapshot => {
    if (!canUseStorage()) {
        return {
            queue: [],
            invalidEntryCount: 0,
            storageCorrupted: false,
        };
    }

    const storageKey = buildPendingReviewQueueStorageKey(userId);
    let invalidEntryCount = 0;

    try {
        const storedQueue = window.localStorage.getItem(storageKey);
        if (storedQueue) {
            const parsedQueue = JSON.parse(storedQueue) as unknown;
            if (Array.isArray(parsedQueue)) {
                let shouldRewrite = false;
                const normalizedEntries: QueuedPendingReview[] = [];

                for (const entry of parsedQueue) {
                    const normalizedEntry = normalizePendingReview(entry);
                    if (!normalizedEntry) {
                        shouldRewrite = true;
                        invalidEntryCount += 1;
                        continue;
                    }

                    normalizedEntries.push(normalizedEntry);
                    if (JSON.stringify(entry) !== JSON.stringify(normalizedEntry)) {
                        shouldRewrite = true;
                    }
                }

                const normalizedQueue = normalizePendingReviewQueue(normalizedEntries);
                if (normalizedQueue.length !== normalizedEntries.length) {
                    shouldRewrite = true;
                }

                if (shouldRewrite) {
                    writePendingReviewQueueToStorage(userId, normalizedQueue);
                }
                return {
                    queue: normalizedQueue,
                    invalidEntryCount,
                    storageCorrupted: false,
                };
            }

            window.localStorage.removeItem(storageKey);
            return {
                queue: [],
                invalidEntryCount: 0,
                storageCorrupted: true,
            };
        }
    } catch {
        window.localStorage.removeItem(storageKey);
        return {
            queue: [],
            invalidEntryCount: 0,
            storageCorrupted: true,
        };
    }

    if (resolvePendingReviewScope(userId) === GUEST_PENDING_REVIEW_SCOPE) {
        return {
            queue: [],
            invalidEntryCount: 0,
            storageCorrupted: false,
        };
    }

    try {
        const legacyEntry = window.sessionStorage.getItem(LEGACY_PENDING_REVIEW_STORAGE_KEY);
        if (!legacyEntry) {
            return {
                queue: [],
                invalidEntryCount: 0,
                storageCorrupted: false,
            };
        }

        const parsedLegacyEntry = JSON.parse(legacyEntry) as unknown;
        if (!isPendingReview(parsedLegacyEntry)) {
            window.sessionStorage.removeItem(LEGACY_PENDING_REVIEW_STORAGE_KEY);
            return {
                queue: [],
                invalidEntryCount: 1,
                storageCorrupted: true,
            };
        }

        const normalizedLegacyEntry = normalizePendingReview({
            ...parsedLegacyEntry,
            queuedAt: Date.now(),
        });
        if (!normalizedLegacyEntry) {
            window.sessionStorage.removeItem(LEGACY_PENDING_REVIEW_STORAGE_KEY);
            return {
                queue: [],
                invalidEntryCount: 1,
                storageCorrupted: true,
            };
        }

        const migratedQueue = writePendingReviewQueueToStorage(userId, [normalizedLegacyEntry]);
        window.sessionStorage.removeItem(LEGACY_PENDING_REVIEW_STORAGE_KEY);
        return {
            queue: migratedQueue,
            invalidEntryCount: 0,
            storageCorrupted: false,
        };
    } catch {
        window.sessionStorage.removeItem(LEGACY_PENDING_REVIEW_STORAGE_KEY);
        return {
            queue: [],
            invalidEntryCount: 0,
            storageCorrupted: true,
        };
    }
};

export const readPendingReviewQueueFromStorage = (
    userId?: string | null
): QueuedPendingReview[] => readPendingReviewQueueSnapshotFromStorage(userId).queue;

export const upsertPendingReviewQueueEntry = (
    userId: string | null | undefined,
    pendingReview: PendingReview
): QueuedPendingReview[] => {
    const existingQueue = readPendingReviewQueueFromStorage(userId);
    const existingEntry = existingQueue.find((entry) => entry.reviewId === pendingReview.reviewId);
    const now = Date.now();

    return writePendingReviewQueueToStorage(userId, [
        ...existingQueue.filter((entry) => entry.reviewId !== pendingReview.reviewId),
        {
            ...pendingReview,
            status: isPendingReviewStatus(pendingReview.status)
                ? pendingReview.status
                : existingEntry?.status ?? DEFAULT_PENDING_REVIEW_STATUS,
            reason: typeof pendingReview.reason === 'string' && pendingReview.reason.trim().length > 0
                ? pendingReview.reason.trim()
                : existingEntry?.reason ?? null,
            firstSeenAt: pendingReview.firstSeenAt ?? existingEntry?.firstSeenAt ?? now,
            lastTriedAt: pendingReview.lastTriedAt ?? now,
            queuedAt: existingEntry?.queuedAt ?? pendingReview.firstSeenAt ?? now,
        },
    ]);
};

export const removePendingReviewQueueEntry = (
    userId: string | null | undefined,
    reviewId: string
): QueuedPendingReview[] => writePendingReviewQueueToStorage(
    userId,
    readPendingReviewQueueFromStorage(userId).filter((entry) => entry.reviewId !== reviewId)
);

export const markPendingReviewActionRequired = (
    userId: string | null | undefined,
    reviewId: string,
    reason: string
): QueuedPendingReview[] => {
    const existingQueue = readPendingReviewQueueFromStorage(userId);
    const nextQueue = existingQueue.map((entry) => (
        entry.reviewId === reviewId
            ? {
                ...entry,
                status: 'action_required' as const,
                reason,
                lastTriedAt: Date.now(),
            }
            : entry
    ));

    return writePendingReviewQueueToStorage(userId, nextQueue);
};

export const markPendingReviewRetryPending = (
    userId: string | null | undefined,
    reviewId: string,
    reason: string
): QueuedPendingReview[] => {
    const existingQueue = readPendingReviewQueueFromStorage(userId);
    const nextQueue = existingQueue.map((entry) => (
        entry.reviewId === reviewId
            ? {
                ...entry,
                status: 'pending_retry' as const,
                reason,
                lastTriedAt: Date.now(),
            }
            : entry
    ));

    return writePendingReviewQueueToStorage(userId, nextQueue);
};

export const mergeUserProgressSnapshot = (
    localProgress: UserProgress,
    remoteProgress: UserProgress,
    missingSegments: readonly UserProgressLoadMissingSegment[]
): UserProgress => {
    const missing = new Set<UserProgressLoadMissingSegment>(missingSegments);

    return {
        ...remoteProgress,
        favorites: missing.has('favorites')
            ? localProgress.favorites
            : remoteProgress.favorites,
        current_language: missing.has('user_settings')
            ? localProgress.current_language
            : remoteProgress.current_language,
        quiz_history: missing.has('recent_quiz_history')
            ? localProgress.quiz_history
            : remoteProgress.quiz_history,
        total_words_learned: missing.has('user_progress')
            ? localProgress.total_words_learned
            : remoteProgress.total_words_learned,
        current_streak: missing.has('streak_summary')
            ? localProgress.current_streak
            : remoteProgress.current_streak,
        last_study_date: missing.has('streak_summary')
            ? localProgress.last_study_date
            : remoteProgress.last_study_date,
        created_at: missing.has('user_progress')
            ? localProgress.created_at
            : remoteProgress.created_at,
        updated_at: missing.has('user_progress')
            ? localProgress.updated_at
            : remoteProgress.updated_at,
    };
};
