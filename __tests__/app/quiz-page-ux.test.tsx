/**
 * @jest-environment jsdom
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

import QuizPage from '@/app/quiz/QuizClient';

const mockAuthState = {
    entitlements: {
        canUseAdvancedAnalytics: false,
        canUseMistakeReview: false,
        canUseReviewMode: false,
    },
    isAuthenticated: false,
    requiresProfileCompletion: false,
};

const mockSrsState = {
    dueTerms: [],
    quizPreview: {
        attemptCount: 0,
        correctCount: 0,
        avgResponseTimeMs: null,
    },
    mistakeReviewQueue: [],
    recordQuizPreviewAttempt: jest.fn(),
    recordMistakeReviewMiss: jest.fn(),
    clearMistakeReviewTerm: jest.fn(),
    submitQuizAnswer: jest.fn(),
    stats: {
        totalFavorites: 0,
        mastered: 0,
        learning: 0,
    },
    terms: [],
    userProgress: {
        favorites: [],
        quiz_history: [],
        current_streak: 0,
    },
    isLoading: false,
    termsStatus: 'ready',
    progressStatus: 'ready',
    refreshData: jest.fn(),
};

jest.mock('@/contexts/LanguageContext', () => ({
    useLanguage: () => ({
        language: 'en',
        t: (key: string) => key,
    }),
}));

jest.mock('@/contexts/AuthContext', () => ({
    useAuth: () => mockAuthState,
}));

jest.mock('next/navigation', () => ({
    useRouter: () => ({
        push: jest.fn(),
    }),
}));

jest.mock('@/contexts/SRSContext', () => ({
    useSRS: () => mockSrsState,
}));

jest.mock('@/components/QuizCard', () => () => null);
jest.mock('@/components/DataStateCard', () => ({ title, description }: { title: string; description?: string }) => (
    <div>
        <div>{title}</div>
        {description ? <div>{description}</div> : null}
    </div>
));

jest.mock('next/link', () => ({
    __esModule: true,
    default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
        <a href={href} {...props}>
            {children}
        </a>
    ),
}));

describe('QuizPage UX', () => {
    beforeEach(() => {
        mockAuthState.entitlements = {
            canUseAdvancedAnalytics: false,
            canUseMistakeReview: false,
            canUseReviewMode: false,
        };
        mockAuthState.isAuthenticated = false;
        mockAuthState.requiresProfileCompletion = false;

        mockSrsState.dueTerms = [];
        mockSrsState.quizPreview = {
            attemptCount: 0,
            correctCount: 0,
            avgResponseTimeMs: null,
        };
        mockSrsState.mistakeReviewQueue = [];
        mockSrsState.stats = {
            totalFavorites: 0,
            mastered: 0,
            learning: 0,
        };
        mockSrsState.terms = [];
        mockSrsState.userProgress = {
            favorites: [],
            quiz_history: [],
            current_streak: 0,
        };
        mockSrsState.termsStatus = 'ready';
        mockSrsState.progressStatus = 'ready';
    });

    it('shows the locked-review CTA while keeping quick quiz available for guests', () => {
        render(<QuizPage />);

        const profileLink = screen.getByRole('link', { name: /Open Profile/i });
        expect(profileLink.className).toContain('bg-primary-500');
        expect(profileLink.className).toContain('text-white');
        expect(screen.getByText('quiz.startQuickQuiz')).toBeInTheDocument();
    });

    it('shows Mistake Review when the persisted mistake queue contains quick quiz misses', () => {
        mockAuthState.entitlements = {
            canUseAdvancedAnalytics: true,
            canUseMistakeReview: true,
            canUseReviewMode: true,
        };
        mockAuthState.isAuthenticated = true;
        mockSrsState.mistakeReviewQueue = ['term-1'];
        mockSrsState.terms = [
            { id: 'term-1', category: 'Finance' },
            { id: 'term-2', category: 'Fintech' },
        ];

        render(<QuizPage />);

        expect(screen.getByTestId('start-mistake-review')).toBeInTheDocument();
        expect(screen.queryByText('There are no recent incorrect answers yet. Use Quick Quiz first to build this queue.')).not.toBeInTheDocument();
    });
});
