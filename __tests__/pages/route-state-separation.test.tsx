import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import FavoritesClient from '@/app/favorites/FavoritesClient';
import SearchClient from '@/app/search/SearchClient';

const mockUseLanguage = jest.fn();
const mockUseSRS = jest.fn();
const mockUseAuth = jest.fn();
const mockUseSearchParams = jest.fn();
const mockPush = jest.fn();
const mockReplace = jest.fn();

jest.mock('@/contexts/LanguageContext', () => ({
    useLanguage: () => mockUseLanguage(),
}));

jest.mock('@/contexts/SRSContext', () => ({
    useSRS: () => mockUseSRS(),
}));

jest.mock('@/contexts/AuthContext', () => ({
    useAuth: () => mockUseAuth(),
}));

jest.mock('@/components/SmartCard', () => ({
    __esModule: true,
    default: ({ term }: { term: { term_en?: string } }) => <div data-testid="smart-card">{term.term_en}</div>,
}));

jest.mock('next/navigation', () => ({
    usePathname: () => '/search',
    useRouter: () => ({
        push: mockPush,
        replace: mockReplace,
    }),
    useSearchParams: () => mockUseSearchParams(),
}));

jest.mock('@/components/QuizCard', () => ({
    __esModule: true,
    default: () => <div data-testid="quiz-card">QuizCard</div>,
}));

jest.mock('@/components/SessionTracker', () => ({
    incrementQuizAttempt: jest.fn(),
}));

jest.mock('next/link', () => {
    return ({ children, href, ...props }: { children: React.ReactNode; href: string }) => (
        <a href={href} {...props}>{children}</a>
    );
});

