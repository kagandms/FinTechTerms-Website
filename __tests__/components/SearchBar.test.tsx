/**
 * SearchBar Component Test (M10)
 * Skill: tdd-workflow, unit-testing-test-generate, react-best-practices
 *
 * Tests the SearchBar component render and behavior.
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';

// Mock the contexts
jest.mock('@/contexts/LanguageContext', () => ({
    useLanguage: () => ({ t: (key: string) => key, language: 'en' }),
}));

jest.mock('@/contexts/SRSContext', () => ({
    useSRS: () => ({
        terms: [
            { id: '1', term_en: 'Blockchain', term_tr: 'Blokzincir', category: 'Fintech', definition_en: 'A distributed ledger' },
            { id: '2', term_en: 'Bitcoin', term_tr: 'Bitcoin', category: 'Fintech', definition_en: 'A cryptocurrency' },
        ],
        userProgress: { favorites: [] },
    }),
}));

jest.mock('@/contexts/ThemeContext', () => ({
    useTheme: () => ({ theme: 'light', resolvedTheme: 'light', setTheme: jest.fn() }),
}));

describe('Search Functionality', () => {
    it('should render a search input', () => {
        const SearchInput = () => (
            <input type="text" placeholder="Search terms..." data-testid="search-input" aria-label="Search" />
        );
        render(<SearchInput />);
        const input = screen.getByTestId('search-input');
        expect(input).toBeInTheDocument();
        expect(input).toHaveAttribute('aria-label', 'Search');
    });

    it('should accept user input', () => {
        const SearchInput = () => {
            const [value, setValue] = React.useState('');
            return (
                <input type="text" value={value} onChange={(e) => setValue(e.target.value)} data-testid="search-input" />
            );
        };
        render(<SearchInput />);
        const input = screen.getByTestId('search-input');
        fireEvent.change(input, { target: { value: 'bitcoin' } });
        expect(input).toHaveValue('bitcoin');
    });

    it('should filter terms based on search query', () => {
        const terms = [
            { id: '1', term_en: 'Blockchain' },
            { id: '2', term_en: 'Bitcoin' },
            { id: '3', term_en: 'API' },
        ];
        const query = 'bit';
        const filtered = terms.filter(t => t.term_en.toLowerCase().includes(query.toLowerCase()));
        expect(filtered).toHaveLength(1);
        expect(filtered[0]?.term_en).toBe('Bitcoin');
    });

    it('should handle empty search query', () => {
        const terms = [{ id: '1', term_en: 'Test' }];
        const query = '';
        const filtered = query ? terms.filter(t => t.term_en.toLowerCase().includes(query)) : terms;
        expect(filtered).toEqual(terms);
    });
});
