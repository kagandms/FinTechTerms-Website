'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { getSupabaseClient } from '@/lib/supabase';
import { Session, User as SupabaseUser } from '@supabase/supabase-js';
import {
    type AuthenticatedUser,
    mapSupabaseUser,
} from '@/lib/auth/user';
import {
    getUserProgressFromSupabase,
} from '@/lib/supabaseStorage';
import { EMAIL_OTP_LENGTH, isValidEmailOtp } from '@/lib/auth/constants';
import { getPublicEnv, hasConfiguredPublicSupabaseEnv } from '@/lib/env';
import { logger } from '@/lib/logger';
import { clearLegacyUserProgress, clearStoredUserProgress } from '@/utils/storage';

interface AuthContextType {
    user: AuthenticatedUser | null;
    isAdmin: boolean;
    isAuthenticated: boolean;
    isLoading: boolean;
    pendingVerificationEmail: string | null;
    isPasswordRecovery: boolean;
    login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
    register: (email: string, password: string, name: string, birthDate?: string) => Promise<{ success: boolean; error?: string; needsOTPVerification?: boolean }>;
    verifyOTP: (email: string, token: string) => Promise<{ success: boolean; error?: string }>;
    resendOTP: (email: string) => Promise<{ success: boolean; error?: string }>;
    cancelVerification: () => void;
    resetPassword: (email: string) => Promise<{ success: boolean; error?: string }>;
    updatePassword: (password: string) => Promise<{ success: boolean; error?: string }>;
    logout: () => Promise<void>;
    favoriteLimit: number;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const GUEST_FAVORITE_LIMIT = 50;
const AUTHENTICATED_FAVORITE_LIMIT = Infinity;
const AUTH_CAPABILITIES_TIMEOUT_MS = 4_000;

interface AuthProviderProps {
    children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
    const supabase = getSupabaseClient();
    const supabaseAuth = React.useMemo(() => supabase.auth, [supabase]);
    const [user, setUser] = useState<AuthenticatedUser | null>(null);
    const currentUserId = user?.id ?? null;
    const [isAdmin, setIsAdmin] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [pendingVerificationEmail, setPendingVerificationEmail] = useState<string | null>(null);
    const [pendingVerificationPassword, setPendingVerificationPassword] = useState<string | null>(null);
    const [isPasswordRecovery, setIsPasswordRecovery] = useState(() => {
        // Check URL immediately on initialization (before Supabase clears the hash)
        if (typeof window !== 'undefined') {
            const urlParams = new URLSearchParams(window.location.search);
            const hash = window.location.hash;
            const isReset = urlParams.get('reset') === 'true';
            const isRecoveryType = urlParams.get('type') === 'recovery';
            const isRecoveryInHash = hash.includes('type=recovery');

            if (isReset || isRecoveryType || isRecoveryInHash) {
                return true;
            }
        }
        return false;
    });

    const waitForActiveSessionUser = useCallback(async (): Promise<SupabaseUser | null> => {
        for (let attempt = 0; attempt < 5; attempt += 1) {
            const {
                data: { session },
            } = await supabaseAuth.getSession();

            if (session?.user) {
                return session.user;
            }

            await new Promise((resolve) => {
                window.setTimeout(resolve, 200);
            });
        }

        return null;
    }, [supabaseAuth]);

    const fetchCapabilitiesWithTimeout = useCallback(async (accessToken: string): Promise<boolean> => {
        const controller = new AbortController();
        const timeoutId = window.setTimeout(() => {
            controller.abort();
        }, AUTH_CAPABILITIES_TIMEOUT_MS);

        try {
            const response = await fetch('/api/auth/capabilities', {
                method: 'GET',
                credentials: 'same-origin',
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                },
                cache: 'no-store',
                signal: controller.signal,
            });

            if (!response.ok) {
                return false;
            }

            const payload = await response.json();
            return payload?.isAdmin === true;
        } finally {
            window.clearTimeout(timeoutId);
        }
    }, []);

    const refreshCapabilities = useCallback(async (session: Session | null): Promise<void> => {
        if (!session?.access_token) {
            setIsAdmin(false);
            return;
        }

        try {
            setIsAdmin(await fetchCapabilitiesWithTimeout(session.access_token));
        } catch (error) {
            logger.warn('AUTH_CAPABILITIES_FETCH_FAILED', {
                route: 'AuthProvider',
                error: error instanceof Error ? error : undefined,
            });
            setIsAdmin(false);
        }
    }, [fetchCapabilitiesWithTimeout]);

