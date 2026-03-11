import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import SearchBar, { type SearchFilterState } from '@/components/SearchBar';
import { defaultSearchFilterState } from '@/lib/search-state';

const translationMap: Record<string, string> = {
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
};

jest.mock('@/contexts/LanguageContext', () => ({
    useLanguage: () => ({
        language: 'en',
        t: (key: string) => translationMap[key] ?? key,
    }),
}));

describe('SearchBar', () => {
    const renderSearchBar = (overrides: Partial<SearchFilterState> = {}) => {
        const onQueryChange = jest.fn();
        const onCategoryChange = jest.fn();
        const onMarketChange = jest.fn();
        const onSortChange = jest.fn();
        const onClear = jest.fn();

        render(
            <SearchBar
                filterState={{ ...defaultSearchFilterState, ...overrides }}
                onQueryChange={onQueryChange}
                onCategoryChange={onCategoryChange}
                onMarketChange={onMarketChange}
                onSortChange={onSortChange}
                onClear={onClear}
            />
        );

        return {
            onQueryChange,
            onCategoryChange,
            onMarketChange,
            onSortChange,
            onClear,
        };
    };

    it('renders regional market chips in the active language', () => {
        renderSearchBar();

        expect(screen.getByRole('button', { name: 'Market: MOEX' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Market: BIST' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Market: GLOBAL' })).toBeInTheDocument();
    });

    it('forwards query and filter changes to the URL state controller', () => {
        const { onQueryChange, onMarketChange, onSortChange } = renderSearchBar();

        fireEvent.change(screen.getByLabelText('Search in Turkish, English or Russian...'), {
            target: { value: 'bond' },
        });
        fireEvent.click(screen.getByRole('button', { name: 'Market: MOEX' }));
        fireEvent.change(screen.getByLabelText('Sort order'), {
            target: { value: 'alpha-desc' },
        });

        expect(onQueryChange).toHaveBeenCalledWith('bond');
        expect(onMarketChange).toHaveBeenCalledWith('MOEX');
        expect(onSortChange).toHaveBeenCalledWith('alpha-desc');
    });
});
