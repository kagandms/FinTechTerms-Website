/**
 * @jest-environment jsdom
 */

import React from 'react';
import { act, render, waitFor } from '@testing-library/react';
import SessionTracker from '@/components/SessionTracker';
import { CONSENT_GRANTED_EVENT } from '@/components/ConsentModal';

const mockUseAuth = jest.fn();
const mockUsePathname = jest.fn();

jest.mock('@/contexts/AuthContext', () => ({
    useAuth: () => mockUseAuth(),
}));

jest.mock('next/navigation', () => ({
    usePathname: () => mockUsePathname(),
}));

const SESSION_KEY = 'fintechterms_session';
const CONSENT_KEY = 'fintechterms_research_consent';
const PENDING_END_SESSION_KEY = 'fintechterms_pending_end_session';

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

const readStoredSession = () => JSON.parse(localStorage.getItem(SESSION_KEY) || 'null') as {
    id: string | null;
    token: string | null;
    pageViews: number;
    anonymousId: string | null;
};

describe('SessionTracker', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        localStorage.clear();
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

        expect(localStorage.getItem(SESSION_KEY)).toBeNull();

        grantConsent();
        window.dispatchEvent(new CustomEvent(CONSENT_GRANTED_EVENT));

        await waitFor(() => {
            expect(readStoredSession().pageViews).toBe(1);
        });
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

        const initialStartPayload = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));

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

    it('queues retryable session mutations and flushes them when the browser comes back online', async () => {
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
            expect(fetchMock).toHaveBeenCalledTimes(2);
        });

        const failedHeartbeatPayload = JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body));
        expect(failedHeartbeatPayload.action).toBe('heartbeat');

        await act(async () => {
            window.dispatchEvent(new Event('online'));
        });

        await waitFor(() => {
            expect(fetchMock).toHaveBeenCalledTimes(3);
        });

        const retriedHeartbeatPayload = JSON.parse(String(fetchMock.mock.calls[2]?.[1]?.body));
        expect(retriedHeartbeatPayload.action).toBe('heartbeat');
        expect(retriedHeartbeatPayload.idempotency_key).toBe(failedHeartbeatPayload.idempotency_key);
    });

    it('replays a pending end-session from sessionStorage before starting a new session', async () => {
        grantConsent();
        sessionStorage.setItem(PENDING_END_SESSION_KEY, JSON.stringify({
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
        expect(sessionStorage.getItem(PENDING_END_SESSION_KEY)).toBeNull();
    });

    it('stores a pending end-session and sends it with sendBeacon when the page is hidden', async () => {
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

        localStorage.setItem(SESSION_KEY, JSON.stringify({
            id: 'session_1',
            token: 'token_1',
            startTime: Date.now() - 5000,
            pageViews: 1,
            quizAttempts: 0,
            authMode: 'anonymous',
            anonymousId: 'anon_123',
        }));

        Object.defineProperty(Document.prototype, 'hidden', {
            configurable: true,
            get: () => true,
        });

        act(() => {
            document.dispatchEvent(new Event('visibilitychange'));
        });

        await waitFor(() => {
            expect(sendBeacon).toHaveBeenCalledTimes(1);
        });

        const pendingPayload = JSON.parse(sessionStorage.getItem(PENDING_END_SESSION_KEY) || 'null');
        expect(pendingPayload).toMatchObject({
            payload: expect.objectContaining({
                action: 'end',
                sessionId: 'session_1',
                sessionToken: 'token_1',
            }),
        });
        expect(sendBeacon.mock.calls[0]?.[0]).toBe('/api/study-sessions');
        expect(sendBeacon.mock.calls[0]?.[1]).toBeInstanceOf(Blob);

        if (originalHidden) {
            Object.defineProperty(Document.prototype, 'hidden', originalHidden);
        } else {
            Object.defineProperty(Document.prototype, 'hidden', {
                configurable: true,
                value: false,
            });
        }
    });
});
