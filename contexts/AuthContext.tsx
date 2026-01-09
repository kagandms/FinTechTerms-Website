'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';

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
    login: (email: string, password: string) => Promise<boolean>;
    register: (email: string, password: string, name: string) => Promise<boolean>;
    logout: () => void;
    favoriteLimit: number;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const STORAGE_KEY = 'globalfinterm_auth';
const GUEST_FAVORITE_LIMIT = 50;
const AUTHENTICATED_FAVORITE_LIMIT = Infinity;

interface AuthProviderProps {
    children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    // Load user from localStorage on mount
    useEffect(() => {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (stored) {
                const parsed = JSON.parse(stored);
                if (parsed.user) {
                    setUser(parsed.user);
                }
            }
        } catch (error) {
            console.error('Failed to load auth state:', error);
        } finally {
            setIsLoading(false);
        }
    }, []);

    // Save user to localStorage when changed
    const saveAuthState = useCallback((userData: User | null) => {
        try {
            if (userData) {
                localStorage.setItem(STORAGE_KEY, JSON.stringify({ user: userData }));
            } else {
                localStorage.removeItem(STORAGE_KEY);
            }
        } catch (error) {
            console.error('Failed to save auth state:', error);
        }
    }, []);

    /**
     * Login with email and password
     * Note: This is a mock implementation. In production, use Supabase Auth.
     */
    const login = useCallback(async (email: string, password: string): Promise<boolean> => {
        // Simulate API call
        await new Promise(resolve => setTimeout(resolve, 500));

        // Mock validation (in production, this would be a real API call)
        if (email && password.length >= 6) {
            const mockUser: User = {
                id: `user_${Date.now()}`,
                email,
                name: email.split('@')[0] ?? 'User',
                createdAt: new Date().toISOString(),
            };
            setUser(mockUser);
            saveAuthState(mockUser);
            return true;
        }
        return false;
    }, [saveAuthState]);

    /**
     * Register a new user
     * Note: This is a mock implementation. In production, use Supabase Auth.
     */
    const register = useCallback(async (email: string, password: string, name: string): Promise<boolean> => {
        // Simulate API call
        await new Promise(resolve => setTimeout(resolve, 500));

        // Mock validation
        if (email && password.length >= 6 && name) {
            const mockUser: User = {
                id: `user_${Date.now()}`,
                email,
                name,
                createdAt: new Date().toISOString(),
            };
            setUser(mockUser);
            saveAuthState(mockUser);
            return true;
        }
        return false;
    }, [saveAuthState]);

    /**
     * Logout the current user
     */
    const logout = useCallback(() => {
        setUser(null);
        saveAuthState(null);
    }, [saveAuthState]);

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
