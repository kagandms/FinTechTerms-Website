
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import SmartCard from '@/components/SmartCard';

// Mock dependencies
jest.mock('@/hooks/useTermTranslation', () => ({
    useTermTranslation: (term: any) => ({
        language: 'ru',
        t: (key: string) => key,
        getTermByLang: (lang: string) => term[`term_${lang}`] || term.term_ru,
        getPhoneticByLang: (lang: string) => '/term/',
        currentTerm: term.term_ru,
        currentPhonetic: '/term/',
        currentDefinition: term.definition_ru,
        currentExample: term.example_ru
    })
}));

// Mock SRSContext with a spy for useSRS
jest.mock('@/contexts/SRSContext', () => ({
    useSRS: jest.fn(() => ({
        toggleFavorite: jest.fn().mockReturnValue({ success: true, limitReached: false }),
        isFavorite: jest.fn().mockReturnValue(false),
        isFavoriteUpdating: jest.fn().mockReturnValue(false),
        favoritesRemaining: 10,
        terms: []
    }))
}));

jest.mock('@/contexts/AuthContext', () => ({
    useAuth: () => ({
        isAuthenticated: false
    })
}));

jest.mock('@/contexts/ToastContext', () => ({
    useToast: () => ({
        showToast: jest.fn()
    })
}));

jest.mock('@/utils/tts', () => ({
    speakText: jest.fn(),
    isSpeechAvailable: jest.fn().mockReturnValue(true)
}));

jest.mock('next/link', () => {
    const MockLink = ({ children }: { children: React.ReactNode }) => {
        return <span>{children}</span>;
    };

    MockLink.displayName = 'MockLink';
    return MockLink;
});

describe('SmartCard Component', () => {
    const mockTerm = {
        id: 'term_1',
        term_en: 'Test Term',
        term_tr: 'Test Terimi',
        term_ru: 'Тестовый Термин',
        definition_en: 'This is a test definition.',
        definition_tr: 'Bu bir test tanımıdır.',
        definition_ru: 'Это тестовое определение.',
        example_en: 'This is a test example.',
        example_tr: 'Bu bir test örneğidir.',
        example_ru: 'Это тестовый пример.',
        category: 'Fintech',
        srs_level: 0,
        next_review_date: new Date().toISOString(),
        last_reviewed: null,
        difficulty_score: 0,
        retention_rate: 0,
        times_reviewed: 0,
        times_correct: 0
    };

    it('renders the term and definition correctly', () => {
        render(<SmartCard term={mockTerm as any} />);

        // check Russian term is displayed as primary
        expect(screen.getByText('Тестовый Термин')).toBeInTheDocument();
        // check definition (current language = ru)
        expect(screen.getByText('Это тестовое определение.')).toBeInTheDocument();
        // check category
        expect(screen.getByText('categories.Fintech')).toBeInTheDocument(); // Mocked t returns key
    });

    it('toggles example visibility when button is clicked', () => {
        render(<SmartCard term={mockTerm as any} />);

        const toggleButton = screen.getByText('card.example');

        // Example should not be visible initially (unless showFullDetails prop is true)
        expect(screen.queryByText('Это тестовый пример.')).not.toBeInTheDocument();

        // Click to expand
        fireEvent.click(toggleButton);
        expect(screen.getByText('"Это тестовый пример."')).toBeInTheDocument();

        // Click to collapse — language is 'ru' so text is 'Меньше'
        const collapseButton = screen.getByText('Меньше');
        fireEvent.click(collapseButton);

        // Wait for animation or state update if needed, but here it's sync
        expect(screen.queryByText('"Это тестовый пример."')).not.toBeInTheDocument();
    });

    it('calls toggleFavorite when heart icon is clicked', () => {
        const { useSRS } = require('@/contexts/SRSContext');
        const toggleMock = jest.fn().mockReturnValue({ success: true });

        // Use type casting to tell TS that useSRS is a Mock
        (useSRS as jest.Mock).mockReturnValue({
            toggleFavorite: toggleMock,
            isFavorite: () => false,
            isFavoriteUpdating: () => false,
            favoritesRemaining: 10
        });

        render(<SmartCard term={mockTerm as any} />);

        const heartButton = screen.getByTitle('card.addFavorite');
        fireEvent.click(heartButton);

        expect(toggleMock).toHaveBeenCalledWith('term_1');
    });
});
