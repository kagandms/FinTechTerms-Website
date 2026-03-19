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
        isAuthenticated: false,
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
    it('renders a dark-mode-safe explore words CTA when no favorites exist', () => {
        render(<QuizPage />);

        const exploreLink = screen.getByRole('link', { name: /quiz.exploreWords/i });
        expect(exploreLink.className).toContain('bg-primary-500');
        expect(exploreLink.className).toContain('dark:bg-primary-400');
        expect(exploreLink.className).toContain('text-white');
    });
});
