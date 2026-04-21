/**
 * @jest-environment jsdom
 */

import React from 'react';
import { act, render, waitFor } from '@testing-library/react';

import SessionTracker, { incrementQuizAttempt } from '@/components/SessionTracker';
import { CONSENT_GRANTED_EVENT } from '@/components/ConsentModal';

const mockUseAuth = jest.fn();
const mockUsePathname = jest.fn();
const mockLoggerWarn = jest.fn();

jest.mock('@/contexts/AuthContext', () => ({
    useAuth: () => mockUseAuth(),
}));

jest.mock('@/lib/logger', () => ({
    logger: {
        warn: (...args: unknown[]) => mockLoggerWarn(...args),
        error: jest.fn(),
        info: jest.fn(),
        debug: jest.fn(),
    },
}));

jest.mock('next/navigation', () => ({
    usePathname: () => mockUsePathname(),
}));

const SESSION_KEY = 'fintechterms_session';
const SESSION_TAB_ID_KEY = 'fintechterms_session_tab_id';
const PENDING_START_SESSION_KEY = 'fintechterms_pending_start_session';
const CONSENT_KEY = 'fintechterms_research_consent';
const PENDING_END_SESSION_KEY = 'fintechterms_pending_end_session';
const RETRY_QUEUE_SESSION_KEY = 'fintechterms_session_retry_queue';

const createFetchResponse = (body: Record<string, unknown>) => ({
    ok: true,
    status: 200,
    json: jest.fn().mockResolvedValue(body),
}) as unknown as Response;

const grantConsent = () => {
    localStorage.setItem(CONSENT_KEY, JSON.stringify({
        given: true,
        timestamp: new Date().toISOString(),
        version: '1.0',
    }));
};

const getCurrentTabId = (): string | null => sessionStorage.getItem(SESSION_TAB_ID_KEY);
const getCurrentSessionKey = (): string | null => {
    const tabId = getCurrentTabId();
    return tabId ? `${SESSION_KEY}:${tabId}` : null;
};
const getCurrentPendingEndKey = (): string | null => {
    const tabId = getCurrentTabId();
    return tabId ? `${PENDING_END_SESSION_KEY}:${tabId}` : null;
};
const getCurrentPendingStartKey = (): string | null => {
    const tabId = getCurrentTabId();
    return tabId ? `${PENDING_START_SESSION_KEY}:${tabId}` : null;
};
const getCurrentRetryQueueKey = (): string | null => {
    const tabId = getCurrentTabId();
    return tabId ? `${RETRY_QUEUE_SESSION_KEY}:${tabId}` : null;
};

const createQueuedHeartbeat = (
    idempotencyKey: string,
    queuedAt: number
) => ({
    payload: {
        action: 'heartbeat' as const,
        sessionId: 'session_1',
        sessionToken: 'token_1',
        durationSeconds: 30,
        pageViews: 2,
        quizAttempts: 1,
    },
    sessionStartTime: Date.now() - 30000,
    idempotencyKey,
    queuedAt,
});

const readStoredSession = () => {
    const storageKey = getCurrentSessionKey();
    return JSON.parse(storageKey ? sessionStorage.getItem(storageKey) || 'null' : 'null') as {
        id: string | null;
        token: string | null;
        pageViews: number;
        quizAttempts: number;
        anonymousId: string | null;
    };
};

const createDeferred = <T,>() => {
    let resolve!: (value: T | PromiseLike<T>) => void;
    let reject!: (reason?: unknown) => void;
    const promise = new Promise<T>((nextResolve, nextReject) => {
        resolve = nextResolve;
        reject = nextReject;
    });

    return { promise, resolve, reject };
};

