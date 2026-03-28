/**
 * @jest-environment jsdom
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

import { ThemeProvider, useTheme } from '@/contexts/ThemeContext';

const createMatchMedia = (matches: boolean) => (
    jest.fn().mockImplementation(() => ({
        matches,
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
    }))
);

const ThemeConsumer = () => {
    const { resolvedTheme, theme } = useTheme();

    return (
        <div>
            <span data-testid="theme-value">{theme}</span>
            <span data-testid="resolved-theme">{resolvedTheme}</span>
        </div>
    );
};

describe('ThemeProvider', () => {
    beforeEach(() => {
        window.localStorage.clear();
        document.documentElement.className = '';
    });

    it('uses the system theme on first load when no preference is stored', () => {
        Object.defineProperty(window, 'matchMedia', {
            writable: true,
            value: createMatchMedia(true),
        });

        render(
            <ThemeProvider>
                <ThemeConsumer />
            </ThemeProvider>
        );

        expect(screen.getByTestId('theme-value')).toHaveTextContent('system');
        expect(screen.getByTestId('resolved-theme')).toHaveTextContent('dark');
        expect(document.documentElement).toHaveClass('dark');
    });

    it('keeps an explicit light preference even if the system is dark', () => {
        window.localStorage.setItem('theme', 'light');
        Object.defineProperty(window, 'matchMedia', {
            writable: true,
            value: createMatchMedia(true),
        });

        render(
            <ThemeProvider>
                <ThemeConsumer />
            </ThemeProvider>
        );

        expect(screen.getByTestId('theme-value')).toHaveTextContent('light');
        expect(screen.getByTestId('resolved-theme')).toHaveTextContent('light');
        expect(document.documentElement).toHaveClass('light');
    });
});
