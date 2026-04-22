'use client';

import React, {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useState,
    type ReactNode,
} from 'react';
import { getPublicEnv, hasConfiguredPublicSupabaseEnv } from '@/lib/env';
import { createBrowserClient } from '@supabase/ssr';
import { logger } from '@/lib/logger';
import { clearLegacyUserProgress, clearStoredUserProgress } from '@/utils/storage';
import {
    type MemberEntitlements,
    resolveMemberEntitlements,
} from '@/lib/member-entitlements';
import { type AuthenticatedUser } from '@/lib/auth/user';
import { type AuthSessionState } from '@/lib/auth/session-state.types';

interface AuthContextType {
    user: AuthenticatedUser | null;
    isAdmin: boolean;
    isAuthenticated: boolean;
    isLoading: boolean;
    entitlements: MemberEntitlements;
    requiresProfileCompletion: boolean;
    pendingVerificationEmail: string | null;
    isPasswordRecovery: boolean;
    login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
    signInWithGoogle: () => Promise<{ success: boolean; error?: string }>;
    register: (email: string, password: string, name: string, birthDate?: string) => Promise<{ success: boolean; error?: string; needsOTPVerification?: boolean }>;
    verifyOTP: (email: string, token: string) => Promise<{ success: boolean; error?: string }>;
    resendOTP: (email: string) => Promise<{ success: boolean; error?: string }>;
    cancelVerification: () => void;
    resetPassword: (email: string) => Promise<{ success: boolean; error?: string }>;
    updatePassword: (password: string) => Promise<{ success: boolean; error?: string }>;
    logout: () => Promise<{ success: boolean; error?: string }>;
    refreshMemberState: () => Promise<void>;
    favoriteLimit: number;
}

interface AuthProviderProps {
    children: ReactNode;
}

interface AuthRouteSuccessPayload {
    success?: boolean;
    needsOTPVerification?: boolean;
}

interface AuthRouteErrorPayload {
    message?: string;
}

const SIGNOUT_FAILED_MESSAGE = 'Unable to sign out. Please try again.';
const AUTH_INIT_TIMEOUT_MS = 4_000;
const AUTH_ROUTE_TIMEOUT_MS = 4_000;
const AUTH_SESSION_SYNC_ATTEMPTS = 5;
const AUTH_SESSION_SYNC_DELAY_MS = 250;
const AUTH_SESSION_SYNC_ROUTE_TIMEOUT_MS = 1_500;
const DEFAULT_AUTH_SESSION_STATE: AuthSessionState = {
    user: null,
    isAuthenticated: false,
    isAdmin: false,
    entitlements: resolveMemberEntitlements({
        isAuthenticated: false,
        requiresProfileCompletion: false,
    }),
    requiresProfileCompletion: false,
    memberStateUnavailable: false,
};

