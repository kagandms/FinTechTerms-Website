'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
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
    login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
    register: (email: string, password: string, name: string) => Promise<{ success: boolean; error?: string }>;
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
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);

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
     * Register a new user
     */
    const register = useCallback(async (email: string, password: string, name: string): Promise<{ success: boolean; error?: string; needsEmailConfirmation?: boolean }> => {
        try {
            const { data, error } = await supabase.auth.signUp({
                email,
                password,
                options: {
                    data: {
                        name,
                    },
                },
            });

            if (error) {
                console.error('Register error:', error.message);
                return { success: false, error: error.message };
            }

            if (data.user) {
                // Check if email confirmation is required
                // If identities array is empty or email is not confirmed, user needs to verify email
                const needsConfirmation = !data.user.email_confirmed_at;

                if (needsConfirmation) {
                    // Don't auto-login, return that email confirmation is needed
                    return { success: true, needsEmailConfirmation: true };
                }

                // Email is already confirmed (shouldn't happen with confirm email ON)
                try {
                    await createUserProgress(data.user.id);
                } catch (progressError) {
                    console.error('Failed to create user progress:', progressError);
                }

                setUser(mapSupabaseUser(data.user));
                return { success: true };
            }

            return { success: false, error: 'Unknown error occurred' };
        } catch (error) {
            console.error('Register exception:', error);
            return { success: false, error: 'Registration failed' };
        }
    }, []);

    /**
     * Logout the current user
     */
    const logout = useCallback(async () => {
        try {
            await supabase.auth.signOut();
            setUser(null);
        } catch (error) {
            console.error('Logout error:', error);
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
                login,
                register,
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
