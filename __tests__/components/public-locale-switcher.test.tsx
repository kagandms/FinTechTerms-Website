/**
 * @jest-environment jsdom
 */

import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import PublicLocaleSwitcher from '@/components/public-locale-switcher';

const mockUsePathname = jest.fn();
const mockUseSearchParams = jest.fn();
const mockPersistLocalePreference = jest.fn();

jest.mock('next/navigation', () => ({
    usePathname: () => mockUsePathname(),
    useSearchParams: () => mockUseSearchParams(),
}));

jest.mock('@/lib/client-locale-preference', () => ({
    persistLocalePreference: (...args: unknown[]) => mockPersistLocalePreference(...args),
}));

jest.mock('next/link', () => ({
    __esModule: true,
    default: ({ href, onClick, children, ...props }: { href: string; onClick?: (event: React.MouseEvent<HTMLAnchorElement>) => void; children: React.ReactNode }) => (
        <a
            href={href}
            {...props}
            onClick={(event) => {
                event.preventDefault();
                onClick?.(event);
            }}
        >
            {children}
        </a>
    ),
}));

describe('PublicLocaleSwitcher', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockUsePathname.mockReturnValue('/ru/glossary/tokenization');
        mockUseSearchParams.mockReturnValue(new URLSearchParams('ref=seo&utm_source=test'));
        window.history.replaceState({}, '', '/ru/glossary/tokenization?ref=seo&utm_source=test#examples');
    });

    it('preserves the localized route, query params, and hash fragments', async () => {
        render(<PublicLocaleSwitcher currentLocale="ru" />);

        await waitFor(() => {
            expect(screen.getByRole('link', { name: 'en' })).toHaveAttribute(
                'href',
                '/en/glossary/tokenization?ref=seo&utm_source=test#examples'
            );
        });

        expect(screen.getByRole('link', { name: 'tr' })).toHaveAttribute(
            'href',
            '/tr/glossary/tokenization?ref=seo&utm_source=test#examples'
        );
    });

    it('marks the current locale as active and keeps its current route intact', async () => {
        render(<PublicLocaleSwitcher currentLocale="ru" />);

        const currentLocaleLink = screen.getByRole('link', { name: 'ru' });

        await waitFor(() => {
            expect(currentLocaleLink).toHaveAttribute(
                'href',
                '/ru/glossary/tokenization?ref=seo&utm_source=test#examples'
            );
        });

        expect(currentLocaleLink).toHaveAttribute('aria-current', 'page');
    });

    it('persists the selected locale before navigation', async () => {
        render(<PublicLocaleSwitcher currentLocale="ru" />);

        const englishLink = screen.getByRole('link', { name: 'en' });
        fireEvent.click(englishLink);

        expect(mockPersistLocalePreference).toHaveBeenCalledWith('en');
    });

    it('falls back to locale home when the current pathname is not a public localized route', async () => {
        mockUsePathname.mockReturnValue('/search');
        mockUseSearchParams.mockReturnValue(new URLSearchParams());
        window.history.replaceState({}, '', '/search#fallback');

        render(<PublicLocaleSwitcher currentLocale="ru" />);

        await waitFor(() => {
            expect(screen.getByRole('link', { name: 'en' })).toHaveAttribute('href', '/en#fallback');
        });
    });
});
