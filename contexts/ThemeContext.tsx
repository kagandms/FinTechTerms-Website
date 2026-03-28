'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { isThemeValue, THEME_STORAGE_KEY } from '@/lib/theme-bootstrap';

export type Theme = 'light' | 'dark' | 'system';

interface ThemeContextType {
    theme: Theme;
    resolvedTheme: 'light' | 'dark';
    setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
    const [theme, setThemeState] = useState<Theme>(() => {
        if (typeof window === 'undefined') {
            return 'system';
        }

        const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
        return isThemeValue(storedTheme) ? storedTheme : 'system';
    });
    const [systemTheme, setSystemTheme] = useState<'light' | 'dark'>(() => {
        if (typeof document !== 'undefined') {
            if (document.documentElement.classList.contains('dark')) {
                return 'dark';
            }

            if (document.documentElement.classList.contains('light')) {
                return 'light';
            }
        }

        if (typeof window !== 'undefined') {
            return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
        }

        return 'light';
    });
    const resolvedTheme: 'light' | 'dark' = theme === 'system' ? systemTheme : theme;

    const getSystemTheme = (): 'light' | 'dark' => {
        if (typeof window !== 'undefined') {
            return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
        }
        return 'light';
    };

    useEffect(() => {
        if (typeof document === 'undefined') {
            return;
        }

        document.documentElement.classList.remove('light', 'dark');
        document.documentElement.classList.add(resolvedTheme);
    }, [resolvedTheme]);

    useEffect(() => {
        if (typeof window === 'undefined') {
            return;
        }

        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        const handleChange = () => {
            setSystemTheme(getSystemTheme());
        };

        mediaQuery.addEventListener('change', handleChange);
        return () => mediaQuery.removeEventListener('change', handleChange);
    }, []);

    const setTheme = (newTheme: Theme) => {
        setThemeState(newTheme);
        localStorage.setItem(THEME_STORAGE_KEY, newTheme);
    };

    return (
        <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme }}>
            {children}
        </ThemeContext.Provider>
    );
}

export function useTheme() {
    const context = useContext(ThemeContext);
    if (context === undefined) {
        throw new Error('useTheme must be used within a ThemeProvider');
    }
    return context;
}