const normalizeSessionState = (payload: Partial<AuthSessionState> | null | undefined): AuthSessionState => {
    const user = payload?.user ?? null;
    const requiresProfileCompletion = typeof payload?.requiresProfileCompletion === 'boolean'
        ? payload.requiresProfileCompletion
        : false;
    const entitlements = payload?.entitlements ?? resolveMemberEntitlements({
        isAuthenticated: user !== null,
        requiresProfileCompletion,
    });

    return {
        user,
        isAuthenticated: user !== null,
        isAdmin: payload?.isAdmin === true,
        entitlements,
        requiresProfileCompletion: typeof payload?.requiresProfileCompletion === 'boolean'
            ? payload.requiresProfileCompletion
            : entitlements.requiresProfileCompletion,
        memberStateUnavailable: payload?.memberStateUnavailable === true,
    };
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const readSignoutRouteMessage = async (response: Response): Promise<string> => {
    try {
        const payload = await response.json();
        if (payload && typeof payload.message === 'string' && payload.message.trim().length > 0) {
            return payload.message;
        }
    } catch {
        // Fall back to the generic sign-out error message.
    }

    return SIGNOUT_FAILED_MESSAGE;
};

const clearLocalAuthArtifacts = (currentUserId: string | null): void => {
    if (typeof window === 'undefined') {
        return;
    }

    if (currentUserId) {
        clearStoredUserProgress(currentUserId);
    }

    clearLegacyUserProgress();
    Object.keys(localStorage).forEach((key) => {
        if (key.startsWith('sb-')) {
            localStorage.removeItem(key);
        }
    });
};

const getRecoveryParamsFromLocation = (): URLSearchParams | null => {
    if (typeof window === 'undefined') {
        return null;
    }

    const hash = window.location.hash.startsWith('#')
        ? window.location.hash.slice(1)
        : window.location.hash;

    return hash ? new URLSearchParams(hash) : null;
};

const hasRecoveryModeSignal = (): boolean => {
    if (typeof window === 'undefined') {
        return false;
    }

    const query = new URLSearchParams(window.location.search);
    const hashParams = getRecoveryParamsFromLocation();

    return (
        query.get('reset') === 'true'
        || query.get('type') === 'recovery'
        || hashParams?.get('type') === 'recovery'
    );
};

const clearRecoveryHash = (): void => {
    if (typeof window === 'undefined') {
        return;
    }

    const nextUrl = `${window.location.pathname}${window.location.search}`;
    window.history.replaceState({}, document.title, nextUrl);
};

const readJsonResponse = async <T,>(response: Response, fallbackMessage: string): Promise<T> => {
    try {
        return await response.json() as T;
    } catch {
        throw new Error(fallbackMessage);
    }
};

const fetchWithTimeout = async (
    input: RequestInfo | URL,
    init: RequestInit,
    timeoutMessage: string,
    timeoutMs = AUTH_ROUTE_TIMEOUT_MS
): Promise<Response> => {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => {
        controller.abort();
    }, timeoutMs);

    try {
        return await fetch(input, {
            ...init,
            credentials: 'same-origin',
            cache: 'no-store',
            signal: controller.signal,
        });
    } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
            throw new Error(timeoutMessage);
        }

        throw error;
    } finally {
        window.clearTimeout(timeoutId);
    }
};

const readRouteErrorMessage = async (response: Response, fallbackMessage: string): Promise<string> => {
    try {
        const payload = await response.json() as AuthRouteErrorPayload;
        if (typeof payload.message === 'string' && payload.message.trim().length > 0) {
            return payload.message;
        }
    } catch {
        // Fall back to the generic route error message.
    }

    return fallbackMessage;
};

const waitForDelay = async (delayMs: number): Promise<void> => {
    await new Promise<void>((resolve) => {
        window.setTimeout(resolve, delayMs);
    });
};

