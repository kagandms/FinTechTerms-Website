import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import SmartCard from '@/components/SmartCard';

const mockUseTermTranslation = jest.fn();
const mockShowToast = jest.fn();
const mockFetchTermExplainResponse = jest.fn();

jest.mock('@/hooks/useTermTranslation', () => ({
    useTermTranslation: (...args: unknown[]) => mockUseTermTranslation(...args),
}));

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
        entitlements: {
            canUseAdvancedAnalytics: false,
        },
        isAuthenticated: false,
        isLoading: false,
        requiresProfileCompletion: false,
    })
}));

jest.mock('@/contexts/ToastContext', () => ({
    useToast: () => ({
        showToast: mockShowToast
    })
}));

jest.mock('@/utils/tts', () => ({
    speakText: jest.fn(),
    isSpeechAvailable: jest.fn().mockReturnValue(true)
}));

jest.mock('@/lib/ai/client', () => ({
    fetchTermExplainResponse: (...args: unknown[]) => mockFetchTermExplainResponse(...args),
}));

jest.mock('@/utils/ai-session', () => ({
    getCachedTermExplainResponse: jest.fn(() => null),
    setCachedTermExplainResponse: jest.fn(),
}));

jest.mock('next/link', () => {
    const MockLink = ({ children }: { children: React.ReactNode }) => <span>{children}</span>;
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
        example_sentence_en: 'This is a test example.',
        example_sentence_tr: 'Bu bir test örneğidir.',
        example_sentence_ru: 'Это тестовый пример.',
        example_en: 'This is a test example.',
        example_tr: 'Bu bir test örneğidir.',
        example_ru: 'Это тестовый пример.',
        category: 'Fintech',
        context_tags: {
            disciplines: ['economics', 'mis'],
            target_universities: ['SPbU'],
        },
        regional_market: 'MOEX',
        srs_level: 0,
        next_review_date: new Date().toISOString(),
        last_reviewed: null,
        difficulty_score: 0,
        retention_rate: 0,
        times_reviewed: 0,
        times_correct: 0
    };

    beforeEach(() => {
        jest.clearAllMocks();
        mockUseTermTranslation.mockImplementation((term: typeof mockTerm) => ({
            language: 'ru',
            t: (key: string) => ({
                'categories.Fintech': 'categories.Fintech',
                'card.example': 'card.example',
                'smartCard.less': 'Меньше',
                'smartCard.showLess': 'Показать меньше',
                'smartCard.showExampleSentence': 'Показать пример',
                'card.listen': 'card.listen',
                'card.addFavorite': 'card.addFavorite',
                'card.removeFavorite': 'card.removeFavorite',
                'smartCard.favoriteLimitWarning': 'Лимит избранного! Войдите для неограниченного добавления.',
                'smartCard.favoriteUpdateError': 'Не удалось обновить избранное.',
                'smartCard.favoriteAdded': 'Добавлено в избранное ❤️',
                'smartCard.favoriteRemoved': 'Удалено из избранного',
                'smartCard.favoritesRemaining': '{count} осталось',
                'smartCard.difficulty': 'Сложность',
                'smartCard.success': 'Успех',
                'smartCard.reviews': 'Повторов',
                'auth.login': 'Войти',
                'profile.edit': 'Профиль',
            }[key] ?? key),
            getTermByLang: (lang: string) => term[`term_${lang}` as keyof typeof term] || term.term_ru,
            getPhoneticByLang: () => '/term/',
            currentTerm: term.term_ru,
            currentPhonetic: '/term/',
            currentDefinition: term.definition_ru,
            currentExample: term.example_ru,
        }));
    });

    it('renders the term and definition correctly', () => {
        render(<SmartCard term={mockTerm as any} />);

        expect(screen.getByText('Тестовый Термин')).toBeInTheDocument();
        expect(screen.getByText('Это тестовое определение.')).toBeInTheDocument();
        expect(screen.getByText('categories.Fintech')).toBeInTheDocument();
        expect(screen.getByText('MOEX')).toBeInTheDocument();
        expect(screen.getByText('Economics')).toBeInTheDocument();
        expect(screen.getByText('MIS')).toBeInTheDocument();
    });

    it('toggles example visibility when button is clicked', () => {
        render(<SmartCard term={mockTerm as any} />);

        const toggleButton = screen.getByText('card.example');

        expect(screen.queryByText('Это тестовый пример.')).not.toBeInTheDocument();

        fireEvent.click(toggleButton);
        expect(screen.getByText('"Это тестовый пример."')).toBeInTheDocument();

        const collapseButton = screen.getByText('Меньше');
        fireEvent.click(collapseButton);

        expect(screen.queryByText('"Это тестовый пример."')).not.toBeInTheDocument();
    });

    it('calls toggleFavorite when heart icon is clicked', () => {
        const { useSRS } = require('@/contexts/SRSContext');
        const toggleMock = jest.fn().mockReturnValue({ success: true });

        (useSRS as jest.Mock).mockReturnValue({
            toggleFavorite: toggleMock,
            isFavorite: () => false,
            isFavoriteUpdating: () => false,
            favoritesRemaining: 10
        });

        render(<SmartCard term={mockTerm as any} />);

        fireEvent.click(screen.getByTitle('card.addFavorite'));

        expect(toggleMock).toHaveBeenCalledWith('term_1');
    });

    it('renders the selected language as the primary heading', () => {
        mockUseTermTranslation.mockImplementation((term: typeof mockTerm) => ({
            language: 'tr',
            t: (key: string) => key,
            getTermByLang: (lang: string) => term[`term_${lang}` as keyof typeof term] || term.term_tr,
            getPhoneticByLang: () => '/term/',
            currentTerm: term.term_tr,
            currentPhonetic: '/term/',
            currentDefinition: term.definition_tr,
            currentExample: term.example_tr,
        }));

        render(<SmartCard term={mockTerm as any} />);

        expect(screen.getByText('Test Terimi')).toBeInTheDocument();
        expect(screen.getByText('Bu bir test tanımıdır.')).toBeInTheDocument();
        expect(screen.queryByRole('heading', { name: 'Тестовый Термин' })).not.toBeInTheDocument();
    });

    it('shows a localized success toast when a term is favorited', async () => {
        const { useSRS } = require('@/contexts/SRSContext');
        const toggleMock = jest.fn().mockResolvedValue({
            success: true,
            limitReached: false,
            isFavorite: true,
        });

        (useSRS as jest.Mock).mockReturnValue({
            toggleFavorite: toggleMock,
            isFavorite: () => false,
            isFavoriteUpdating: () => false,
            favoritesRemaining: 10,
        });

        render(<SmartCard term={mockTerm as any} />);

        fireEvent.click(screen.getByTitle('card.addFavorite'));

        await screen.findByTitle('card.addFavorite');
        expect(mockShowToast).toHaveBeenCalledWith('Добавлено в избранное ❤️', 'success');
    });

    it('does not request AI explanation for guests', async () => {
        render(<SmartCard term={mockTerm as any} />);

        fireEvent.click(screen.getByLabelText('Объяснить с AI: Тестовый Термин'));
        fireEvent.click(screen.getByRole('button', { name: 'Объяснить проще' }));

        expect(await screen.findByText('Гостевой предпросмотр использован. Войдите, чтобы открыть полные AI-объяснения.')).toBeInTheDocument();
        await waitFor(() => {
            expect(mockFetchTermExplainResponse).not.toHaveBeenCalled();
        });
    });
});
