
import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import DailyReview from '@/components/DailyReview';

// Mock dependencies
jest.mock('@/contexts/LanguageContext', () => ({
    useLanguage: () => ({
        t: (key: string) => key
    })
}));

const mockUseSRS = jest.fn();

jest.mock('@/contexts/SRSContext', () => ({
    useSRS: () => mockUseSRS()
}));

jest.mock('@/contexts/AuthContext', () => ({
    useAuth: () => ({
        entitlements: {
            canUseReviewMode: true,
        },
        requiresProfileCompletion: false,
    }),
}));

jest.mock('next/link', () => {
    return ({ children, href }: { children: React.ReactNode; href: string }) => {
        return <a href={href}>{children}</a>;
    }
});

describe('DailyReview Component', () => {
    it('renders "Start Quiz" when terms are due', () => {
        mockUseSRS.mockReturnValue({
            dueTerms: [{ id: '1' }, { id: '2' }], // 2 due terms
            stats: { totalFavorites: 10, mastered: 5, learning: 3 }
        });

        render(<DailyReview />);

        expect(screen.getByText('home.dailyReview')).toBeInTheDocument();
        // Check count
        expect(screen.getByText('2')).toBeInTheDocument();
        expect(screen.getByText('home.dueToday')).toBeInTheDocument();
        // Check button
        expect(screen.getByText('home.startQuiz')).toBeInTheDocument();

        // Stats should be visible
        expect(screen.getByText('profile.masteredWords')).toBeInTheDocument();
        expect(screen.getByText('5')).toBeInTheDocument();
        expect(screen.getByText('3')).toBeInTheDocument();
    });

    it('renders "No Cards Due" message when dueTerms is empty but favorites exist', () => {
        mockUseSRS.mockReturnValue({
            dueTerms: [],
            stats: { totalFavorites: 10, mastered: 5, learning: 5 }
        });

        render(<DailyReview />);

        expect(screen.getByText('home.noCardsDue')).toBeInTheDocument();
        // Start quiz button should NOT be there
        expect(screen.queryByText('home.startQuiz')).not.toBeInTheDocument();
    });

    it('renders "Add to Favorites" prompt when totalFavorites is 0', () => {
        mockUseSRS.mockReturnValue({
            dueTerms: [],
            stats: { totalFavorites: 0, mastered: 0, learning: 0 }
        });

        render(<DailyReview />);

        expect(screen.getByText('home.addToFavorites')).toBeInTheDocument();
        expect(screen.getByText('home.exploreWords')).toBeInTheDocument();
    });
});
