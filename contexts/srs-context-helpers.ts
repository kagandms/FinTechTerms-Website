import type { QuizType, UserProgress } from '@/types';
import type { UserProgressLoadMissingSegment } from '@/lib/supabaseStorage';

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
}

export interface QueuedPendingReview extends PendingReview {
    queuedAt: number;
}

export const PENDING_REVIEW_QUEUE_STORAGE_PREFIX = 'pending_review_queue';
export const LEGACY_PENDING_REVIEW_STORAGE_KEY = 'fintechterms_pending_review';
export const MAX_PENDING_REVIEW_QUEUE_SIZE = 50;

const GUEST_PENDING_REVIEW_SCOPE = 'guest';
const DEFAULT_PENDING_REVIEW_QUIZ_TYPE: QuizType = 'daily';

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
        .sort((left, right) => left.queuedAt - right.queuedAt)
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

export const readPendingReviewQueueFromStorage = (
    userId?: string | null
): QueuedPendingReview[] => {
    if (!canUseStorage()) {
        return [];
    }

    const storageKey = buildPendingReviewQueueStorageKey(userId);

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
                return normalizedQueue;
            }
        }
    } catch {
        window.localStorage.removeItem(storageKey);
    }

    if (resolvePendingReviewScope(userId) === GUEST_PENDING_REVIEW_SCOPE) {
        return [];
    }

    try {
        const legacyEntry = window.sessionStorage.getItem(LEGACY_PENDING_REVIEW_STORAGE_KEY);
        if (!legacyEntry) {
            return [];
        }

        const parsedLegacyEntry = JSON.parse(legacyEntry) as unknown;
        if (!isPendingReview(parsedLegacyEntry)) {
            window.sessionStorage.removeItem(LEGACY_PENDING_REVIEW_STORAGE_KEY);
            return [];
        }

        const normalizedLegacyEntry = normalizePendingReview({
            ...parsedLegacyEntry,
            queuedAt: Date.now(),
        });
        if (!normalizedLegacyEntry) {
            window.sessionStorage.removeItem(LEGACY_PENDING_REVIEW_STORAGE_KEY);
            return [];
        }

        const migratedQueue = writePendingReviewQueueToStorage(userId, [normalizedLegacyEntry]);
        window.sessionStorage.removeItem(LEGACY_PENDING_REVIEW_STORAGE_KEY);
        return migratedQueue;
    } catch {
        window.sessionStorage.removeItem(LEGACY_PENDING_REVIEW_STORAGE_KEY);
        return [];
    }
};

export const upsertPendingReviewQueueEntry = (
    userId: string | null | undefined,
    pendingReview: PendingReview
): QueuedPendingReview[] => {
    const existingQueue = readPendingReviewQueueFromStorage(userId);
    const existingEntry = existingQueue.find((entry) => entry.reviewId === pendingReview.reviewId);

    return writePendingReviewQueueToStorage(userId, [
        ...existingQueue.filter((entry) => entry.reviewId !== pendingReview.reviewId),
        {
            ...pendingReview,
            queuedAt: existingEntry?.queuedAt ?? Date.now(),
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