const baseTerm = {
    id: 'term-1',
    term_en: 'API',
    term_ru: 'API',
    term_tr: 'API',
    phonetic_en: '',
    phonetic_ru: '',
    phonetic_tr: '',
    category: 'Fintech',
    definition_en: 'Definition',
    definition_ru: 'Определение',
    definition_tr: 'Tanim',
    example_sentence_en: 'Example',
    example_sentence_ru: 'Пример',
    example_sentence_tr: 'Ornek',
    context_tags: {},
    regional_market: 'GLOBAL',
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

const baseProgress = {
    user_id: 'user-1',
    favorites: [],
    current_language: 'ru',
    quiz_history: [],
    total_words_learned: 0,
    current_streak: 0,
    last_study_date: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
} as const;

const createSrsState = (overrides: Partial<ReturnType<typeof mockUseSRS>> = {}) => ({
    terms: [baseTerm],
    userProgress: baseProgress,
    dueTerms: [],
    quizPreview: {
        attemptCount: 0,
        correctCount: 0,
        avgResponseTimeMs: null,
    },
    mistakeReviewQueue: [],
    toggleFavorite: jest.fn(),
    isFavorite: jest.fn(),
    isFavoriteUpdating: jest.fn(),
    recordQuizPreviewAttempt: jest.fn(),
    recordMistakeReviewMiss: jest.fn(),
    clearMistakeReviewTerm: jest.fn(),
    submitQuizAnswer: jest.fn(),
    refreshData: jest.fn(),
    canAddMoreFavorites: true,
    favoritesRemaining: 50,
    isSyncing: false,
    isLoading: false,
    termsStatus: 'ready',
    progressStatus: 'ready',
    termsError: null,
    progressError: null,
    stats: {
        totalFavorites: 0,
        mastered: 0,
        learning: 1,
        dueToday: 0,
        averageRetention: 0,
    },
    ...overrides,
});

describe('Route state separation', () => {
    beforeEach(() => {
        mockPush.mockReset();
        mockReplace.mockReset();
        mockUseSearchParams.mockReturnValue(new URLSearchParams());

        const translationMap: Record<string, string> = {
            'search.title': 'Поиск',
            'search.description': 'Описание',
            'search.loadingTitle': 'Загружаем словарь',
            'search.loadingDescription': 'Подготавливаем термины для поиска. Пожалуйста, подождите.',
            'search.errorTitle': 'Ошибка загрузки данных',
            'search.errorDescription': 'Сейчас не удалось загрузить данные для поиска. Попробуйте еще раз.',
            'search.degradedTitle': 'Показаны сохраненные термины',
            'search.degradedDescription': 'Сервер недоступен. Поиск работает по последним сохраненным терминам.',
            'search.emptyTitle': 'Термины недоступны',
            'search.emptyDescription': 'Сейчас нет терминов для отображения.',
            'search.retry': 'Повторить',
            'search.results': 'результатов найдено',
            'search.noResultsTitle': 'Ничего не найдено',
            'search.noResultsDescription': 'Измените запрос или снимите активные фильтры, чтобы расширить выборку.',
            'search.filteredMarketTitle': 'Термины не найдены для выбранного рынка',
            'search.filteredMarketDescription': 'Выбранный рыночный фильтр не вернул терминов. Попробуйте другой рынок или сбросьте фильтр.',
            'search.containerLabel': 'Поиск терминов',
            'search.placeholder': 'Поиск',
            'search.clearSearch': 'Очистить поиск',
            'search.showFilters': 'Показать фильтры категорий',
            'search.hideFilters': 'Скрыть фильтры категорий',
            'search.allTerms': 'Все термины',
            'search.allMarkets': 'Все рынки',
            'search.marketLabel': 'Рыночная таксономия',
            'search.sortLabel': 'Порядок сортировки',
            'search.sort.alphaAsc': 'По алфавиту (А-Я)',
            'search.sort.alphaDesc': 'По алфавиту (Я-А)',
            'search.markets.MOEX': 'Рынок: MOEX',
            'search.markets.BIST': 'Рынок: BIST',
            'search.markets.GLOBAL': 'Рынок: GLOBAL',
            'favorites.loadingTitle': 'Загружаем избранное',
            'favorites.loadingDescription': 'Сохраняем ваши термины и подготавливаем список.',
            'favorites.errorTitle': 'Ошибка загрузки данных',
            'favorites.errorDescription': 'Сейчас не удалось загрузить избранные термины. Попробуйте еще раз.',
            'favorites.degradedTitle': 'Показаны сохраненные данные',
            'favorites.degradedDescription': 'Сервер недоступен. Отображаются последние сохраненные избранные термины.',
            'favorites.retry': 'Повторить',
            'favorites.emptyTitle': 'Пока нет избранных слов',
            'favorites.emptyDescription': 'Вы можете добавить слова в избранное, нажав на значок звезды во время изучения.',
            'favorites.explore': 'Изучать слова',
            'favorites.backToHome': 'Вернуться на главную',
            'favorites.backToProfile': 'Назад в профиль',
            'favorites.title': 'Мои избранные',
            'favorites.mobileTitle': 'Избранные',
            'favorites.description': 'Все термины, которые вы сохранили для изучения.',
            'quiz.syncingTitle': 'Синхронизируем данные повторения',
            'quiz.syncingDescription': 'Быстрый квиз уже доступен. Карточки повтора готовятся в фоне.',
            'categories.Fintech': 'Финтех',
            'categories.Finance': 'Финансы',
            'categories.Technology': 'Технологии',
        };

        mockUseLanguage.mockReturnValue({
            language: 'ru',
            t: (key: string) => translationMap[key] ?? key,
        });
        mockUseAuth.mockReturnValue({
            entitlements: {
                canUseAdvancedAnalytics: true,
                canUseMistakeReview: true,
                canUseReviewMode: true,
            },
            isAuthenticated: true,
            requiresProfileCompletion: false,
        });
        mockUseSRS.mockReturnValue(createSrsState());
    });

    it('keeps Search in loading state instead of rendering an empty fallback', () => {
        mockUseSRS.mockReturnValue(createSrsState({
            terms: [],
            isLoading: true,
            termsStatus: 'loading',
        }));

        render(<SearchClient />);

        expect(screen.getByText('Загружаем словарь')).toBeInTheDocument();
        expect(screen.queryByText('Термины недоступны')).not.toBeInTheDocument();
        expect(screen.queryByText('search.noResults')).not.toBeInTheDocument();
    });

    it('shows an error state for Favorites when progress loading fails instead of the empty state', () => {
        mockUseSRS.mockReturnValue(createSrsState({
            terms: [baseTerm],
            progressStatus: 'error',
        }));

        render(<FavoritesClient />);

        expect(screen.getByText('Ошибка загрузки данных')).toBeInTheDocument();
        expect(screen.queryByText('Пока нет избранных слов')).not.toBeInTheDocument();
    });

    it('renders cached favorites while authenticated progress is still loading', () => {
        mockUseSRS.mockReturnValue(createSrsState({
            terms: [baseTerm],
            userProgress: {
                ...baseProgress,
                favorites: ['term-1'],
            },
            progressStatus: 'loading',
        }));

        render(<FavoritesClient />);

        expect(screen.getByTestId('smart-card')).toBeInTheDocument();
        expect(screen.queryByText('Загружаем избранное')).not.toBeInTheDocument();
    });

    it('routes the favorites back link to profile when opened from the profile surface', () => {
        mockUseSearchParams.mockReturnValue(new URLSearchParams('from=profile'));

        render(<FavoritesClient />);

        expect(screen.getAllByRole('link', { name: /назад в профиль/i })[0]).toHaveAttribute('href', '/profile');
    });

    it('renders cached search terms while background sync is still loading', () => {
        mockUseSRS.mockReturnValue(createSrsState({
            terms: [baseTerm],
            termsStatus: 'loading',
        }));

        render(<SearchClient />);

        expect(screen.getByTestId('smart-card')).toBeInTheDocument();
        expect(screen.queryByText('Загружаем словарь')).not.toBeInTheDocument();
    });

    it('shows the quiz SRS error fallback instead of zero-state messaging when progress fails', () => {
        const { default: QuizClient } = require('@/app/quiz/QuizClient');

        mockUseSRS.mockReturnValue(createSrsState({
            progressStatus: 'error',
            stats: {
                totalFavorites: 0,
                mastered: 0,
                learning: 1,
                dueToday: 0,
                averageRetention: 0,
            },
        }));

        render(<QuizClient />);

        expect(screen.getByText('Данные SRS временно недоступны')).toBeInTheDocument();
        expect(screen.queryByText('quiz.orAddFavorites')).not.toBeInTheDocument();
        expect(screen.queryByText('quiz.noCards')).not.toBeInTheDocument();
    });

    it('keeps quick quiz available while progress is still syncing in the background', () => {
        const { default: QuizClient } = require('@/app/quiz/QuizClient');

        mockUseSRS.mockReturnValue(createSrsState({
            terms: [baseTerm],
            progressStatus: 'loading',
            userProgress: {
                ...baseProgress,
                favorites: [],
                quiz_history: [],
                current_streak: 0,
            },
            stats: {
                totalFavorites: 0,
                mastered: 0,
                learning: 1,
                dueToday: 0,
                averageRetention: 0,
            },
        }));

        render(<QuizClient />);

        expect(screen.getByText('Синхронизируем данные повторения')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'quiz.startQuickQuiz' })).toBeInTheDocument();
        expect(screen.queryByText('Загружаем квиз')).not.toBeInTheDocument();
    });
});
