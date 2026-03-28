/**
 * @jest-environment jsdom
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

import QuizPage from '@/app/quiz/QuizClient';

jest.mock('@/contexts/LanguageContext', () => ({
    useLanguage: () => ({
        language: 'en',
        t: (key: string) => key,
    }),
}));

jest.mock('@/contexts/AuthContext', () => ({
    useAuth: () => ({
        entitlements: {
            canUseAdvancedAnalytics: false,
            canUseMistakeReview: false,
            canUseReviewMode: false,
        },
        isAuthenticated: false,
        requiresProfileCompletion: false,
    }),
}));

jest.mock('next/navigation', () => ({
    useRouter: () => ({
        push: jest.fn(),
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
        recordQuizPreviewAttempt: jest.fn(),
        submitQuizAnswer: jest.fn(),
        stats: {
            totalFavorites: 0,
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
    }),
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
    it('shows the locked-review CTA while keeping quick quiz available for guests', () => {
        render(<QuizPage />);

        const profileLink = screen.getByRole('link', { name: /Open Profile/i });
        expect(profileLink.className).toContain('bg-primary-500');
        expect(profileLink.className).toContain('text-white');
        expect(screen.getByText('quiz.startQuickQuiz')).toBeInTheDocument();
    });
});
