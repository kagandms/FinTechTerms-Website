/**
 * @jest-environment jsdom
 */

import {
    readPendingReviewQueueSnapshotFromStorage,
} from '@/contexts/srs-context-helpers';

describe('pending review queue storage recovery', () => {
    const storageKey = 'pending_review_queue:user-1';

    beforeEach(() => {
        localStorage.clear();
        sessionStorage.clear();
    });

    it('preserves valid entries while dropping corrupted queue items', () => {
        localStorage.setItem(storageKey, JSON.stringify([
            {
                reviewId: 'review-1',
                termId: 'term-1',
                isCorrect: true,
                responseTimeMs: 0,
                idempotencyKey: 'review-key-1',
                quizType: 'review',
                occurredAt: '2026-03-11T08:00:00.000Z',
                sessionId: 'queued-session',
                sessionToken: 'q'.repeat(32),
                queuedAt: 1,
            },
            {
                reviewId: 'review-2',
                termId: 'term-2',
                isCorrect: 'broken',
            },
        ]));

        const restored = readPendingReviewQueueSnapshotFromStorage('user-1');

        expect(restored.invalidEntryCount).toBe(1);
        expect(restored.storageCorrupted).toBe(false);
        expect(restored.queue).toHaveLength(1);
        expect(restored.queue[0]).toMatchObject({
            reviewId: 'review-1',
            status: 'pending_retry',
        });
    });

    it('reports corrupted queue payloads instead of silently treating them as empty', () => {
        localStorage.setItem(storageKey, '{not-json');

        const restored = readPendingReviewQueueSnapshotFromStorage('user-1');

        expect(restored.invalidEntryCount).toBe(0);
        expect(restored.storageCorrupted).toBe(true);
        expect(restored.queue).toEqual([]);
        expect(localStorage.getItem(storageKey)).toBeNull();
    });
});
