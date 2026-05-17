/**
 * @jest-environment jsdom
 */

import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

import { LanguageProvider, useLanguage } from '@/contexts/LanguageContext';
import { LANGUAGE_COOKIE_NAME } from '@/lib/language';
import { setCurrentLanguage } from '@/utils/storage';

let mockSearchParams = new URLSearchParams();

jest.mock('next/navigation', () => ({
    usePathname: (): string => '/dashboard',
    useSearchParams: (): URLSearchParams => mockSearchParams,
}));

const clearLanguageCookie = (): void => {
    document.cookie = `${LANGUAGE_COOKIE_NAME}=; Path=/; Max-Age=0; SameSite=Lax`;
};

const LanguageConsumer = (): React.JSX.Element => {
    const { language, setLanguage } = useLanguage();

    return (
        <div>
            <span data-testid="language-value">{language}</span>
            <button type="button" onClick={() => setLanguage('tr')}>
                Set Turkish
            </button>
        </div>
    );
};

describe('LanguageProvider', () => {
    beforeEach(() => {
        mockSearchParams = new URLSearchParams();
        window.localStorage.clear();
        clearLanguageCookie();
    });

    it('uses the saved language preference when the URL has no language override', () => {
        setCurrentLanguage('en');

        render(
            <LanguageProvider>
                <LanguageConsumer />
            </LanguageProvider>
        );

        expect(screen.getByTestId('language-value')).toHaveTextContent('en');
    });

    it('lets the URL language override the saved preference and persists it', async () => {
        setCurrentLanguage('ru');
        mockSearchParams = new URLSearchParams('lang=tr');

        render(
            <LanguageProvider>
                <LanguageConsumer />
            </LanguageProvider>
        );

        expect(screen.getByTestId('language-value')).toHaveTextContent('tr');

        await waitFor(() => {
            expect(window.localStorage.getItem('globalfinterm_language')).toBe('tr');
        });
        expect(document.cookie).toContain(`${LANGUAGE_COOKIE_NAME}=tr`);
    });

    it('updates the stored preference when a user changes language explicitly', () => {
        setCurrentLanguage('en');

        render(
            <LanguageProvider>
                <LanguageConsumer />
            </LanguageProvider>
        );

        fireEvent.click(screen.getByRole('button', { name: 'Set Turkish' }));

        expect(screen.getByTestId('language-value')).toHaveTextContent('tr');
        expect(window.localStorage.getItem('globalfinterm_language')).toBe('tr');
        expect(document.cookie).toContain(`${LANGUAGE_COOKIE_NAME}=tr`);
    });
});
