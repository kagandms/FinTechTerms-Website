'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import { User as SupabaseUser } from '@supabase/supabase-js';
import {
    getUserProgressFromSupabase,
} from '@/lib/supabaseStorage';
import { EMAIL_OTP_LENGTH, isValidEmailOtp } from '@/lib/auth/constants';

interface User {
    id: string;
    email: string;
    name: string;
    createdAt: string;
}

interface AuthContextType {
    user: User | null;
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

interface AuthProviderProps {
    children: ReactNode;
}

/**
 * Convert Supabase user to our User type
 */
function mapSupabaseUser(supabaseUser: SupabaseUser): User {
    return {
        id: supabaseUser.id,
        email: supabaseUser.email || '',
        name: supabaseUser.user_metadata?.full_name || supabaseUser.user_metadata?.name || supabaseUser.email?.split('@')[0] || 'User',
        createdAt: supabaseUser.created_at,
    };
}

export function AuthProvider({ children }: AuthProviderProps) {
    const [user, setUser] = useState<User | null>(null);
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
            } = await supabase.auth.getSession();

            if (session?.user) {
                return session.user;
            }

            await new Promise((resolve) => {
                window.setTimeout(resolve, 200);
            });
        }

        return null;
    }, []);

    // Initialize auth state and listen for changes
    useEffect(() => {
        // Check if we have Supabase configured
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

        if (!supabaseUrl || !supabaseKey || supabaseKey === 'your_anon_key_here') {
            console.warn('Supabase not configured, running in guest-only mode');
            setIsLoading(false);
            return;
        }

        const hydrateInitialUser = async () => {
            try {
                const { data: { session }, error: sessionError } = await supabase.auth.getSession();

                if (sessionError) {
                    console.warn('AUTH_INIT_SESSION_ERROR', sessionError);
                    setUser(null);
                    return;
                }

                if (!session?.user) {
                    setUser(null);
                    return;
                }

                if (session.user.email_confirmed_at) {
                    setUser(mapSupabaseUser(session.user));
                } else {
                    setUser(null);
                }
            } catch (error) {
                console.error('AUTH_INIT_EXCEPTION', error);
                setUser(null);
            } finally {
                setIsLoading(false);
            }
        };

        void hydrateInitialUser();

        // Listen for auth changes
        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange(async (event, session) => {
            if (event === 'PASSWORD_RECOVERY') {
                setIsPasswordRecovery(true);
            }

            if (!session?.user) {
                setUser(null);
                return;
            }

            if (!session.user.email_confirmed_at) {
                setUser(null);
                return;
            }

            setUser(mapSupabaseUser(session.user));

            // Check if user has progress, if not create it
            if (event === 'SIGNED_IN') {
                try {
                    await getUserProgressFromSupabase(session.user.id);
                } catch (error) {
                    console.error('Failed to initialize user progress:', error);
                }
            }
        });

        return () => {
            subscription.unsubscribe();
        };
    }, []);

    /**
     * Login with email and password
     */
    const login = useCallback(async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
        try {
            const { data, error } = await supabase.auth.signInWithPassword({
                email,
                password,
            });

            if (error) {
                console.error('Login error:', error.message);
                return { success: false, error: error.message };
            }

            if (data.user) {
                setUser(mapSupabaseUser(data.user));
                return { success: true };
            }

            return { success: false, error: 'Unknown error occurred' };
        } catch (error) {
            console.error('Login exception:', error);
            return { success: false, error: 'Login failed' };
        }
    }, []);

    /**
     * Register a new user with OTP verification
     */
    const register = useCallback(async (email: string, password: string, name: string, birthDate?: string): Promise<{ success: boolean; error?: string; needsOTPVerification?: boolean }> => {
        try {
            const { data, error } = await supabase.auth.signUp({
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
                console.error('Register error:', error.message);
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
            console.error('Register exception:', error);
            return { success: false, error: 'Registration failed' };
        }
    }, []);

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

            const { data, error } = await supabase.auth.verifyOtp({
                email,
                token,
                type: 'signup',
            });

            if (error) {
                console.error('OTP verification error:', error.message);
                return { success: false, error: error.message };
            }

            if (data.user) {
                let resolvedUser = data.session?.user ?? await waitForActiveSessionUser();

                if (!resolvedUser && pendingVerificationPassword) {
                    const signInResult = await supabase.auth.signInWithPassword({
                        email,
                        password: pendingVerificationPassword,
                    });

                    if (signInResult.error) {
                        console.error('OTP verification fallback sign-in error:', signInResult.error.message);
                    } else {
                        resolvedUser = signInResult.data.user ?? null;
                    }
                }

                setUser(mapSupabaseUser(resolvedUser ?? data.user));
                setPendingVerificationEmail(null);
                setPendingVerificationPassword(null);
                return { success: true };
            }

            return { success: false, error: 'Verification failed' };
        } catch (error) {
            console.error('OTP verification exception:', error);
            return { success: false, error: 'Verification failed' };
        }
    }, [pendingVerificationPassword, waitForActiveSessionUser]);

    /**
     * Resend OTP code
     */
    const resendOTP = useCallback(async (email: string): Promise<{ success: boolean; error?: string }> => {
        try {
            const { error } = await supabase.auth.resend({
                type: 'signup',
                email,
            });

            if (error) {
                console.error('Resend OTP error:', error.message);
                return { success: false, error: error.message };
            }

            return { success: true };
        } catch (error) {
            console.error('Resend OTP exception:', error);
            return { success: false, error: 'Failed to resend code' };
        }
    }, []);

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
            const { error } = await supabase.auth.resetPasswordForEmail(email, {
                redirectTo: `${window.location.origin}/profile?reset=true`,
            });

            if (error) {
                console.error('Reset password error:', error.message);
                return { success: false, error: error.message };
            }

            return { success: true };
        } catch (error) {
            console.error('Reset password exception:', error);
            return { success: false, error: 'Failed to send reset email' };
        }
    }, []);

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
            const { data: { session }, error: sessionError } = await supabase.auth.getSession();
            if (sessionError || !session) {
                console.error('UpdatePassword: Session Error', sessionError);
                return { success: false, error: 'Oturum süresi dolmuş. Lütfen tekrar deneyin.' };
            }


            // Create a temporary, fresh client just for this operation
            // This avoids any "signal is aborted" issues from the main client's global state/refresh logic
            const { createClient } = await import('@supabase/supabase-js');
            const tempClient = createClient(
                process.env.NEXT_PUBLIC_SUPABASE_URL!,
                process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
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
                console.error('UpdatePassword: Failed to set session on temp client', setSessionError);
                throw setSessionError;
            }


            const { data, error } = await tempClient.auth.updateUser({ password });

            if (error) {
                console.error('UpdatePassword Error:', error.message);
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
            console.error('UpdatePassword exception:', error);
            setIsPasswordRecovery(false);
            if (error instanceof Error) {
                if (error.name === 'AbortError' || error.message?.includes('aborted')) {
                    return { success: false, error: 'İşlem iptal edildi. Lütfen sayfayı yenileyip tekrar deneyin.' };
                }
                return { success: false, error: error.message || 'Şifre güncellenemedi.' };
            }
            return { success: false, error: 'Şifre güncellenemedi.' };
        }
    }, []);

    const logout = useCallback(async () => {
        try {
            // Clear local storage for SRS data and ALL Supabase tokens
            if (typeof window !== 'undefined') {
                localStorage.removeItem('globalfinterm_user_progress');
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
            setUser(null);
            setPendingVerificationEmail(null);
            setPendingVerificationPassword(null);

            // 3. Tell Supabase Client to nuke session globally
            const { error } = await supabase.auth.signOut({ scope: 'global' });
            if (error) {
                console.error('Supabase signOut error:', error);
            }
        } catch (error) {
            console.error('Logout handler error:', error);
        } finally {
            // Always set user to null, even if signOut fails
            setUser(null);
            // Hard reload to ensure ALL auth state is fully cleared (server-side cookies, client state, SSR cache)
            if (typeof window !== 'undefined') {
                window.location.href = '/';
            }
        }
    }, []);

    const isAuthenticated = user !== null;
    const favoriteLimit = isAuthenticated ? AUTHENTICATED_FAVORITE_LIMIT : GUEST_FAVORITE_LIMIT;

    return (
        <AuthContext.Provider
            value={{
                user,
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
