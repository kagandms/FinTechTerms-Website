import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

const mockUseLanguage = jest.fn();
const mockUseSRS = jest.fn();
const mockUseAuth = jest.fn();
const mockPush = jest.fn();

jest.mock('@/contexts/LanguageContext', () => ({
    useLanguage: () => mockUseLanguage(),
}));

jest.mock('@/contexts/SRSContext', () => ({
    useSRS: () => mockUseSRS(),
}));

jest.mock('@/contexts/AuthContext', () => ({
    useAuth: () => mockUseAuth(),
}));

jest.mock('@/components/QuizCard', () => ({
    __esModule: true,
    default: function MockQuizCard() {
        return <div data-testid="quiz-card">QuizCard</div>;
    },
}));

jest.mock('@/components/SessionTracker', () => ({
    incrementQuizAttempt: jest.fn(),
}));

jest.mock('next/navigation', () => ({
    useRouter: () => ({
        push: mockPush,
    }),
}));

jest.mock('next/link', () => {
    return function MockNextLink({
        children,
        href,
        ...props
    }: {
        children: React.ReactNode;
        href: string;
    }) {
        return <a href={href} {...props}>{children}</a>;
    };
});

const createTerm = (id: string, category: 'Fintech' | 'Finance' | 'Technology') => ({
    id,
    term_en: `Term ${id}`,
    term_ru: `Терм ${id}`,
    term_tr: `Terim ${id}`,
    phonetic_en: '',
    phonetic_ru: '',
    phonetic_tr: '',
    category,
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
});

const favoriteTerms = Array.from({ length: 5 }, (_unused, index) => createTerm(`fav-${index + 1}`, 'Finance'));
const otherTerms = [
    createTerm('other-1', 'Finance'),
    createTerm('other-2', 'Technology'),
];

describe('QuizClient quick quiz counts', () => {
    beforeEach(() => {
        mockUseLanguage.mockReturnValue({
            language: 'en',
            t: (key: string) => ({
                'quiz.startQuickQuiz': 'Start Flashcards',
                'quiz.favoritesMinimumRequired': 'Favorites-only mode needs at least {count} saved favorites.',
                'quiz.favoritesOnly': 'Favorites Only',
                'categories.Finance': 'Finance',
                'quiz.questionCount': 'Number of Questions:',
                'quiz.title': 'Practice',
                'quiz.categorySelect': 'Choose Category:',
                'quiz.categoryTechnology': 'Software',
                'quiz.categoryAll': 'All',
                'quiz.progressSaved': 'Progress saved.',
                'quiz.quickQuiz': 'Flashcards',
                'common.home': 'Home',
            }[key] ?? key),
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

        mockUseSRS.mockReturnValue({
            terms: [...favoriteTerms, ...otherTerms],
            userProgress: {
                user_id: 'user-1',
                favorites: favoriteTerms.map((term) => term.id),
                current_language: 'en',
                quiz_history: [],
                total_words_learned: 0,
                current_streak: 0,
                last_study_date: null,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            },
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
            favoritesRemaining: Infinity,
            isSyncing: false,
            isLoading: false,
            termsStatus: 'ready',
            progressStatus: 'ready',
            termsError: null,
            progressError: null,
            stats: {
                totalFavorites: favoriteTerms.length,
                mastered: 0,
                learning: favoriteTerms.length,
                dueToday: 0,
                averageRetention: 0,
            },
        });
    });

    it('shows the filtered favorites-only pool count and uses the same count when the quiz starts', () => {
        const { default: QuizClient } = require('@/app/quiz/QuizClient');

        render(<QuizClient />);

        fireEvent.click(screen.getByRole('button', { name: 'Start Flashcards' }));
        fireEvent.click(screen.getByRole('button', { name: 'Favorites Only' }));
        fireEvent.click(screen.getByRole('button', { name: 'Finance' }));

        expect(screen.getByText('Available questions: 5')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: '5' })).toBeEnabled();
        expect(screen.getByRole('button', { name: '10' })).toBeDisabled();

        fireEvent.click(screen.getByRole('button', { name: '5' }));

        expect(screen.getByText('1 / 5')).toBeInTheDocument();
        expect(screen.getByTestId('quiz-card')).toBeInTheDocument();
    });

    it('warns when favorites-only mode has fewer than 5 saved favorites', () => {
        const { default: QuizClient } = require('@/app/quiz/QuizClient');
        const sparseFavorites = favoriteTerms.slice(0, 2);

        mockUseSRS.mockReturnValue({
            terms: [...sparseFavorites, ...otherTerms],
            userProgress: {
                user_id: 'user-1',
                favorites: sparseFavorites.map((term) => term.id),
                current_language: 'en',
                quiz_history: [],
                total_words_learned: 0,
                current_streak: 0,
                last_study_date: null,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            },
            stats: {
                totalFavorites: 2,
                mastered: 0,
                learning: 2,
                dueToday: 0,
                averageRetention: 0,
            },
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
            favoritesRemaining: Infinity,
            isSyncing: false,
            isLoading: false,
            termsStatus: 'ready',
            progressStatus: 'ready',
            termsError: null,
            progressError: null,
        });

        render(<QuizClient />);

        fireEvent.click(screen.getByRole('button', { name: 'Start Flashcards' }));

        expect(screen.getByText('Favorites-only mode needs at least 5 saved favorites.')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Favorites Only' })).toBeDisabled();
    });
});
