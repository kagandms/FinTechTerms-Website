/**
 * @jest-environment jsdom
 */

import React from 'react';
import { act, render, waitFor } from '@testing-library/react';
import BadgeRealtimeNotifier from '@/components/profile/BadgeRealtimeNotifier';

const mockUseAuth = jest.fn();
const mockUseLanguage = jest.fn();
const mockRefresh = jest.fn();
const mockLoggerError = jest.fn();

jest.mock('@/contexts/AuthContext', () => ({
    useAuth: () => mockUseAuth(),
}));

jest.mock('@/contexts/LanguageContext', () => ({
    useLanguage: () => mockUseLanguage(),
}));

jest.mock('next/navigation', () => ({
    useRouter: () => ({
        refresh: mockRefresh,
    }),
}));

jest.mock('@/lib/logger', () => ({
    logger: {
        error: (...args: unknown[]) => mockLoggerError(...args),
    },
}));

const createJsonResponse = (body: unknown, status = 200): Response => ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
}) as Response;

describe('BadgeRealtimeNotifier', () => {
    const originalFetch = global.fetch;

    beforeEach(() => {
        jest.useFakeTimers();
        jest.clearAllMocks();
        mockUseAuth.mockReturnValue({
            user: { id: 'user-1' },
        });
        mockUseLanguage.mockReturnValue({
            language: 'en',
        });
        Object.defineProperty(document, 'visibilityState', {
            configurable: true,
            value: 'visible',
        });
    });

    afterEach(() => {
        jest.useRealTimers();
        global.fetch = originalFetch;
    });

    it('does not start a second badge poll while the previous request is still in flight', async () => {
        let resolveResponse: ((response: Response) => void) | null = null;
        global.fetch = jest.fn(() => new Promise<Response>((resolve) => {
            resolveResponse = resolve;
        })) as typeof fetch;

        render(<BadgeRealtimeNotifier />);

        expect(global.fetch).toHaveBeenCalledTimes(1);

        await act(async () => {
            await jest.advanceTimersByTimeAsync(30_000);
        });

        expect(global.fetch).toHaveBeenCalledTimes(1);

        await act(async () => {
            resolveResponse?.(createJsonResponse({ badges: [] }));
            await Promise.resolve();
        });
    });

    it('aborts hung badge polls after the timeout window', async () => {
        let aborted = false;
        global.fetch = jest.fn((_input: RequestInfo | URL, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
            init?.signal?.addEventListener('abort', () => {
                aborted = true;
                reject(Object.assign(new Error('aborted'), { name: 'AbortError' }));
            }, { once: true });
        })) as typeof fetch;

        render(<BadgeRealtimeNotifier />);

        await act(async () => {
            await jest.advanceTimersByTimeAsync(10_000);
        });

        await waitFor(() => {
            expect(aborted).toBe(true);
        });
        await waitFor(() => {
            expect(mockLoggerError).toHaveBeenCalledWith(
                'BADGE_NOTIFICATION_POLL_FAILED',
                expect.objectContaining({
                    route: 'BadgeRealtimeNotifier',
                    error: expect.any(Error),
                })
            );
        });
    });
});
