/**
 * @jest-environment jsdom
 */

import React, { act } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

import { AuthProvider, useAuth } from '@/contexts/AuthContext';

const mockFetch = jest.fn();

jest.mock('@/lib/env', () => ({
    getPublicEnv: () => ({
        siteUrl: 'http://localhost:3000',
        defaultLanguage: 'ru',
        gaId: null,
        supabaseUrl: 'https://project.supabase.co',
        supabaseAnonKey: 'anon-key',
        sentryDsn: null,
        sentryEnvironment: 'test',
        sentryTracesSampleRate: 0.1,
    }),
    hasConfiguredPublicSupabaseEnv: () => true,
}));

const buildEntitlements = (requiresProfileCompletion: boolean) => ({
    maxFavorites: requiresProfileCompletion ? 15 : Number.POSITIVE_INFINITY,
    canUseReviewMode: !requiresProfileCompletion,
    canUseAiFeatures: !requiresProfileCompletion,
    canUseAdvancedAnalytics: !requiresProfileCompletion,
    canUseMistakeReview: !requiresProfileCompletion,
    canInstallPwa: true,
    requiresProfileCompletion,
});

const buildAuthenticatedSessionState = (overrides: Record<string, unknown> = {}) => ({
    user: {
        id: 'user-1',
        email: 'user@example.com',
        name: 'Alex Stone',
        createdAt: '2026-03-11T00:00:00.000Z',
        primaryProvider: 'email',
        providers: ['email'],
    },
    isAuthenticated: true,
    isAdmin: false,
    entitlements: buildEntitlements(false),
    requiresProfileCompletion: false,
    memberStateUnavailable: false,
    ...overrides,
});

const buildGuestSessionState = () => ({
    user: null,
    isAuthenticated: false,
    isAdmin: false,
    entitlements: buildEntitlements(false),
    requiresProfileCompletion: false,
    memberStateUnavailable: false,
});

const createJsonResponse = (payload: unknown, init?: { ok?: boolean; status?: number }) => ({
    ok: init?.ok ?? true,
    status: init?.status ?? 200,
    json: jest.fn().mockResolvedValue(payload),
}) as unknown as Response;

const AuthContextConsumer = () => {
    const {
        user,
        isAuthenticated,
        isPasswordRecovery,
        logout,
        refreshMemberState,
        updatePassword,
        verifyOTP,
        requiresProfileCompletion,
    } = useAuth();
    const [updateResult, setUpdateResult] = React.useState('idle');
    const [logoutResult, setLogoutResult] = React.useState('idle');
    const [verifyResult, setVerifyResult] = React.useState('idle');

    return (
        <div>
            <div data-testid="user-name">{user?.name ?? 'anonymous'}</div>
            <div data-testid="authenticated-state">{String(isAuthenticated)}</div>
            <div data-testid="recovery-state">{String(isPasswordRecovery)}</div>
            <div data-testid="profile-completion-state">{String(requiresProfileCompletion)}</div>
            <div data-testid="update-result">{updateResult}</div>
            <div data-testid="logout-result">{logoutResult}</div>
            <div data-testid="verify-result">{verifyResult}</div>
            <button
                type="button"
                onClick={async () => {
                    const result = await updatePassword('StrongPass1!');
                    setUpdateResult(JSON.stringify(result));
                }}
            >
                update-password
            </button>
            <button
                type="button"
                onClick={async () => {
                    const result = await logout();
                    setLogoutResult(JSON.stringify(result));
                }}
            >
                logout
            </button>
            <button
                type="button"
                onClick={async () => {
                    const result = await verifyOTP('user@example.com', '123456');
                    setVerifyResult(JSON.stringify(result));
                }}
            >
                verify-otp
            </button>
            <button
                type="button"
                onClick={async () => {
                    await refreshMemberState();
                }}
            >
                refresh-member-state
            </button>
        </div>
    );
};

