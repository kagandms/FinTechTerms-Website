'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { User as SupabaseUser } from '@supabase/supabase-js';
import {
    getUserProgressFromSupabase,
    createUserProgress,
} from '@/lib/supabaseStorage';

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
    register: (email: string, password: string, name: string) => Promise<{ success: boolean; error?: string; needsOTPVerification?: boolean }>;
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
        name: supabaseUser.user_metadata?.name || supabaseUser.email?.split('@')[0] || 'User',
        createdAt: supabaseUser.created_at,
    };
}

export function AuthProvider({ children }: AuthProviderProps) {
    const router = useRouter();
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [pendingVerificationEmail, setPendingVerificationEmail] = useState<string | null>(null);
    const [isPasswordRecovery, setIsPasswordRecovery] = useState(() => {
        // Check URL immediately on initialization (before Supabase clears the hash)
        if (typeof window !== 'undefined') {
            const urlParams = new URLSearchParams(window.location.search);
            const hash = window.location.hash;
            const isReset = urlParams.get('reset') === 'true';
            const isRecoveryType = urlParams.get('type') === 'recovery';
            const isRecoveryInHash = hash.includes('type=recovery');

            if (isReset || isRecoveryType || isRecoveryInHash) {
                console.log('AuthContext: Password recovery detected from URL on init');
                return true;
            }
        }
        return false;
    });

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

        // Get initial session
        supabase.auth.getSession().then(({ data: { session } }) => {
            if (session?.user) {
                // Only set user if email is confirmed
                if (session.user.email_confirmed_at) {
                    setUser(mapSupabaseUser(session.user));
                }
            }
            setIsLoading(false);
        });

        // Listen for auth changes
        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange(async (event, session) => {
            console.log('Auth event:', event);
            if (event === 'PASSWORD_RECOVERY') {
                console.log('PASSWORD_RECOVERY event fired');
                setIsPasswordRecovery(true);
            }

            if (session?.user) {
                // Only allow login if email is confirmed
                if (!session.user.email_confirmed_at) {
                    // Email not confirmed, don't set user as logged in
                    setUser(null);
                    return;
                }

                setUser(mapSupabaseUser(session.user));

                // Check if user has progress, if not create it
                if (event === 'SIGNED_IN') {
                    try {
                        const progress = await getUserProgressFromSupabase(session.user.id);
                        if (!progress) {
                            await createUserProgress(session.user.id);
                        }
                    } catch (error) {
                        console.error('Failed to initialize user progress:', error);
                    }
                }
            } else {
                setUser(null);
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
    const register = useCallback(async (email: string, password: string, name: string): Promise<{ success: boolean; error?: string; needsOTPVerification?: boolean }> => {
        try {
            const { data, error } = await supabase.auth.signUp({
                email,
                password,
                options: {
                    data: {
                        name,
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
                // User is signed in (Email confirmation might be off)
                try {
                    await createUserProgress(data.user.id);
                } catch (progressError) {
                    console.error('Failed to create user progress:', progressError);
                }

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
            const { data, error } = await supabase.auth.verifyOtp({
                email,
                token,
                type: 'signup',
            });

            if (error) {
                console.error('OTP verification error:', error.message);
                return { success: false, error: error.message };
            }

            if (data.user && data.session) {
                // OTP verified, user is now logged in
                try {
                    await createUserProgress(data.user.id);
                } catch (progressError) {
                    console.error('Failed to create user progress:', progressError);
                }

                setUser(mapSupabaseUser(data.user));
                setPendingVerificationEmail(null);
                return { success: true };
            }

            return { success: false, error: 'Verification failed' };
        } catch (error) {
            console.error('OTP verification exception:', error);
            return { success: false, error: 'Verification failed' };
        }
    }, []);

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

    const updatePassword = useCallback(async (password: string): Promise<{ success: boolean; error?: string }> => {
        const attemptUpdate = async (retryCount = 0): Promise<{ success: boolean; error?: string }> => {
            try {
                console.log(`UpdatePassword: Attempt ${retryCount + 1}...`);

                // Small delay on first attempt to ensure Supabase has processed the token
                if (retryCount === 0) {
                    await new Promise(resolve => setTimeout(resolve, 300));
                }

                // Get current session info for debugging
                const { data: { session } } = await supabase.auth.getSession();
                console.log('UpdatePassword: Current session:', {
                    hasSession: !!session,
                    email: session?.user?.email
                });

                // Call updateUser directly - don't refresh session as it might reset recovery state
                console.log('UpdatePassword: Calling updateUser...');
                const { data, error } = await supabase.auth.updateUser({ password });

                console.log('UpdatePassword: Result', {
                    hasData: !!data,
                    hasUser: !!data?.user,
                    error: error?.message
                });

                // Check for success - if we have data.user, it worked
                if (data?.user && !error) {
                    console.log('UpdatePassword: Success!');
                    return { success: true };
                }

                if (error) {
                    const errorMsg = error.message.toLowerCase();

                    // Handle abort/timeout errors with retry
                    if (errorMsg.includes('abort') || errorMsg.includes('signal') || errorMsg.includes('timeout')) {
                        if (retryCount < 2) {
                            console.log('UpdatePassword: Retrying due to network error...');
                            await new Promise(resolve => setTimeout(resolve, 1500));
                            return attemptUpdate(retryCount + 1);
                        }
                        return { success: false, error: 'Bağlantı zaman aşımı. Lütfen tekrar deneyin.' };
                    }

                    // Handle session errors
                    if (errorMsg.includes('session')) {
                        return { success: false, error: 'Oturum süresi doldu. Lütfen şifre sıfırlama linkine tekrar tıklayın.' };
                    }

                    return { success: false, error: error.message };
                }

                // If no error but also no user data, something is wrong
                return { success: false, error: 'Beklenmeyen hata oluştu. Lütfen tekrar deneyin.' };
            } catch (error: any) {
                const errorMsg = (error.message || '').toLowerCase();
                console.error('UpdatePassword exception:', error);

                // Retry on network errors
                if ((errorMsg.includes('abort') || errorMsg.includes('signal') || errorMsg.includes('network')) && retryCount < 2) {
                    console.log('UpdatePassword: Retrying after exception...');
                    await new Promise(resolve => setTimeout(resolve, 1500));
                    return attemptUpdate(retryCount + 1);
                }

                return { success: false, error: 'Şifre güncellenemedi. Lütfen tekrar deneyin.' };
            }
        };

        const result = await attemptUpdate();
        setIsPasswordRecovery(false);
        return result;
    }, []);

    const logout = useCallback(async () => {
        try {
            // Clear local storage for SRS data
            if (typeof window !== 'undefined') {
                localStorage.removeItem('globalfinterm_user_progress');
                // Also clear terms to force a fresh fetch next time ensuring data consistency
                // localStorage.removeItem('globalfinterm_terms'); 
            }
            // Optimistic Logout: Clear state immediately
            setUser(null);
            setPendingVerificationEmail(null);

            // Then tell Supabase (non-blocking for UI)
            const { error } = await supabase.auth.signOut();
            if (error) {
                console.error('Supabase signOut error:', error);
            }
        } catch (error) {
            console.error('Logout handler error:', error);
        } finally {
            // Always set user to null, even if signOut fails
            setUser(null);
            // Refresh the page to ensure all auth state is cleared from UI
            router.refresh();
        }
    }, [router]);

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
