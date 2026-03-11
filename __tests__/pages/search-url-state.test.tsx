import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import SearchClient from '@/app/search/SearchClient';

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
    default: ({ term }: { term: { term_en?: string } }) => <div data-testid="smart-card">{term.term_en}</div>,
}));

const baseTerm = {
    phonetic_en: '',
    phonetic_ru: '',
    phonetic_tr: '',
    example_sentence_en: 'Example',
    example_sentence_ru: 'Пример',
    example_sentence_tr: 'Ornek',
    context_tags: {},
    is_academic: true,
    difficulty_level: 'intermediate',
    srs_level: 1,
    next_review_date: new Date().toISOString(),
    last_reviewed: null,
    difficulty_score: 2.5,
    retention_rate: 0.5,
    times_reviewed: 1,
    times_correct: 1,
} as const;

describe('Search URL state', () => {
    beforeEach(() => {
        mockPush.mockReset();
        mockReplace.mockReset();
        mockUseSearchParams.mockReturnValue(new URLSearchParams('q=moex&market=MOEX&sort=alpha-desc'));
        mockUseLanguage.mockReturnValue({
            language: 'en',
            t: (key: string) => ({
                'search.title': 'Search',
                'search.description': 'Description',
                'search.loadingTitle': 'Loading dictionary',
                'search.loadingDescription': 'Please wait.',
                'search.errorTitle': 'Error',
                'search.errorDescription': 'Error description',
                'search.degradedTitle': 'Degraded',
                'search.degradedDescription': 'Degraded description',
                'search.emptyTitle': 'Empty',
                'search.emptyDescription': 'Empty description',
                'search.retry': 'Retry',
                'search.results': 'results found',
                'search.filteredMarketTitle': 'No terms found for the selected market',
                'search.filteredMarketDescription': 'Market filter description',
                'search.noResultsTitle': 'No matches found',
                'search.noResultsDescription': 'No results description',
                'search.containerLabel': 'Search terms',
                'search.placeholder': 'Search in Turkish, English or Russian...',
                'search.clearSearch': 'Clear search',
                'search.showFilters': 'Show category filters',
                'search.hideFilters': 'Hide category filters',
                'search.allTerms': 'All Terms',
                'search.allMarkets': 'All Markets',
                'search.marketLabel': 'Market taxonomy',
                'search.sortLabel': 'Sort order',
                'search.sort.alphaAsc': 'Alphabetical (A-Z)',
                'search.sort.alphaDesc': 'Alphabetical (Z-A)',
                'search.markets.MOEX': 'Market: MOEX',
                'search.markets.BIST': 'Market: BIST',
                'search.markets.GLOBAL': 'Market: GLOBAL',
                'categories.Fintech': 'Fintech',
                'categories.Finance': 'Finance',
                'categories.Technology': 'Technology',
            }[key] ?? key),
        });
        mockUseSRS.mockReturnValue({
            terms: [
                {
                    ...baseTerm,
                    id: 'term-1',
                    term_en: 'MOEX Bond',
                    term_ru: 'Облигация MOEX',
                    term_tr: 'MOEX Tahvili',
                    category: 'Finance',
                    definition_en: 'MOEX bond definition',
                    definition_ru: 'Определение облигации MOEX',
                    definition_tr: 'MOEX tahvili tanimi',
                    regional_market: 'MOEX',
                },
                {
                    ...baseTerm,
                    id: 'term-2',
                    term_en: 'BIST Equity',
                    term_ru: 'Акция BIST',
                    term_tr: 'BIST Hissesi',
                    category: 'Finance',
                    definition_en: 'BIST equity definition',
                    definition_ru: 'Определение акции BIST',
                    definition_tr: 'BIST hissesi tanimi',
                    regional_market: 'BIST',
                },
            ],
            isLoading: false,
            termsStatus: 'ready',
            refreshData: jest.fn(),
        });
    });

    it('reads filters from the URL and writes updates back to the router', () => {
        render(<SearchClient />);

        expect(screen.getByDisplayValue('moex')).toBeInTheDocument();
        expect(screen.getAllByTestId('smart-card')).toHaveLength(1);
        expect(screen.getByText('MOEX Bond')).toBeInTheDocument();

        fireEvent.change(screen.getByLabelText('Search in Turkish, English or Russian...'), {
            target: { value: 'bond' },
        });

        expect(mockReplace).toHaveBeenCalledWith('/search?q=bond&market=MOEX&sort=alpha-desc', { scroll: false });

        fireEvent.click(screen.getByRole('button', { name: 'Market: BIST' }));

        expect(mockPush).toHaveBeenCalledWith('/search?q=moex&market=BIST&sort=alpha-desc', { scroll: false });
    });
});