    // Initialize auth state and listen for changes
    useEffect(() => {
        // Check if we have Supabase configured
        const env = getPublicEnv();

        if (!hasConfiguredPublicSupabaseEnv(env)) {
            logger.warn('Supabase not configured, running in guest-only mode', {
                route: 'AuthProvider',
            });
            setIsAdmin(false);
            setIsLoading(false);
            return;
        }

        const hydrateInitialUser = async () => {
            try {
                const { data: { session }, error: sessionError } = await supabaseAuth.getSession();

                if (sessionError) {
                    logger.warn('AUTH_INIT_SESSION_ERROR', {
                        route: 'AuthProvider',
                        error: sessionError,
                    });
                    setIsAdmin(false);
                    setUser(null);
                    return;
                }

                if (!session?.user) {
                    setIsAdmin(false);
                    setUser(null);
                    return;
                }

                setUser(mapSupabaseUser(session.user));
                void refreshCapabilities(session);
            } catch (error) {
                logger.error('AUTH_INIT_EXCEPTION', {
                    route: 'AuthProvider',
                    error: error instanceof Error ? error : undefined,
                });
                setIsAdmin(false);
                setUser(null);
            } finally {
                setIsLoading(false);
            }
        };

        void hydrateInitialUser();

        // Listen for auth changes
        const {
            data: { subscription },
        } = supabaseAuth.onAuthStateChange(async (event, session) => {
            if (event === 'PASSWORD_RECOVERY') {
                setIsPasswordRecovery(true);
            }

            if (!session?.user) {
                setIsAdmin(false);
                setUser(null);
                return;
            }

            setUser(mapSupabaseUser(session.user));
            void refreshCapabilities(session);

            // Check if user has progress, if not create it
            if (event === 'SIGNED_IN') {
                try {
                    await getUserProgressFromSupabase(session.user.id);
                } catch (error) {
                    logger.error('AUTH_PROGRESS_INIT_FAILED', {
                        route: 'AuthProvider',
                        userId: session.user.id,
                        error: error instanceof Error ? error : undefined,
                    });
                }
            }
        });

        return () => {
            subscription.unsubscribe();
        };
    }, [refreshCapabilities, supabaseAuth]);

