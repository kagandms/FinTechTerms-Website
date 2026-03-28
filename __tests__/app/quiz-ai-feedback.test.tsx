/**
 * @jest-environment jsdom
 */

import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

import QuizPage from '@/app/quiz/QuizClient';

const mockFetchQuizFeedback = jest.fn();

const quizTerms = [
    { id: 'term-1', category: 'Finance' },
    { id: 'term-2', category: 'Finance' },
    { id: 'term-3', category: 'Fintech' },
    { id: 'term-4', category: 'Technology' },
    { id: 'term-5', category: 'Technology' },
];

jest.mock('@/contexts/LanguageContext', () => ({
    useLanguage: () => ({
        language: 'en',
        t: (key: string) => key,
    }),
}));

jest.mock('@/contexts/AuthContext', () => ({
    useAuth: () => ({
        entitlements: {
            canUseAdvancedAnalytics: true,
            canUseMistakeReview: true,
            canUseReviewMode: true,
        },
        isAuthenticated: true,
        requiresProfileCompletion: false,
    }),
}));

jest.mock('@/contexts/SRSContext', () => ({
    useSRS: () => ({
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
            totalFavorites: 5,
            mastered: 0,
            learning: 5,
            dueToday: 0,
            averageRetention: 0,
        },
        terms: quizTerms,
        userProgress: {
            favorites: quizTerms.map((term) => term.id),
            quiz_history: [],
            current_streak: 0,
        },
        isLoading: false,
        termsStatus: 'ready',
        progressStatus: 'ready',
        refreshData: jest.fn(),
    }),
}));

jest.mock('@/lib/ai/client', () => ({
    fetchQuizFeedback: (...args: unknown[]) => mockFetchQuizFeedback(...args),
}));

jest.mock('@/utils/ai-session', () => ({
    getAiGuestTeaserUsage: () => ({
        quizFeedbackCount: 0,
        termExplainCount: 0,
        chatMessageCount: 0,
    }),
    incrementAiGuestTeaserUsage: jest.fn(() => ({
        quizFeedbackCount: 1,
        termExplainCount: 0,
        chatMessageCount: 0,
    })),
}));

jest.mock('@/components/MultipleChoiceQuizCard', () => () => null);
jest.mock('@/components/QuizCard', () => ({
    __esModule: true,
    default: ({ onAnswer }: { onAnswer: (input: { isCorrect: boolean; responseTimeMs: number }) => void }) => (
        <button type="button" onClick={() => void onAnswer({ isCorrect: false, responseTimeMs: 800 })}>
            answer-wrong
        </button>
    ),
}));

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

describe('QuizPage AI feedback', () => {
    it('shows AI feedback after a wrong answer in flashcard mode', async () => {
        mockFetchQuizFeedback.mockResolvedValue({
            whyWrong: 'Wrong because you mixed the concept.',
            whyCorrect: 'The correct answer points to the right definition.',
            memoryHook: 'Think of the official definition first.',
            confusedWith: 'Often confused with a close finance term.',
        });

        render(<QuizPage />);

        fireEvent.click(screen.getByRole('button', { name: 'quiz.startQuickQuiz' }));
        fireEvent.click(screen.getByRole('button', { name: 'quiz.categoryAll' }));
        fireEvent.click(screen.getByRole('button', { name: '5' }));
        fireEvent.click(screen.getByRole('button', { name: 'answer-wrong' }));

        expect(await screen.findByText('AI memory coach')).toBeInTheDocument();
        expect(screen.getByText('Wrong because you mixed the concept.')).toBeInTheDocument();
    });
});