describe('AuthProvider', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        window.history.pushState({}, '', '/profile');
        global.fetch = mockFetch as unknown as typeof fetch;
        mockFetch.mockImplementation(async (input: RequestInfo | URL) => {
            const url = String(input);

            if (url.includes('/api/auth/session')) {
                return createJsonResponse(buildAuthenticatedSessionState());
            }

            if (url.includes('/api/auth/update-password')) {
                return createJsonResponse({ success: true });
            }

            if (url.includes('/api/auth/signout')) {
                return createJsonResponse({ success: true });
            }

            if (url.includes('/api/auth/verify-otp')) {
                return createJsonResponse({ success: true });
            }

            return createJsonResponse({ success: true });
        });
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    it('keeps password recovery mode enabled when updatePassword fails', async () => {
        window.history.pushState({}, '', '/profile?reset=true');
        mockFetch.mockImplementation(async (input: RequestInfo | URL) => {
            const url = String(input);

            if (url.includes('/api/auth/session')) {
                return createJsonResponse(buildAuthenticatedSessionState());
            }

            if (url.includes('/api/auth/update-password')) {
                return createJsonResponse({
                    message: 'Weak password',
                }, {
                    ok: false,
                    status: 400,
                });
            }

            return createJsonResponse({ success: true });
        });

        render(
            <AuthProvider>
                <AuthContextConsumer />
            </AuthProvider>
        );

        await waitFor(() => {
            expect(screen.getByTestId('recovery-state')).toHaveTextContent('true');
        });

        fireEvent.click(screen.getByRole('button', { name: 'update-password' }));

        await waitFor(() => {
            expect(screen.getByTestId('update-result')).toHaveTextContent('"success":false');
            expect(screen.getByTestId('recovery-state')).toHaveTextContent('true');
        });
    });

    it('disables password recovery mode after a successful password update', async () => {
        window.history.pushState({}, '', '/profile?reset=true');

        render(
            <AuthProvider>
                <AuthContextConsumer />
            </AuthProvider>
        );

        await waitFor(() => {
            expect(screen.getByTestId('recovery-state')).toHaveTextContent('true');
        });

        fireEvent.click(screen.getByRole('button', { name: 'update-password' }));

        await waitFor(() => {
            expect(screen.getByTestId('update-result')).toHaveTextContent('"success":true');
            expect(screen.getByTestId('recovery-state')).toHaveTextContent('false');
        });
    });

    it('keeps auth state intact when the server signout route fails', async () => {
        mockFetch.mockImplementation(async (input: RequestInfo | URL) => {
            const url = String(input);

            if (url.includes('/api/auth/session')) {
                return createJsonResponse(buildAuthenticatedSessionState());
            }

            if (url.includes('/api/auth/signout')) {
                return createJsonResponse({
                    message: 'Unable to sign out.',
                }, {
                    ok: false,
                    status: 500,
                });
            }

            return createJsonResponse({ success: true });
        });

        render(
            <AuthProvider>
                <AuthContextConsumer />
            </AuthProvider>
        );

        await waitFor(() => {
            expect(screen.getByTestId('authenticated-state')).toHaveTextContent('true');
        });

        fireEvent.click(screen.getByRole('button', { name: 'logout' }));

        await waitFor(() => {
            expect(screen.getByTestId('logout-result')).toHaveTextContent('"success":false');
            expect(screen.getByTestId('authenticated-state')).toHaveTextContent('true');
        });
    });

    it('fails signout cleanly when the signout route hangs past the timeout', async () => {
        jest.useFakeTimers();
        mockFetch.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
            const url = String(input);

            if (url.includes('/api/auth/session')) {
                return Promise.resolve(createJsonResponse(buildAuthenticatedSessionState()));
            }

            if (url.includes('/api/auth/signout')) {
                return new Promise((_, reject) => {
                    init?.signal?.addEventListener('abort', () => {
                        reject(new DOMException('The operation was aborted.', 'AbortError'));
                    }, { once: true });
                });
            }

            return Promise.resolve(createJsonResponse({ success: true }));
        });

        render(
            <AuthProvider>
                <AuthContextConsumer />
            </AuthProvider>
        );

        await waitFor(() => {
            expect(screen.getByTestId('authenticated-state')).toHaveTextContent('true');
        });

        fireEvent.click(screen.getByRole('button', { name: 'logout' }));
        await jest.advanceTimersByTimeAsync(4_000);

        await waitFor(() => {
            expect(screen.getByTestId('logout-result')).toHaveTextContent('"success":false');
            expect(screen.getByTestId('authenticated-state')).toHaveTextContent('true');
        });
    });

    it('does not mark the user authenticated when OTP verification cannot establish a session', async () => {
        mockFetch.mockImplementation(async (input: RequestInfo | URL) => {
            const url = String(input);

            if (url.includes('/api/auth/session')) {
                return createJsonResponse(buildGuestSessionState());
            }

            if (url.includes('/api/auth/verify-otp')) {
                return createJsonResponse({
                    message: 'Verification succeeded, but an authenticated session could not be established. Please sign in.',
                }, {
                    ok: false,
                    status: 409,
                });
            }

            return createJsonResponse({ success: true });
        });

        render(
            <AuthProvider>
                <AuthContextConsumer />
            </AuthProvider>
        );

        await waitFor(() => {
            expect(screen.getByTestId('authenticated-state')).toHaveTextContent('false');
        });

        fireEvent.click(screen.getByRole('button', { name: 'verify-otp' }));

        await waitFor(() => {
            expect(screen.getByTestId('verify-result')).toHaveTextContent('"success":false');
            expect(screen.getByTestId('authenticated-state')).toHaveTextContent('false');
            expect(screen.getByTestId('verify-result')).toHaveTextContent('authenticated session could not be established');
        });
    });

    it('accepts OTP verification when the route succeeds and the next session refresh is authenticated', async () => {
        let sessionFetchCount = 0;
        mockFetch.mockImplementation(async (input: RequestInfo | URL) => {
            const url = String(input);

            if (url.includes('/api/auth/session')) {
                sessionFetchCount += 1;
                return createJsonResponse(
                    sessionFetchCount === 1
                        ? buildGuestSessionState()
                        : buildAuthenticatedSessionState()
                );
            }

            if (url.includes('/api/auth/verify-otp')) {
                return createJsonResponse({ success: true });
            }

            return createJsonResponse({ success: true });
        });

        render(
            <AuthProvider>
                <AuthContextConsumer />
            </AuthProvider>
        );

        await waitFor(() => {
            expect(screen.getByTestId('authenticated-state')).toHaveTextContent('false');
        });

        fireEvent.click(screen.getByRole('button', { name: 'verify-otp' }));

        await waitFor(() => {
            expect(screen.getByTestId('verify-result')).toHaveTextContent('"success":true');
            expect(screen.getByTestId('authenticated-state')).toHaveTextContent('true');
        });
    });

    it('fails OTP verification after a bounded session-sync window when the session never becomes authenticated', async () => {
        jest.useFakeTimers();
        let sessionFetchCount = 0;
        mockFetch.mockImplementation(async (input: RequestInfo | URL) => {
            const url = String(input);

            if (url.includes('/api/auth/session')) {
                sessionFetchCount += 1;
                return createJsonResponse(buildGuestSessionState());
            }

            if (url.includes('/api/auth/verify-otp')) {
                return createJsonResponse({ success: true });
            }

            return createJsonResponse({ success: true });
        });

        render(
            <AuthProvider>
                <AuthContextConsumer />
            </AuthProvider>
        );

        await waitFor(() => {
            expect(screen.getByTestId('authenticated-state')).toHaveTextContent('false');
        });

        fireEvent.click(screen.getByRole('button', { name: 'verify-otp' }));

        await act(async () => {
            await jest.advanceTimersByTimeAsync(2_000);
        });

        await waitFor(() => {
            expect(screen.getByTestId('verify-result')).toHaveTextContent('"success":false');
        });

        expect(sessionFetchCount).toBeLessThanOrEqual(6);
    });

    it('refreshes the canonical profile-completion state from the session endpoint', async () => {
        let sessionFetchCount = 0;
        mockFetch.mockImplementation(async (input: RequestInfo | URL) => {
            const url = String(input);

            if (url.includes('/api/auth/session')) {
                sessionFetchCount += 1;
                return createJsonResponse(
                    sessionFetchCount === 1
                        ? buildAuthenticatedSessionState()
                        : buildAuthenticatedSessionState({
                            entitlements: buildEntitlements(true),
                            requiresProfileCompletion: true,
                        })
                );
            }

            return createJsonResponse({ success: true });
        });

        render(
            <AuthProvider>
                <AuthContextConsumer />
            </AuthProvider>
        );

        await waitFor(() => {
            expect(screen.getByTestId('authenticated-state')).toHaveTextContent('true');
            expect(screen.getByTestId('profile-completion-state')).toHaveTextContent('false');
        });

        fireEvent.click(screen.getByRole('button', { name: 'refresh-member-state' }));

        await waitFor(() => {
            expect(screen.getByTestId('profile-completion-state')).toHaveTextContent('true');
        });
    });
});