    /**
     * Login with email and password
     */
    const login = useCallback(async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
        try {
            const { data, error } = await supabaseAuth.signInWithPassword({
                email,
                password,
            });

            if (error) {
                logger.error('AUTH_LOGIN_ERROR', {
                    route: 'AuthProvider',
                    error,
                });
                return { success: false, error: error.message };
            }

            if (data.user) {
                setUser(mapSupabaseUser(data.user));
                void refreshCapabilities(data.session ?? null);
                return { success: true };
            }

            return { success: false, error: 'Unknown error occurred' };
        } catch (error) {
            logger.error('AUTH_LOGIN_EXCEPTION', {
                route: 'AuthProvider',
                error: error instanceof Error ? error : undefined,
            });
            return { success: false, error: 'Login failed' };
        }
    }, [refreshCapabilities, supabaseAuth]);

    /**
     * Register a new user with OTP verification
     */
    const register = useCallback(async (email: string, password: string, name: string, birthDate?: string): Promise<{ success: boolean; error?: string; needsOTPVerification?: boolean }> => {
        try {
            const { data, error } = await supabaseAuth.signUp({
                email,
                password,
                options: {
                    data: {
                        name,
                        birth_date: birthDate,
                    },
                    // Use OTP instead of magic link
                    emailRedirectTo: undefined,
                },
            });

            if (error) {
                logger.error('AUTH_REGISTER_ERROR', {
                    route: 'AuthProvider',
                    error,
                });
                return { success: false, error: error.message };
            }

            if (data.user && data.session) {
                setUser(mapSupabaseUser(data.user));
                return { success: true };
            }

            if (data.user && !data.session) {
                // Check if user already exists (identities will be empty for existing users)
                if (data.user.identities && data.user.identities.length === 0) {
                    return {
                        success: false,
                        error: 'This email is already registered. Please log in instead.'
                    };
                }

                // New user created, OTP verification required
                setPendingVerificationEmail(email);
                setPendingVerificationPassword(password);
                return { success: true, needsOTPVerification: true };
            }

            return { success: false, error: 'Unknown error occurred' };
        } catch (error) {
            logger.error('AUTH_REGISTER_EXCEPTION', {
                route: 'AuthProvider',
                error: error instanceof Error ? error : undefined,
            });
            return { success: false, error: 'Registration failed' };
        }
    }, [supabaseAuth]);

    /**
     * Verify OTP code sent to email
     */
    const verifyOTP = useCallback(async (email: string, token: string): Promise<{ success: boolean; error?: string }> => {
        try {
            if (!isValidEmailOtp(token)) {
                return {
                    success: false,
                    error: `Verification code must be exactly ${EMAIL_OTP_LENGTH} digits.`,
                };
            }

            const { data, error } = await supabaseAuth.verifyOtp({
                email,
                token,
                type: 'signup',
            });

            if (error) {
                logger.error('AUTH_VERIFY_OTP_ERROR', {
                    route: 'AuthProvider',
                    error,
                });
                return { success: false, error: error.message };
            }

            if (data.user) {
                let resolvedUser = data.session?.user ?? await waitForActiveSessionUser();

                if (!resolvedUser && pendingVerificationPassword) {
                    const signInResult = await supabaseAuth.signInWithPassword({
                        email,
                        password: pendingVerificationPassword,
                    });

                    if (signInResult.error) {
                        logger.error('AUTH_VERIFY_OTP_FALLBACK_SIGNIN_ERROR', {
                            route: 'AuthProvider',
                            error: signInResult.error,
                        });
                    } else {
                        resolvedUser = signInResult.data.user ?? null;
                    }
                }

                setUser(mapSupabaseUser(resolvedUser ?? data.user));
                setPendingVerificationEmail(null);
                setPendingVerificationPassword(null);
                void refreshCapabilities(data.session ?? null);
                return { success: true };
            }

            return { success: false, error: 'Verification failed' };
        } catch (error) {
            logger.error('AUTH_VERIFY_OTP_EXCEPTION', {
                route: 'AuthProvider',
                error: error instanceof Error ? error : undefined,
            });
            return { success: false, error: 'Verification failed' };
        }
    }, [pendingVerificationPassword, refreshCapabilities, supabaseAuth, waitForActiveSessionUser]);

    /**
     * Resend OTP code
     */
    const resendOTP = useCallback(async (email: string): Promise<{ success: boolean; error?: string }> => {
        try {
            const { error } = await supabaseAuth.resend({
                type: 'signup',
                email,
            });

            if (error) {
                logger.error('AUTH_RESEND_OTP_ERROR', {
                    route: 'AuthProvider',
                    error,
                });
                return { success: false, error: error.message };
            }

            return { success: true };
        } catch (error) {
            logger.error('AUTH_RESEND_OTP_EXCEPTION', {
                route: 'AuthProvider',
                error: error instanceof Error ? error : undefined,
            });
            return { success: false, error: 'Failed to resend code' };
        }
    }, [supabaseAuth]);

    /**
     * Cancel pending verification
     */
    const cancelVerification = useCallback(() => {
        setPendingVerificationEmail(null);
        setPendingVerificationPassword(null);
    }, []);

    /**
     * Logout the current user
     */
    /**
     * Send password reset email
     */
    const resetPassword = useCallback(async (email: string): Promise<{ success: boolean; error?: string }> => {
        try {
            const { error } = await supabaseAuth.resetPasswordForEmail(email, {
                redirectTo: `${window.location.origin}/profile?reset=true`,
            });

            if (error) {
                logger.error('AUTH_RESET_PASSWORD_ERROR', {
                    route: 'AuthProvider',
                    error,
                });
                return { success: false, error: error.message };
            }

            return { success: true };
        } catch (error) {
            logger.error('AUTH_RESET_PASSWORD_EXCEPTION', {
                route: 'AuthProvider',
                error: error instanceof Error ? error : undefined,
            });
            return { success: false, error: 'Failed to send reset email' };
        }
    }, [supabaseAuth]);

    /**
     * Update the user's password during a recovery flow.
     *
     * SECURITY NOTE: A temporary, ephemeral Supabase client is intentionally
     * created here to avoid "signal is aborted" errors caused by the main
     * client's global auth state refresh logic. This temp client:
     * - Does NOT persist its session to localStorage (persistSession: false)
     * - Does NOT auto-refresh tokens (autoRefreshToken: false)
     * - Is hydrated with the current session's tokens, then discarded
     *
     * This pattern is a workaround for a known Supabase JS client issue where
     * concurrent auth operations on a shared client can abort in-flight requests.
     */
    const updatePassword = useCallback(async (password: string): Promise<{ success: boolean; error?: string }> => {
        try {
            // Validate session existence first from main client
            const { data: { session }, error: sessionError } = await supabaseAuth.getSession();
            if (sessionError || !session) {
                logger.error('AUTH_UPDATE_PASSWORD_SESSION_ERROR', {
                    route: 'AuthProvider',
                    error: sessionError ?? undefined,
                });
                return { success: false, error: 'Oturum süresi dolmuş. Lütfen tekrar deneyin.' };
            }


            // Create a temporary, fresh client just for this operation
            // This avoids any "signal is aborted" issues from the main client's global state/refresh logic
            const { createClient } = await import('@supabase/supabase-js');
            const env = getPublicEnv();
            const tempClient = createClient(
                env.supabaseUrl!,
                env.supabaseAnonKey!,
                {
                    auth: {
                        persistSession: false, // Don't mess with localStorage
                        autoRefreshToken: false,
                        detectSessionInUrl: false
                    }
                }
            );

            // Hydrate the fresh client with our active session
            const { error: setSessionError } = await tempClient.auth.setSession({
                access_token: session.access_token,
                refresh_token: session.refresh_token,
            });

            if (setSessionError) {
                logger.error('AUTH_UPDATE_PASSWORD_SET_SESSION_ERROR', {
                    route: 'AuthProvider',
                    error: setSessionError,
                });
                throw setSessionError;
            }


            const { data, error } = await tempClient.auth.updateUser({ password });

            if (error) {
                logger.error('AUTH_UPDATE_PASSWORD_ERROR', {
                    route: 'AuthProvider',
                    error,
                });
                setIsPasswordRecovery(false);
                return { success: false, error: error.message };
            }

            if (data?.user) {
                setIsPasswordRecovery(false);
                return { success: true };
            }

            setIsPasswordRecovery(false);
            return { success: false, error: 'Beklenmeyen bir durum oluştu.' };

        } catch (error: unknown) {
            logger.error('AUTH_UPDATE_PASSWORD_EXCEPTION', {
                route: 'AuthProvider',
                error: error instanceof Error ? error : undefined,
            });
            setIsPasswordRecovery(false);
            if (error instanceof Error) {
                if (error.name === 'AbortError' || error.message?.includes('aborted')) {
                    return { success: false, error: 'İşlem iptal edildi. Lütfen sayfayı yenileyip tekrar deneyin.' };
                }
                return { success: false, error: error.message || 'Şifre güncellenemedi.' };
            }
            return { success: false, error: 'Şifre güncellenemedi.' };
        }
    }, [supabaseAuth]);

    const logout = useCallback(async () => {
        try {
            // Clear local storage for SRS data and ALL Supabase tokens
            if (typeof window !== 'undefined') {
                if (currentUserId) {
                    clearStoredUserProgress(currentUserId);
                }
                clearLegacyUserProgress();
                // Remove all Supabase session tokens from localStorage
                Object.keys(localStorage).forEach(key => {
                    if (key.startsWith('sb-')) {
                        localStorage.removeItem(key);
                    }
                });
            }

            // 1. First, tell the Next.js Server to clear all HttpOnly secure cookies
            await fetch('/api/auth/signout', { method: 'POST' });

            // 2. Optimistic Logout: Clear state immediately
            setIsAdmin(false);
            setUser(null);
            setPendingVerificationEmail(null);
            setPendingVerificationPassword(null);

            // 3. Tell Supabase Client to nuke session globally
            const { error } = await supabaseAuth.signOut({ scope: 'global' });
            if (error) {
                logger.error('AUTH_SIGNOUT_ERROR', {
                    route: 'AuthProvider',
                    error,
                });
            }
        } catch (error) {
            logger.error('AUTH_LOGOUT_EXCEPTION', {
                route: 'AuthProvider',
                error: error instanceof Error ? error : undefined,
            });
        } finally {
            // Always set user to null, even if signOut fails
            setIsAdmin(false);
            setUser(null);
            // Hard reload to ensure ALL auth state is fully cleared (server-side cookies, client state, SSR cache)
            if (typeof window !== 'undefined') {
                window.location.href = '/';
            }
        }
    }, [currentUserId, supabaseAuth]);

    const isAuthenticated = user !== null;
    const favoriteLimit = isAuthenticated ? AUTHENTICATED_FAVORITE_LIMIT : GUEST_FAVORITE_LIMIT;

    return (
        <AuthContext.Provider
            value={{
                user,
                isAdmin,
                isAuthenticated,
                isLoading,
                pendingVerificationEmail,
                isPasswordRecovery,
                login,
                register,
                verifyOTP,
                resendOTP,
                cancelVerification,
                resetPassword,
                updatePassword,
                logout,
                favoriteLimit,
            }}
        >
            {children}
        </AuthContext.Provider>
    );
}

/**
 * Hook to access auth context
 */
export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}
