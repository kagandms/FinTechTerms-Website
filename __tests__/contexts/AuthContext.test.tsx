/**
 * @jest-environment jsdom
 */

import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

import { AuthProvider, useAuth } from '@/contexts/AuthContext';

const mockGetSession = jest.fn();
const mockOnAuthStateChange = jest.fn();
const mockSignOut = jest.fn();
const mockVerifyOtp = jest.fn();
const mockSignInWithPassword = jest.fn();
const mockTempSetSession = jest.fn();
const mockTempUpdateUser = jest.fn();
const mockCreateClient = jest.fn();
const mockProfileMaybeSingle = jest.fn();
const mockProfileFrom = jest.fn();

jest.mock('@/lib/supabase', () => ({
    getSupabaseClient: () => ({
        auth: {
            getSession: (...args: unknown[]) => mockGetSession(...args),
            onAuthStateChange: (...args: unknown[]) => mockOnAuthStateChange(...args),
            signOut: (...args: unknown[]) => mockSignOut(...args),
            verifyOtp: (...args: unknown[]) => mockVerifyOtp(...args),
            signInWithPassword: (...args: unknown[]) => mockSignInWithPassword(...args),
        },
        from: (...args: unknown[]) => mockProfileFrom(...args),
    }),
}));

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

jest.mock('@/lib/supabaseStorage', () => ({
    getUserProgressFromSupabase: jest.fn().mockResolvedValue({
        status: 'ok',
        data: {
            user_id: 'user-1',
            favorites: [],
            current_language: 'ru',
            quiz_history: [],
            total_words_learned: 0,
            current_streak: 0,
            last_study_date: null,
            created_at: '2026-03-11T00:00:00.000Z',
            updated_at: '2026-03-11T00:00:00.000Z',
        },
    }),
}));

jest.mock('@supabase/supabase-js', () => ({
    createClient: (...args: unknown[]) => mockCreateClient(...args),
}));

const AuthContextConsumer = () => {
    const { isAuthenticated, isPasswordRecovery, logout, updatePassword, verifyOTP, requiresProfileCompletion } = useAuth();
    const [result, setResult] = React.useState('idle');
    const [logoutResult, setLogoutResult] = React.useState('idle');
    const [verifyResult, setVerifyResult] = React.useState('idle');

    return (
        <div>
            <div data-testid="authenticated-state">{String(isAuthenticated)}</div>
            <div data-testid="recovery-state">{String(isPasswordRecovery)}</div>
            <div data-testid="profile-completion-state">{String(requiresProfileCompletion)}</div>
            <div data-testid="update-result">{result}</div>
            <div data-testid="logout-result">{logoutResult}</div>
            <div data-testid="verify-result">{verifyResult}</div>
            <button
                type="button"
                onClick={async () => {
                    const response = await updatePassword('StrongPass1!');
                    setResult(JSON.stringify(response));
                }}
            >
                update-password
            </button>
            <button
                type="button"
                onClick={async () => {
                    const response = await logout();
                    setLogoutResult(JSON.stringify(response));
                }}
            >
                logout
            </button>
            <button
                type="button"
                onClick={async () => {
                    const response = await verifyOTP('user@example.com', '123456');
                    setVerifyResult(JSON.stringify(response));
                }}
            >
                verify-otp
            </button>
        </div>
    );
};

describe('AuthProvider updatePassword', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        window.history.pushState({}, '', '/profile?reset=true');
        global.fetch = jest.fn().mockResolvedValue({
            ok: true,
            json: jest.fn().mockResolvedValue({ isAdmin: false }),
        }) as typeof fetch;

        mockGetSession.mockResolvedValue({
            data: {
                session: {
                    access_token: 'access-token',
                    refresh_token: 'refresh-token',
                    user: {
                        id: 'user-1',
                        email: 'user@example.com',
                        created_at: '2026-03-11T00:00:00.000Z',
                        app_metadata: {},
                        user_metadata: {},
                    },
                },
            },
            error: null,
        });
        mockOnAuthStateChange.mockReturnValue({
            data: {
                subscription: {
                    unsubscribe: jest.fn(),
                },
            },
        });
        mockSignOut.mockResolvedValue({ error: null });
        mockVerifyOtp.mockResolvedValue({
            data: {
                user: {
                    id: 'user-1',
                    email: 'user@example.com',
                },
                session: null,
            },
            error: null,
        });
        mockSignInWithPassword.mockResolvedValue({
            data: {
                user: null,
                session: null,
            },
            error: { message: 'No session' },
        });
        mockTempSetSession.mockResolvedValue({ error: null });
        mockTempUpdateUser.mockResolvedValue({
            data: null,
            error: {
                message: 'Weak password',
            },
        });
        mockCreateClient.mockReturnValue({
            auth: {
                setSession: (...args: unknown[]) => mockTempSetSession(...args),
                updateUser: (...args: unknown[]) => mockTempUpdateUser(...args),
            },
        });
        mockProfileMaybeSingle.mockResolvedValue({
            data: { birth_date: '2000-01-01' },
            error: null,
        });
        mockProfileFrom.mockReturnValue({
            select: () => ({
                eq: () => ({
                    maybeSingle: (...args: unknown[]) => mockProfileMaybeSingle(...args),
                }),
            }),
        });
    });

    it('keeps password recovery mode enabled when updatePassword fails', async () => {
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
        mockTempUpdateUser.mockResolvedValue({
            data: {
                user: {
                    id: 'user-1',
                },
            },
            error: null,
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
            expect(screen.getByTestId('update-result')).toHaveTextContent('"success":true');
            expect(screen.getByTestId('recovery-state')).toHaveTextContent('false');
        });
    });

    it('keeps auth state intact when the server signout route fails', async () => {
        global.fetch = jest.fn().mockResolvedValue({
            ok: false,
            status: 500,
            json: jest.fn().mockResolvedValue({
                message: 'Unable to sign out.',
            }),
        }) as typeof fetch;

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
            expect(window.location.pathname).toBe('/profile');
            expect(mockSignOut).not.toHaveBeenCalled();
        });
    });

    it('does not mark the user authenticated when OTP verification has no session', async () => {
        mockGetSession.mockResolvedValue({
            data: {
                session: null,
            },
            error: null,
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
        }, { timeout: 2500 });
    });

    it('uses profiles.birth_date as the canonical profile-completion source for Google users', async () => {
        mockGetSession.mockResolvedValue({
            data: {
                session: {
                    access_token: 'access-token',
                    refresh_token: 'refresh-token',
                    user: {
                        id: 'user-1',
                        email: 'user@example.com',
                        created_at: '2026-03-11T00:00:00.000Z',
                        app_metadata: {
                            provider: 'google',
                            providers: ['google'],
                        },
                        user_metadata: {
                            birth_date: '2000-01-01',
                        },
                    },
                },
            },
            error: null,
        });
        mockProfileMaybeSingle.mockResolvedValue({
            data: { birth_date: null },
            error: null,
        });

        render(
            <AuthProvider>
                <AuthContextConsumer />
            </AuthProvider>
        );

        await waitFor(() => {
            expect(screen.getByTestId('authenticated-state')).toHaveTextContent('true');
            expect(screen.getByTestId('profile-completion-state')).toHaveTextContent('true');
        });
    });
});