describe('SessionTracker', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        localStorage.clear();
        sessionStorage.clear();
        mockUseAuth.mockReturnValue({ isAuthenticated: false });
        mockUsePathname.mockReturnValue('/search');
        global.fetch = jest.fn().mockResolvedValue(createFetchResponse({
            sessionId: 'session_1',
            sessionToken: 'token_1',
        }));
    });

    afterEach(() => {
        jest.useRealTimers();
        Object.defineProperty(navigator, 'sendBeacon', {
            configurable: true,
            value: undefined,
        });
    });

    it('starts tracking immediately when consent is granted in the same tab', async () => {
        render(<SessionTracker />);

        expect(readStoredSession()).toBeNull();

        grantConsent();
        window.dispatchEvent(new CustomEvent(CONSENT_GRANTED_EVENT));

        await waitFor(() => {
            expect(readStoredSession().pageViews).toBe(1);
        });
    });

    it('logs a warning when persisting session state to sessionStorage fails', async () => {
        grantConsent();
        sessionStorage.setItem(SESSION_TAB_ID_KEY, 'tab_test');
        const originalSetItem = Storage.prototype.setItem;
        const setItemSpy = jest.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, key, value) {
            if (this === sessionStorage && key === `${SESSION_KEY}:tab_test`) {
                throw new Error('quota exceeded');
            }

            return originalSetItem.call(this, key, value);
        });

        render(<SessionTracker />);

        await waitFor(() => {
            expect(mockLoggerWarn).toHaveBeenCalledWith(
                'SESSION_TRACKER_SESSION_STORAGE_WRITE_FAILED',
                expect.objectContaining({
                    route: 'SessionTracker',
                })
            );
        });

        setItemSpy.mockRestore();
    });

    it('counts the initial page once and increments once per route change', async () => {
        grantConsent();
        const { rerender } = render(<SessionTracker />);

        await waitFor(() => {
            expect(readStoredSession().pageViews).toBe(1);
        });

        mockUsePathname.mockReturnValue('/quiz');
        rerender(<SessionTracker />);

        await waitFor(() => {
            expect(readStoredSession().pageViews).toBe(2);
        });
    });

    it('finalizes the anonymous session and starts a new authenticated session with previous_session_id', async () => {
        grantConsent();
        const fetchMock = jest.fn()
            .mockResolvedValueOnce(createFetchResponse({
                sessionId: 'anonymous_session',
                sessionToken: 'anonymous_token',
            }))
            .mockResolvedValueOnce(createFetchResponse({ success: true }))
            .mockResolvedValueOnce(createFetchResponse({
                sessionId: 'authenticated_session',
                sessionToken: 'authenticated_token',
            }))
            .mockResolvedValue(createFetchResponse({ success: true }));
        global.fetch = fetchMock as typeof fetch;

        const { rerender } = render(<SessionTracker />);

        await waitFor(() => {
            expect(fetchMock).toHaveBeenCalledTimes(1);
        });

        mockUseAuth.mockReturnValue({ isAuthenticated: true });
        rerender(<SessionTracker />);

        await waitFor(() => {
            expect(fetchMock).toHaveBeenCalledTimes(3);
        });

        const endPayload = JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body));
        const authenticatedStartPayload = JSON.parse(String(fetchMock.mock.calls[2]?.[1]?.body));

        expect(endPayload.action).toBe('end');
        expect(endPayload.sessionToken).toBe('anonymous_token');
        expect(authenticatedStartPayload.action).toBe('start');
        expect(authenticatedStartPayload.previous_session_id).toBe('anonymous_session');
        expect(authenticatedStartPayload.previous_session_token).toBe('anonymous_token');
        expect(authenticatedStartPayload.anonymousId).toBeNull();
    });

    it('flushes retryable session mutations immediately while the browser is still online', async () => {
        jest.useFakeTimers();
        grantConsent();

        const fetchMock = jest.fn()
            .mockResolvedValueOnce(createFetchResponse({
                sessionId: 'session_1',
                sessionToken: 'token_1',
            }))
            .mockRejectedValueOnce(new TypeError('network unavailable'))
            .mockResolvedValueOnce(createFetchResponse({ success: true }));
        global.fetch = fetchMock as typeof fetch;

        render(<SessionTracker />);

        await waitFor(() => {
            expect(fetchMock).toHaveBeenCalledTimes(1);
        });

        await act(async () => {
            jest.advanceTimersByTime(30000);
        });

        await waitFor(() => {
            expect(fetchMock).toHaveBeenCalledTimes(3);
        });

        const failedHeartbeatPayload = JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body));
        const retriedHeartbeatPayload = JSON.parse(String(fetchMock.mock.calls[2]?.[1]?.body));
        expect(failedHeartbeatPayload.action).toBe('heartbeat');
        expect(retriedHeartbeatPayload.action).toBe('heartbeat');
        expect(retriedHeartbeatPayload.idempotency_key).toBe(failedHeartbeatPayload.idempotency_key);
        expect(getCurrentRetryQueueKey() ? sessionStorage.getItem(getCurrentRetryQueueKey()!) : null).toBeNull();
    });

    it('keeps queued retry entries persisted while an online flush is still in flight', async () => {
        grantConsent();
        sessionStorage.setItem(SESSION_TAB_ID_KEY, 'tab_test');
        sessionStorage.setItem(`${RETRY_QUEUE_SESSION_KEY}:tab_test`, JSON.stringify([
            createQueuedHeartbeat('retry-heartbeat', Date.now()),
        ]));

        const deferredFlush = createDeferred<Response>();
        const fetchMock = jest.fn()
            .mockResolvedValueOnce(createFetchResponse({
                sessionId: 'session_1',
                sessionToken: 'token_1',
            }))
            .mockImplementationOnce(() => deferredFlush.promise);
        global.fetch = fetchMock as typeof fetch;

        render(<SessionTracker />);

        await waitFor(() => {
            expect(fetchMock).toHaveBeenCalledTimes(2);
        });

        expect(JSON.parse(sessionStorage.getItem(`${RETRY_QUEUE_SESSION_KEY}:tab_test`) || '[]')).toEqual([
            expect.objectContaining({
                idempotencyKey: 'retry-heartbeat',
            }),
        ]);

        deferredFlush.resolve(createFetchResponse({ success: true }));

        await waitFor(() => {
            expect(sessionStorage.getItem(`${RETRY_QUEUE_SESSION_KEY}:tab_test`)).toBeNull();
        });
    });

    it('clears local session state when the start request returns a non-retryable failure', async () => {
        grantConsent();
        const fetchMock = jest.fn().mockResolvedValue({
            ok: false,
            status: 401,
            json: jest.fn().mockResolvedValue({
                retryable: false,
                message: 'Authentication required',
            }),
        });
        global.fetch = fetchMock as typeof fetch;

        render(<SessionTracker />);

        await waitFor(() => {
            expect(fetchMock).toHaveBeenCalledTimes(1);
        });

        await waitFor(() => {
            expect(readStoredSession()).toBeNull();
        });

        const pendingStartKey = getCurrentPendingStartKey();
        expect(pendingStartKey ? localStorage.getItem(pendingStartKey) : null).toBeNull();
        expect(pendingStartKey ? sessionStorage.getItem(pendingStartKey) : null).toBeNull();
    });

    it('removes only acknowledged retry entries during a partial flush', async () => {
        grantConsent();
        sessionStorage.setItem(SESSION_TAB_ID_KEY, 'tab_test');
        sessionStorage.setItem(`${RETRY_QUEUE_SESSION_KEY}:tab_test`, JSON.stringify([
            createQueuedHeartbeat('retry-heartbeat-1', Date.now() - 1000),
            createQueuedHeartbeat('retry-heartbeat-2', Date.now()),
        ]));

        const deferredFlush = createDeferred<Response>();
        const fetchMock = jest.fn()
            .mockResolvedValueOnce(createFetchResponse({
                sessionId: 'session_1',
                sessionToken: 'token_1',
            }))
            .mockResolvedValueOnce(createFetchResponse({ success: true }))
            .mockImplementationOnce(() => deferredFlush.promise);
        global.fetch = fetchMock as typeof fetch;

        render(<SessionTracker />);

        await waitFor(() => {
            expect(fetchMock).toHaveBeenCalledTimes(3);
        });

        expect(JSON.parse(sessionStorage.getItem(`${RETRY_QUEUE_SESSION_KEY}:tab_test`) || '[]')).toEqual([
            expect.objectContaining({
                idempotencyKey: 'retry-heartbeat-2',
            }),
        ]);

        deferredFlush.resolve(createFetchResponse({ success: true }));

        await waitFor(() => {
            expect(sessionStorage.getItem(`${RETRY_QUEUE_SESSION_KEY}:tab_test`)).toBeNull();
        });
    });

    it('replays a pending end-session from the current tab storage before starting a new session', async () => {
        grantConsent();
        sessionStorage.setItem(SESSION_TAB_ID_KEY, 'tab_test');
        sessionStorage.setItem(`${PENDING_END_SESSION_KEY}:tab_test`, JSON.stringify({
            payload: {
                action: 'end',
                sessionId: 'session_pending',
                sessionToken: 'pending_token',
                durationSeconds: 10,
                pageViews: 2,
                quizAttempts: 1,
            },
            idempotencyKey: 'pending-end-key',
        }));

        const fetchMock = jest.fn()
            .mockResolvedValueOnce(createFetchResponse({ success: true }))
            .mockResolvedValueOnce(createFetchResponse({
                sessionId: 'session_1',
                sessionToken: 'token_1',
            }));
        global.fetch = fetchMock as typeof fetch;

        render(<SessionTracker />);

        await waitFor(() => {
            expect(fetchMock).toHaveBeenCalledTimes(2);
        });

        const replayedEndPayload = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));
        const startedPayload = JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body));

        expect(replayedEndPayload).toMatchObject({
            action: 'end',
            sessionId: 'session_pending',
            idempotency_key: 'pending-end-key',
        });
        expect(startedPayload.action).toBe('start');
        expect(sessionStorage.getItem(`${PENDING_END_SESSION_KEY}:tab_test`)).toBeNull();
    });

    it('clears a stored pending end-session when replay returns a non-retryable error', async () => {
        grantConsent();
        sessionStorage.setItem(SESSION_TAB_ID_KEY, 'tab_test');
        sessionStorage.setItem(`${PENDING_END_SESSION_KEY}:tab_test`, JSON.stringify({
            payload: {
                action: 'end',
                sessionId: 'session_pending',
                sessionToken: 'pending_token',
                durationSeconds: 10,
                pageViews: 2,
                quizAttempts: 1,
            },
            idempotencyKey: 'pending-end-key',
        }));

        const fetchMock = jest.fn()
            .mockResolvedValueOnce({
                ok: false,
                status: 403,
                json: jest.fn().mockResolvedValue({
                    code: 'STUDY_SESSION_FORBIDDEN',
                    retryable: false,
                }),
            })
            .mockResolvedValueOnce(createFetchResponse({
                sessionId: 'session_1',
                sessionToken: 'token_1',
            }));
        global.fetch = fetchMock as typeof fetch;

        render(<SessionTracker />);

        await waitFor(() => {
            expect(fetchMock).toHaveBeenCalledTimes(2);
        });

        expect(sessionStorage.getItem(`${PENDING_END_SESSION_KEY}:tab_test`)).toBeNull();
    });

    it('does not start a replacement session while a pending end-session replay is still retryable', async () => {
        grantConsent();
        sessionStorage.setItem(SESSION_TAB_ID_KEY, 'tab_test');
        sessionStorage.setItem(`${PENDING_END_SESSION_KEY}:tab_test`, JSON.stringify({
            payload: {
                action: 'end',
                sessionId: 'session_pending',
                sessionToken: 'pending_token',
                durationSeconds: 10,
                pageViews: 2,
                quizAttempts: 1,
            },
            idempotencyKey: 'pending-end-key',
        }));

        const fetchMock = jest.fn().mockResolvedValue({
            ok: false,
            status: 503,
            json: jest.fn().mockResolvedValue({
                code: 'STUDY_SESSION_UNAVAILABLE',
                retryable: true,
            }),
        });
        global.fetch = fetchMock as typeof fetch;

        render(<SessionTracker />);

        await waitFor(() => {
            expect(fetchMock).toHaveBeenCalledTimes(1);
        });

        const replayedEndPayload = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));
        expect(replayedEndPayload).toMatchObject({
            action: 'end',
            sessionId: 'session_pending',
            idempotency_key: 'pending-end-key',
        });
        expect(sessionStorage.getItem(`${PENDING_END_SESSION_KEY}:tab_test`)).not.toBeNull();
    });

    it('does not persist or beacon an end-session payload when the page is hidden', async () => {
        grantConsent();
        const sendBeacon = jest.fn().mockReturnValue(true);
        Object.defineProperty(navigator, 'sendBeacon', {
            configurable: true,
            value: sendBeacon,
        });

        const fetchMock = jest.fn()
            .mockResolvedValueOnce(createFetchResponse({
                sessionId: 'session_1',
                sessionToken: 'token_1',
            }))
            .mockResolvedValueOnce(createFetchResponse({ success: true }));
        global.fetch = fetchMock as typeof fetch;

        render(<SessionTracker />);

        const originalHidden = Object.getOwnPropertyDescriptor(Document.prototype, 'hidden');

        await waitFor(() => {
            expect(fetchMock).toHaveBeenCalledTimes(1);
        });

        Object.defineProperty(Document.prototype, 'hidden', {
            configurable: true,
            get: () => true,
        });

        act(() => {
            document.dispatchEvent(new Event('visibilitychange'));
        });

        await waitFor(() => {
            expect(fetchMock).toHaveBeenCalledTimes(2);
        });

        expect(sendBeacon).not.toHaveBeenCalled();
        const pendingKey = getCurrentPendingEndKey();
        expect(pendingKey ? sessionStorage.getItem(pendingKey) : null).toBeNull();

        if (originalHidden) {
            Object.defineProperty(Document.prototype, 'hidden', originalHidden);
        } else {
            Object.defineProperty(Document.prototype, 'hidden', {
                configurable: true,
                value: false,
            });
        }
    });

    it('clears the pending end-session payload when the close request returns a non-retryable failure', async () => {
        grantConsent();
        const fetchMock = jest.fn()
            .mockResolvedValueOnce(createFetchResponse({
                sessionId: 'session_1',
                sessionToken: 'token_1',
            }))
            .mockResolvedValueOnce({
                ok: false,
                status: 403,
                json: jest.fn().mockResolvedValue({
                    code: 'STUDY_SESSION_FORBIDDEN',
                    retryable: false,
                }),
            });
        global.fetch = fetchMock as typeof fetch;

        const view = render(<SessionTracker />);

        await waitFor(() => {
            expect(fetchMock).toHaveBeenCalledTimes(1);
        });

        view.unmount();

        await waitFor(() => {
            expect(fetchMock).toHaveBeenCalledTimes(2);
        });

        const pendingKey = getCurrentPendingEndKey();
        expect(pendingKey ? sessionStorage.getItem(pendingKey) : null).toBeNull();
    });

    it('keeps the active session mirrored locally when the close request returns a retryable failure', async () => {
        grantConsent();
        const fetchMock = jest.fn()
            .mockResolvedValueOnce(createFetchResponse({
                sessionId: 'session_1',
                sessionToken: 'token_1',
            }))
            .mockResolvedValueOnce({
                ok: false,
                status: 503,
                json: jest.fn().mockResolvedValue({
                    code: 'STUDY_SESSION_UNAVAILABLE',
                    retryable: true,
                }),
            });
        global.fetch = fetchMock as typeof fetch;

        const view = render(<SessionTracker />);

        await waitFor(() => {
            expect(readStoredSession()).toMatchObject({
                id: 'session_1',
                token: 'token_1',
            });
        });

        view.unmount();

        await waitFor(() => {
            expect(fetchMock).toHaveBeenCalledTimes(2);
        });

        expect(readStoredSession()).toMatchObject({
            id: 'session_1',
            token: 'token_1',
        });
        const pendingKey = getCurrentPendingEndKey();
        expect(pendingKey ? sessionStorage.getItem(pendingKey) : null).not.toBeNull();
    });

    it('keeps the active session mirrored locally when pending end-session persistence fails', async () => {
        grantConsent();
        sessionStorage.setItem(SESSION_TAB_ID_KEY, 'tab_test');
        const fetchMock = jest.fn()
            .mockResolvedValueOnce(createFetchResponse({
                sessionId: 'session_1',
                sessionToken: 'token_1',
            }))
            .mockRejectedValueOnce(new TypeError('network unavailable'));
        global.fetch = fetchMock as typeof fetch;

        const view = render(<SessionTracker />);

        await waitFor(() => {
            expect(readStoredSession()).toMatchObject({
                id: 'session_1',
                token: 'token_1',
            });
        });

        const originalSetItem = Storage.prototype.setItem;
        const setItemSpy = jest.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, key, value) {
            if (key === `${PENDING_END_SESSION_KEY}:tab_test`) {
                throw new Error('quota exceeded');
            }

            return originalSetItem.call(this, key, value);
        });

        view.unmount();

        await waitFor(() => {
            expect(fetchMock).toHaveBeenCalledTimes(2);
        });

        expect(readStoredSession()).toMatchObject({
            id: 'session_1',
            token: 'token_1',
        });
        expect(mockLoggerWarn).toHaveBeenCalledWith(
            'SESSION_TRACKER_PENDING_END_PERSIST_FAILED',
            expect.objectContaining({
                route: 'SessionTracker',
            })
        );

        setItemSpy.mockRestore();
    });

    it('increments quiz attempts only for the active tab session record', async () => {
        grantConsent();
        render(<SessionTracker />);

        await waitFor(() => {
            expect(readStoredSession().pageViews).toBe(1);
        });

        const currentTabId = getCurrentTabId();
        expect(currentTabId).not.toBeNull();

        sessionStorage.setItem(`${SESSION_KEY}:tab_other`, JSON.stringify({
            id: 'session_other',
            token: 'token_other',
            startTime: Date.now(),
            pageViews: 5,
            quizAttempts: 7,
            authMode: 'anonymous',
            anonymousId: 'anon_other',
        }));

        act(() => {
            incrementQuizAttempt();
        });

        expect(readStoredSession().quizAttempts).toBe(1);
        expect(JSON.parse(sessionStorage.getItem(`${SESSION_KEY}:tab_other`) || 'null')).toMatchObject({
            quizAttempts: 7,
        });
    });

    it('replays a pending start-session before creating a brand-new session', async () => {
        grantConsent();
        sessionStorage.setItem(SESSION_TAB_ID_KEY, 'tab_test');
        sessionStorage.setItem(`${SESSION_KEY}:tab_test`, JSON.stringify({
            id: null,
            token: null,
            startTime: 1000,
            pageViews: 0,
            quizAttempts: 0,
            authMode: 'anonymous',
            anonymousId: 'anon_123',
        }));
        sessionStorage.setItem(`${PENDING_START_SESSION_KEY}:tab_test`, JSON.stringify({
            payload: {
                action: 'start',
                anonymousId: 'anon_123',
                deviceType: 'desktop',
                userAgent: 'jest',
                consentGiven: true,
                previous_session_id: null,
            },
            sessionStartTime: 1000,
            idempotencyKey: 'pending-start-key',
        }));

        const fetchMock = jest.fn().mockResolvedValueOnce(createFetchResponse({
            sessionId: 'session_replayed',
            sessionToken: 'token_replayed',
        }));
        global.fetch = fetchMock as typeof fetch;

        render(<SessionTracker />);

        await waitFor(() => {
            expect(fetchMock).toHaveBeenCalledTimes(1);
        });

        const replayedStartPayload = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));
        expect(replayedStartPayload).toMatchObject({
            action: 'start',
            idempotency_key: 'pending-start-key',
        });
        expect(readStoredSession()).toMatchObject({
            id: 'session_replayed',
            token: 'token_replayed',
        });
        expect(getCurrentPendingStartKey() ? sessionStorage.getItem(getCurrentPendingStartKey()!) : null).toBeNull();
    });

    it('starts a fresh session after a restored pending start fails non-retryably', async () => {
        grantConsent();
        sessionStorage.setItem(SESSION_TAB_ID_KEY, 'tab_test');
        sessionStorage.setItem(`${SESSION_KEY}:tab_test`, JSON.stringify({
            id: null,
            token: null,
            startTime: 1000,
            pageViews: 0,
            quizAttempts: 0,
            authMode: 'anonymous',
            anonymousId: 'anon_123',
        }));
        sessionStorage.setItem(`${PENDING_START_SESSION_KEY}:tab_test`, JSON.stringify({
            payload: {
                action: 'start',
                anonymousId: 'anon_123',
                deviceType: 'desktop',
                userAgent: 'jest',
                consentGiven: true,
                previous_session_id: null,
            },
            sessionStartTime: 1000,
            idempotencyKey: 'pending-start-key',
        }));

        const fetchMock = jest.fn()
            .mockResolvedValueOnce({
                ok: false,
                status: 403,
                json: jest.fn().mockResolvedValue({
                    code: 'UNAUTHORIZED',
                    retryable: false,
                }),
            })
            .mockResolvedValueOnce(createFetchResponse({
                sessionId: 'session_fresh',
                sessionToken: 'token_fresh',
            }));
        global.fetch = fetchMock as typeof fetch;

        render(<SessionTracker />);

        await waitFor(() => {
            expect(fetchMock).toHaveBeenCalledTimes(2);
        });

        const replayedStartPayload = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));
        const freshStartPayload = JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body));

        expect(replayedStartPayload.idempotency_key).toBe('pending-start-key');
        expect(freshStartPayload.idempotency_key).not.toBe('pending-start-key');
        expect(readStoredSession()).toMatchObject({
            id: 'session_fresh',
            token: 'token_fresh',
        });
    });

    it('does not let a resolved stale anonymous start overwrite a newer authenticated session start', async () => {
        grantConsent();
        const deferredAnonymousStart = createDeferred<Response>();
        const fetchMock = jest.fn()
            .mockImplementationOnce(() => deferredAnonymousStart.promise)
            .mockResolvedValueOnce(createFetchResponse({
                sessionId: 'authenticated_session',
                sessionToken: 'authenticated_token',
            }))
            .mockResolvedValue(createFetchResponse({ success: true }));
        global.fetch = fetchMock as typeof fetch;

        const { rerender } = render(<SessionTracker />);

        await waitFor(() => {
            expect(fetchMock).toHaveBeenCalledTimes(1);
        });

        mockUseAuth.mockReturnValue({ isAuthenticated: true });
        rerender(<SessionTracker />);

        deferredAnonymousStart.resolve(createFetchResponse({
            sessionId: 'anonymous_session',
            sessionToken: 'anonymous_token',
        }));

        await waitFor(() => {
            expect(fetchMock).toHaveBeenCalledTimes(2);
        });

        const authenticatedStartPayload = JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body));

        expect(authenticatedStartPayload).toMatchObject({
            action: 'start',
            anonymousId: null,
        });

        await waitFor(() => {
            expect(readStoredSession()).toMatchObject({
                id: 'authenticated_session',
                token: 'authenticated_token',
            });
        });
    });

    it('logs and removes retry queue entries that expired before restore', async () => {
        jest.useFakeTimers();
        jest.setSystemTime(new Date('2026-03-27T12:00:00.000Z'));

        sessionStorage.setItem(SESSION_TAB_ID_KEY, 'tab_test');
        sessionStorage.setItem(`${RETRY_QUEUE_SESSION_KEY}:tab_test`, JSON.stringify([
            createQueuedHeartbeat('expired-heartbeat', Date.now() - ((24 * 60 * 60 * 1000) + 1)),
        ]));

        render(<SessionTracker />);

        await waitFor(() => {
            expect(mockLoggerWarn).toHaveBeenCalledWith(
                'SESSION_TRACKER_RETRY_QUEUE_ENTRIES_DROPPED',
                expect.objectContaining({
                    route: 'SessionTracker',
                    reason: 'age',
                    droppedCount: 1,
                    actions: ['heartbeat'],
                })
            );
        });

        expect(getCurrentRetryQueueKey() ? sessionStorage.getItem(getCurrentRetryQueueKey()!) : null).toBeNull();
    });

    it('logs and trims retry queue entries that exceed the queue capacity on restore', async () => {
        jest.useFakeTimers();
        jest.setSystemTime(new Date('2026-03-27T12:00:00.000Z'));

        sessionStorage.setItem(SESSION_TAB_ID_KEY, 'tab_test');
        sessionStorage.setItem(`${RETRY_QUEUE_SESSION_KEY}:tab_test`, JSON.stringify(
            Array.from({ length: 51 }, (_, index) => createQueuedHeartbeat(`retry-${index}`, Date.now() - index))
        ));

        render(<SessionTracker />);

        await waitFor(() => {
            expect(mockLoggerWarn).toHaveBeenCalledWith(
                'SESSION_TRACKER_RETRY_QUEUE_ENTRIES_DROPPED',
                expect.objectContaining({
                    route: 'SessionTracker',
                    reason: 'capacity',
                    droppedCount: 1,
                    actions: ['heartbeat'],
                })
            );
        });

        const storedQueue = JSON.parse(sessionStorage.getItem(`${RETRY_QUEUE_SESSION_KEY}:tab_test`) || '[]') as Array<{ idempotencyKey: string }>;
        expect(storedQueue).toHaveLength(50);
        expect(storedQueue.some((entry) => entry.idempotencyKey === 'retry-0')).toBe(false);
    });
});
