import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import SearchClient from '@/app/search/SearchClient';
import enTranslations from '@/locales/en.json';
import trTranslations from '@/locales/tr.json';
import ruTranslations from '@/locales/ru.json';

const mockUseLanguage = jest.fn();
const mockUseSRS = jest.fn();
const mockUseSearchParams = jest.fn();
const mockPush = jest.fn();
const mockReplace = jest.fn();

jest.mock('@/contexts/LanguageContext', () => ({
    useLanguage: () => mockUseLanguage(),
}));

jest.mock('@/contexts/SRSContext', () => ({
    useSRS: () => mockUseSRS(),
}));

jest.mock('next/navigation', () => ({
    usePathname: () => '/search',
    useRouter: () => ({
        push: mockPush,
        replace: mockReplace,
    }),
    useSearchParams: () => mockUseSearchParams(),
}));

jest.mock('@/components/SmartCard', () => ({
    __esModule: true,
    default: () => <div data-testid="smart-card">SmartCard</div>,
}));

const translationBundles = {
    en: enTranslations,
    tr: trTranslations,
    ru: ruTranslations,
} as const;

const resolveTranslation = (bundle: unknown, key: string): string => {
    return key
        .split('.')
        .reduce<unknown>((value, segment) => {
            if (value && typeof value === 'object' && segment in (value as Record<string, unknown>)) {
                return (value as Record<string, unknown>)[segment];
            }

            return key;
        }, bundle) as string;
};

describe('Search UI translations', () => {
    beforeEach(() => {
        mockPush.mockReset();
        mockReplace.mockReset();
        mockUseSearchParams.mockReturnValue(new URLSearchParams());
        mockUseSRS.mockReturnValue({
            terms: [],
            isLoading: false,
            termsStatus: 'ready',
            refreshData: jest.fn(),
        });
    });

    it.each([
        ['en', 'Search', 'Search in Turkish, English or Russian...', 'No terms available'],
        ['tr', 'Ara', 'Türkçe, İngilizce veya Rusça ara...', 'Terim bulunamadı'],
        ['ru', 'Поиск', 'Поиск на турецком, английском или русском...', 'Термины недоступны'],
    ] as const)(
        'renders search UI strings from the %s translation bundle',
        (language, title, placeholder, emptyTitle) => {
            const bundle = translationBundles[language];

            mockUseLanguage.mockReturnValue({
                language,
                t: (key: string) => resolveTranslation(bundle, key),
            });

            render(<SearchClient />);

            expect(screen.getByRole('heading', { name: title })).toBeInTheDocument();
            expect(screen.getByLabelText(placeholder)).toBeInTheDocument();
            expect(screen.getByText(emptyTitle)).toBeInTheDocument();
        }
    );
});
