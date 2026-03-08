/**
 * @jest-environment jsdom
 */

import React from 'react';
import { render, waitFor } from '@testing-library/react';
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
    pageViews: number;
    anonymousId: string | null;
};

describe('SessionTracker', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        localStorage.clear();
        mockUseAuth.mockReturnValue({ isAuthenticated: false });
        mockUsePathname.mockReturnValue('/search');
        global.fetch = jest.fn().mockResolvedValue(createFetchResponse({ sessionId: 'session_1' }));
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
            .mockResolvedValueOnce(createFetchResponse({ sessionId: 'anonymous_session' }))
            .mockResolvedValueOnce(createFetchResponse({ success: true }))
            .mockResolvedValueOnce(createFetchResponse({ sessionId: 'authenticated_session' }))
            .mockResolvedValue(createFetchResponse({ success: true }));
        global.fetch = fetchMock as typeof fetch;

        const { rerender } = render(<SessionTracker />);

        await waitFor(() => {
            expect(fetchMock).toHaveBeenCalledTimes(1);
        });

        const initialStartPayload = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));
        const initialAnonymousId = initialStartPayload.anonymousId as string;

        mockUseAuth.mockReturnValue({ isAuthenticated: true });
        rerender(<SessionTracker />);

        await waitFor(() => {
            expect(fetchMock).toHaveBeenCalledTimes(3);
        });

        const endPayload = JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body));
        const authenticatedStartPayload = JSON.parse(String(fetchMock.mock.calls[2]?.[1]?.body));

        expect(endPayload.action).toBe('end');
        expect(endPayload.anonymousId).toBe(initialAnonymousId);
        expect(authenticatedStartPayload.action).toBe('start');
        expect(authenticatedStartPayload.previous_session_id).toBe('anonymous_session');
        expect(authenticatedStartPayload.anonymousId).toBe(initialAnonymousId);
    });
});
