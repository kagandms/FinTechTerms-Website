
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import SearchBar from '@/components/SearchBar';

// Mock dependencies
jest.mock('@/contexts/LanguageContext', () => ({
    useLanguage: () => ({
        t: (key: string) => key
    })
}));

const mockTerms = [
    {
        id: 'term_1',
        term_en: 'Bitcoin',
        term_tr: 'Bitcoin',
        term_ru: 'Биткоин',
        definition_en: 'Digital currency',
        definition_tr: 'Dijital para',
        definition_ru: 'Цифровая валюта',
        category: 'Fintech'
    },
    {
        id: 'term_2',
        term_en: 'Stock',
        term_tr: 'Hisse',
        term_ru: 'Акция',
        definition_en: 'Share of ownership',
        definition_tr: 'Sahiplik payı',
        definition_ru: 'Доля владения',
        category: 'Finance'
    }
];

jest.mock('@/contexts/SRSContext', () => ({
    useSRS: () => ({
        terms: mockTerms
    })
}));

describe('SearchBar Component', () => {
    it('renders the search input', () => {
        render(<SearchBar onResults={jest.fn()} />);
        expect(screen.getByPlaceholderText('search.placeholder')).toBeInTheDocument();
    });

    it('filters terms when typing', () => {
        const onResultsMock = jest.fn();
        render(<SearchBar onResults={onResultsMock} />);

        const input = screen.getByPlaceholderText('search.placeholder');

        // Initial render should call with all terms
        expect(onResultsMock).toHaveBeenCalledWith(mockTerms);

        // Type "stock"
        fireEvent.change(input, { target: { value: 'stock' } });

        // Should filter to only Stock term
        expect(onResultsMock).toHaveBeenLastCalledWith([mockTerms[1]]);
    });

    it('toggles filters and selects category', () => {
        const onResultsMock = jest.fn();
        render(<SearchBar onResults={onResultsMock} />);

        // Open filters (filter icon button)
        // Since we don't have aria-label, we find by icon class or just the button wrapping it.
        // But simpler: just find the button that isn't clean button. 
        // Or better: the button toggles `showFilters`.
        // Let's rely on the fact that the filter button renders inside the input container.

        // Actually, we can just click the button that contains the Filter icon.
        // Since we can't easily select by icon, let's look for the button structure from source.
        const buttons = screen.getAllByRole('button');
        const filterButton = buttons[buttons.length - 1]; // Last button is usually filter

        if (filterButton) {
            fireEvent.click(filterButton);
        }

        // Now category buttons should be visible
        const financeBtn = screen.getByText('categories.Finance');
        expect(financeBtn).toBeInTheDocument();

        // Click Finance
        fireEvent.click(financeBtn);

        // Should filter by Finance category
        expect(onResultsMock).toHaveBeenLastCalledWith([mockTerms[1]]);
    });

    it('clears search when clear button provided', () => {
        const onResultsMock = jest.fn();
        const onClearMock = jest.fn();
        render(<SearchBar onResults={onResultsMock} onClear={onClearMock} />);

        const input = screen.getByPlaceholderText('search.placeholder');
        fireEvent.change(input, { target: { value: 'bitcoin' } });

        // Clear button appears when there is query
        // It's the 'X' button.
        const buttons = screen.getAllByRole('button');
        // The one with X is usually first if present
        const clearButton = buttons[0];

        if (clearButton) {
            fireEvent.click(clearButton);
        }

        expect(input).toHaveValue('');
        expect(onClearMock).toHaveBeenCalled();
    });
});