export function AuthProvider({ children }: AuthProviderProps) {
    const [user, setUser] = useState<AuthenticatedUser | null>(null);
    const [isAdmin, setIsAdmin] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [entitlements, setEntitlements] = useState<MemberEntitlements>(DEFAULT_AUTH_SESSION_STATE.entitlements);
    const [requiresProfileCompletion, setRequiresProfileCompletion] = useState(false);
    const [pendingVerificationEmail, setPendingVerificationEmail] = useState<string | null>(null);
    const [pendingVerificationPassword, setPendingVerificationPassword] = useState<string | null>(null);
    const [isPasswordRecovery, setIsPasswordRecovery] = useState(hasRecoveryModeSignal);
    const currentUserId = user?.id ?? null;

    const applySessionState = useCallback((sessionState: AuthSessionState): void => {
        setUser(sessionState.user);
        setIsAdmin(sessionState.isAdmin);
        setEntitlements(sessionState.entitlements);
        setRequiresProfileCompletion(sessionState.requiresProfileCompletion);
    }, []);

    const loadSessionState = useCallback(async (
        timeoutMs = AUTH_ROUTE_TIMEOUT_MS
    ): Promise<AuthSessionState> => {
        const response = await fetchWithTimeout(
            '/api/auth/session',
            {
                method: 'GET',
            },
            'Unable to load the current session.',
            timeoutMs
        );

        if (!response.ok) {
            throw new Error(await readRouteErrorMessage(response, 'Unable to load the current session.'));
        }

        const payload = await readJsonResponse<Partial<AuthSessionState>>(response, 'Unable to load the current session.');
        return normalizeSessionState(payload);
    }, []);

    const refreshMemberState = useCallback(async (): Promise<void> => {
        try {
            const sessionState = await loadSessionState();
            applySessionState(sessionState);
        } catch (error) {
            logger.warn('AUTH_MEMBER_STATE_REFRESH_FAILED', {
                route: 'AuthProvider',
                error: error instanceof Error ? error : undefined,
            });
        }
    }, [applySessionState, loadSessionState]);

    const syncSessionState = useCallback(async (expectedAuthenticated: boolean): Promise<AuthSessionState> => {
        let lastError: Error | null = null;
        let latestState = DEFAULT_AUTH_SESSION_STATE;

        for (let attempt = 0; attempt < AUTH_SESSION_SYNC_ATTEMPTS; attempt += 1) {
            try {
                latestState = await loadSessionState(AUTH_SESSION_SYNC_ROUTE_TIMEOUT_MS);
                applySessionState(latestState);

                if (latestState.isAuthenticated === expectedAuthenticated) {
                    return latestState;
                }
            } catch (error) {
                lastError = error instanceof Error
                    ? error
                    : new Error('Unable to synchronize the current session.');
            }

            if (attempt < AUTH_SESSION_SYNC_ATTEMPTS - 1) {
                await waitForDelay(AUTH_SESSION_SYNC_DELAY_MS);
            }
        }

        if (lastError) {
            throw lastError;
        }

        throw new Error(expectedAuthenticated
            ? 'Unable to establish authenticated session.'
            : 'Unable to confirm signed-out session.');
    }, [applySessionState, loadSessionState]);

    useEffect(() => {
        const env = getPublicEnv();

        if (!hasConfiguredPublicSupabaseEnv(env)) {
            logger.warn('AUTH_RUNTIME_NOT_CONFIGURED', {
                route: 'AuthProvider',
            });
            applySessionState(DEFAULT_AUTH_SESSION_STATE);
            setIsLoading(false);
            return;
        }

        let isMounted = true;
        const timeoutId = window.setTimeout(() => {
            if (!isMounted) {
                return;
            }

            setIsLoading(false);
            logger.warn('AUTH_INIT_TIMEOUT_FALLBACK', {
                route: 'AuthProvider',
            });
        }, AUTH_INIT_TIMEOUT_MS);

        const hydrateInitialUser = async () => {
            try {
                const hashParams = getRecoveryParamsFromLocation();
                const accessToken = hashParams?.get('access_token');
                const refreshToken = hashParams?.get('refresh_token');
                const isRecoveryHash = hashParams?.get('type') === 'recovery';

                if (isRecoveryHash && accessToken && refreshToken) {
                    const recoveryResponse = await fetchWithTimeout(
                        '/api/auth/recovery/exchange',
                        {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                            },
                            body: JSON.stringify({
                                accessToken,
                                refreshToken,
                            }),
                        },
                        'Unable to establish the recovery session.'
                    );

                    if (!recoveryResponse.ok) {
                        throw new Error(await readRouteErrorMessage(recoveryResponse, 'Unable to establish the recovery session.'));
                    }

                    clearRecoveryHash();
                    if (isMounted) {
                        setIsPasswordRecovery(true);
                    }
                }

                const sessionState = await loadSessionState();
                if (!isMounted) {
                    return;
                }

                applySessionState(sessionState);
            } catch (error) {
                logger.error('AUTH_INIT_EXCEPTION', {
                    route: 'AuthProvider',
                    error: error instanceof Error ? error : undefined,
                });
                if (isMounted) {
                    applySessionState(DEFAULT_AUTH_SESSION_STATE);
                }
            } finally {
                if (isMounted) {
                    window.clearTimeout(timeoutId);
                    setIsLoading(false);
                }
            }
        };

        void hydrateInitialUser();

        const handleFocus = () => {
            void refreshMemberState();
        };

        window.addEventListener('focus', handleFocus);

        return () => {
            isMounted = false;
            window.clearTimeout(timeoutId);
            window.removeEventListener('focus', handleFocus);
        };
    }, [applySessionState, loadSessionState, refreshMemberState]);

    const login = useCallback(async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
        try {
            const response = await fetchWithTimeout(
                '/api/auth/login',
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        email,
                        password,
                    }),
                },
                'Unable to sign in.'
            );

            if (!response.ok) {
                return {
                    success: false,
                    error: await readRouteErrorMessage(response, 'Unable to sign in.'),
                };
            }

            return { success: true };
        } catch (error) {
            logger.error('AUTH_LOGIN_EXCEPTION', {
                route: 'AuthProvider',
                error: error instanceof Error ? error : undefined,
            });
            return { success: false, error: 'Login failed' };
        }
    }, []);

    const signInWithGoogle = useCallback(async (): Promise<{ success: boolean; error?: string }> => {
        try {
            const env = getPublicEnv();
            if (!env.supabaseUrl || !env.supabaseAnonKey) {
                return { success: false, error: 'Supabase URL/Key missing' };
            }
            
            // Initiate OAuth flow directly from the client to preserve PKCE verification state in local storage/cookies
            const supabaseBrowser = createBrowserClient(env.supabaseUrl, env.supabaseAnonKey);
            const redirectTo = `${window.location.origin}/api/auth/callback?next=${encodeURIComponent('/profile?complete=1')}`;
            
            const { error } = await supabaseBrowser.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    redirectTo,
                },
            });
            
            if (error) throw error;
            return { success: true };
        } catch (error) {
            logger.error('AUTH_GOOGLE_SIGNIN_EXCEPTION', {
                route: 'AuthProvider',
                error: error instanceof Error ? error : undefined,
            });
            return { success: false, error: 'Google sign-in failed' };
        }
    }, []);

    const register = useCallback(async (
        email: string,
        password: string,
        name: string,
        birthDate?: string
    ): Promise<{ success: boolean; error?: string; needsOTPVerification?: boolean }> => {
        try {
            const response = await fetchWithTimeout(
                '/api/auth/signup',
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        email,
                        password,
                        name,
                        birthDate,
                    }),
                },
                'Unable to create the account.'
            );

            if (!response.ok) {
                return {
                    success: false,
                    error: await readRouteErrorMessage(response, 'Unable to create the account.'),
                };
            }

            const payload = await readJsonResponse<AuthRouteSuccessPayload>(
                response,
                'Unable to create the account.'
            );

            if (payload.needsOTPVerification) {
                setPendingVerificationEmail(email);
                setPendingVerificationPassword(password);
                return { success: true, needsOTPVerification: true };
            }

            const sessionState = await syncSessionState(true);
            if (!sessionState.isAuthenticated || !sessionState.user) {
                return {
                    success: false,
                    error: 'Unable to establish authenticated session.',
                };
            }

            return { success: true };
        } catch (error) {
            logger.error('AUTH_REGISTER_EXCEPTION', {
                route: 'AuthProvider',
                error: error instanceof Error ? error : undefined,
            });
            return { success: false, error: 'Registration failed' };
        }
    }, [syncSessionState]);

    const verifyOTP = useCallback(async (email: string, token: string): Promise<{ success: boolean; error?: string }> => {
        try {
            const response = await fetchWithTimeout(
                '/api/auth/verify-otp',
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        email,
                        token,
                        password: pendingVerificationPassword ?? undefined,
                    }),
                },
                'Unable to verify the OTP code.'
            );

            if (!response.ok) {
                return {
                    success: false,
                    error: await readRouteErrorMessage(response, 'Unable to verify the OTP code.'),
                };
            }

            setPendingVerificationEmail(null);
            setPendingVerificationPassword(null);
            const sessionState = await syncSessionState(true);
            if (!sessionState.isAuthenticated || !sessionState.user) {
                return {
                    success: false,
                    error: 'Unable to establish authenticated session.',
                };
            }

            return { success: true };
        } catch (error) {
            logger.error('AUTH_VERIFY_OTP_EXCEPTION', {
                route: 'AuthProvider',
                error: error instanceof Error ? error : undefined,
            });
            return { success: false, error: 'Verification failed' };
        }
    }, [pendingVerificationPassword, syncSessionState]);

    const resendOTP = useCallback(async (email: string): Promise<{ success: boolean; error?: string }> => {
        try {
            const response = await fetchWithTimeout(
                '/api/auth/resend-otp',
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ email }),
                },
                'Unable to resend the OTP code.'
            );

            if (!response.ok) {
                return {
                    success: false,
                    error: await readRouteErrorMessage(response, 'Unable to resend the OTP code.'),
                };
            }

            return { success: true };
        } catch (error) {
            logger.error('AUTH_RESEND_OTP_EXCEPTION', {
                route: 'AuthProvider',
                error: error instanceof Error ? error : undefined,
            });
            return { success: false, error: 'Failed to resend code' };
        }
    }, []);

    const cancelVerification = useCallback(() => {
        setPendingVerificationEmail(null);
        setPendingVerificationPassword(null);
    }, []);

    const resetPassword = useCallback(async (email: string): Promise<{ success: boolean; error?: string }> => {
        try {
            const response = await fetchWithTimeout(
                '/api/auth/reset-password',
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ email }),
                },
                'Unable to send the password reset email.'
            );

            if (!response.ok) {
                return {
                    success: false,
                    error: await readRouteErrorMessage(response, 'Unable to send the password reset email.'),
                };
            }

            return { success: true };
        } catch (error) {
            logger.error('AUTH_RESET_PASSWORD_EXCEPTION', {
                route: 'AuthProvider',
                error: error instanceof Error ? error : undefined,
            });
            return { success: false, error: 'Failed to send reset email' };
        }
    }, []);

    const updatePassword = useCallback(async (password: string): Promise<{ success: boolean; error?: string }> => {
        try {
            const response = await fetchWithTimeout(
                '/api/auth/update-password',
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ password }),
                },
                'Unable to update the password.'
            );

            if (!response.ok) {
                return {
                    success: false,
                    error: await readRouteErrorMessage(response, 'Unable to update the password.'),
                };
            }

            setIsPasswordRecovery(false);
            await refreshMemberState();
            return { success: true };
        } catch (error) {
            logger.error('AUTH_UPDATE_PASSWORD_EXCEPTION', {
                route: 'AuthProvider',
                error: error instanceof Error ? error : undefined,
            });
            return { success: false, error: 'Şifre güncellenemedi.' };
        }
    }, [refreshMemberState]);

    const logout = useCallback(async (): Promise<{ success: boolean; error?: string }> => {
        try {
            const response = await fetchWithTimeout(
                '/api/auth/signout',
                {
                    method: 'POST',
                },
                SIGNOUT_FAILED_MESSAGE
            );

            if (!response.ok) {
                logger.warn('AUTH_SIGNOUT_ROUTE_FAILED', {
                    route: 'AuthProvider',
                    status: response.status,
                });
                return {
                    success: false,
                    error: await readSignoutRouteMessage(response),
                };
            }

            clearLocalAuthArtifacts(currentUserId);
            applySessionState(DEFAULT_AUTH_SESSION_STATE);
            setPendingVerificationEmail(null);
            setPendingVerificationPassword(null);
            setIsPasswordRecovery(false);

            if (typeof window !== 'undefined') {
                window.location.href = '/';
            }

            return { success: true };
        } catch (error) {
            logger.error('AUTH_LOGOUT_EXCEPTION', {
                route: 'AuthProvider',
                error: error instanceof Error ? error : undefined,
            });
            return {
                success: false,
                error: SIGNOUT_FAILED_MESSAGE,
            };
        }
    }, [applySessionState, currentUserId]);

    const isAuthenticated = user !== null;
    const favoriteLimit = entitlements.maxFavorites;

    const contextValue = useMemo<AuthContextType>(() => ({
        user,
        isAdmin,
        isAuthenticated,
        isLoading,
        entitlements,
        requiresProfileCompletion,
        pendingVerificationEmail,
        isPasswordRecovery,
        login,
        signInWithGoogle,
        register,
        verifyOTP,
        resendOTP,
        cancelVerification,
        resetPassword,
        updatePassword,
        logout,
        refreshMemberState,
        favoriteLimit,
    }), [
        cancelVerification,
        entitlements,
        favoriteLimit,
        isAdmin,
        isAuthenticated,
        isLoading,
        isPasswordRecovery,
        login,
        logout,
        pendingVerificationEmail,
        refreshMemberState,
        register,
        resendOTP,
        requiresProfileCompletion,
        resetPassword,
        signInWithGoogle,
        updatePassword,
        user,
        verifyOTP,
    ]);

    return (
        <AuthContext.Provider value={contextValue}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}
