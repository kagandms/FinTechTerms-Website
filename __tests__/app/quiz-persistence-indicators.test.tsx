/**
 * @jest-environment jsdom
 */

import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

import QuizPage from '@/app/quiz/QuizClient';

const mockIncrementQuizAttempt = jest.fn();

const mockAuthState = {
    entitlements: {
        canUseAiFeatures: false,
        canUseAdvancedAnalytics: true,
        canUseMistakeReview: false,
        canUseReviewMode: true,
    },
    isAuthenticated: true,
    requiresProfileCompletion: false,
};

const mockSubmitQuizAnswer = jest.fn();

const dueTerm = {
    id: 'term-1',
    category: 'Finance' as const,
};
const secondDueTerm = {
    id: 'term-2',
    category: 'Fintech' as const,
};

const mockSrsState = {
    dueTerms: [dueTerm, secondDueTerm],
    quizPreview: {
        attemptCount: 0,
        correctCount: 0,
        avgResponseTimeMs: null,
    },
    mistakeReviewQueue: [],
    recordQuizPreviewAttempt: jest.fn(),
    recordMistakeReviewMiss: jest.fn(),
    clearMistakeReviewTerm: jest.fn(),
    submitQuizAnswer: (...args: unknown[]) => mockSubmitQuizAnswer(...args),
    stats: {
        totalFavorites: 1,
        mastered: 0,
        learning: 1,
    },
    terms: [dueTerm, secondDueTerm],
    userProgress: {
        favorites: ['term-1', 'term-2'],
        quiz_history: [],
        current_streak: 0,
    },
    isLoading: false,
    termsStatus: 'ready' as const,
    progressStatus: 'ready' as const,
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

jest.mock('@/contexts/SRSContext', () => ({
    useSRS: () => mockSrsState,
}));

jest.mock('@/components/SessionTracker', () => ({
    incrementQuizAttempt: () => mockIncrementQuizAttempt(),
}));

jest.mock('next/navigation', () => ({
    useRouter: () => ({
        push: jest.fn(),
    }),
}));

jest.mock('@/components/QuizCard', () => ({
    __esModule: true,
    default: ({ onAnswer }: { onAnswer: (payload: { isCorrect: boolean; responseTimeMs: number }) => Promise<void> }) => (
        <button
            type="button"
            onClick={() => {
                void onAnswer({
                    isCorrect: true,
                    responseTimeMs: 1200,
                });
            }}
        >
            answer
        </button>
    ),
}));

jest.mock('@/components/MultipleChoiceQuizCard', () => () => null);
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

describe('Quiz persistence indicators', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockSrsState.dueTerms = [dueTerm, secondDueTerm];
        mockSrsState.terms = [dueTerm, secondDueTerm];
        mockSrsState.userProgress = {
            favorites: ['term-1', 'term-2'],
            quiz_history: [],
            current_streak: 0,
        };
    });

    it('shows a queued indicator instead of saved when the answer is only queued', async () => {
        mockSubmitQuizAnswer.mockResolvedValueOnce({
            persistence: 'queued',
        });

        render(<QuizPage />);

        fireEvent.click(screen.getByRole('button', { name: 'quiz.startSrsReview' }));
        fireEvent.click(screen.getByRole('button', { name: 'answer' }));

        await waitFor(() => {
            expect(screen.getByTestId('quiz-queued-indicator')).toBeInTheDocument();
        });
        expect(screen.queryByTestId('quiz-saved-indicator')).not.toBeInTheDocument();
        expect(mockIncrementQuizAttempt).toHaveBeenCalledTimes(1);
    });

    it('shows a saved indicator when the answer is persisted immediately', async () => {
        mockSubmitQuizAnswer.mockResolvedValueOnce({
            persistence: 'persisted',
        });

        render(<QuizPage />);

        fireEvent.click(screen.getByRole('button', { name: 'quiz.startSrsReview' }));
        fireEvent.click(screen.getByRole('button', { name: 'answer' }));

        await waitFor(() => {
            expect(screen.getByTestId('quiz-saved-indicator')).toBeInTheDocument();
        });
        expect(screen.queryByTestId('quiz-queued-indicator')).not.toBeInTheDocument();
        expect(mockIncrementQuizAttempt).toHaveBeenCalledTimes(1);
    });
});
