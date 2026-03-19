
import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import HomeClient from '@/app/HomeClient';

// Mock dependencies
jest.mock('@/contexts/LanguageContext', () => ({
    useLanguage: () => ({
        language: 'en',
        t: (key: string) => key
    })
}));

jest.mock('@/contexts/SRSContext', () => ({
    useSRS: () => ({
        terms: [
            { id: '1', term_en: 'Test Term 1', category: 'Fintech' },
            { id: '2', term_en: 'Test Term 2', category: 'Finance' }
        ],
        userProgress: {
            current_streak: 5,
            quiz_history: [],
            last_study_date: null,
            favorites: []
        },
        stats: {
            totalFavorites: 3,
            averageRetention: 85,
            mastered: 2,
            learning: 1,
            dueToday: 1
        }
    })
}));

jest.mock('@/contexts/ThemeContext', () => ({
    useTheme: () => ({
        resolvedTheme: 'light',
        setTheme: jest.fn()
    })
}));

jest.mock('@/contexts/AuthContext', () => ({
    useAuth: () => ({
        isAuthenticated: true,
    }),
}));

// Mock Child Components to simplify integration test
jest.mock('@/components/DailyReview', () => () => <div data-testid="daily-review">Daily Review</div>);
jest.mock('@/components/SmartCard', () => ({ term }: { term: any }) => <div data-testid="smart-card">{term.term_en}</div>);
jest.mock('@/components/LanguageSwitcher', () => () => <div>Language Switcher</div>);
jest.mock('@/components/InstallButton', () => () => <div data-testid="install-button">Install App</div>);
jest.mock('@/components/TelegramBanner', () => () => <div data-testid="telegram-banner">Telegram Banner</div>);

// Mock Next.js Components
jest.mock('next/image', () => {
    return ({ src, alt, fill, priority, ...props }: any) => {
        // eslint-disable-next-line @next/next/no-img-element
        return <img src={src} alt={alt} {...props} data-test-fill={fill} />;
    }
});
jest.mock('next/link', () => {
    return ({ children, href, ...props }: any) => {
        return <a href={href} {...props}>{children}</a>;
    }
});
jest.mock('next/navigation', () => ({
    useRouter: () => ({
        push: jest.fn(),
    }),
}));

describe('Home Page (Client)', () => {
    it('renders the header and title', () => {
        render(<HomeClient />);
        // Check for FinTechTerms multiple times (mobile and desktop headers)
        const titles = screen.getAllByText('FinTechTerms');
        expect(titles.length).toBeGreaterThan(0);
    });

    it('renders daily review section', () => {
        render(<HomeClient />);
        expect(screen.getByTestId('daily-review')).toBeInTheDocument();
    });

    it('renders recent terms', () => {
        render(<HomeClient />);
        expect(screen.getByText('home.recentTerms')).toBeInTheDocument();
        expect(screen.getByText('Test Term 1')).toBeInTheDocument();
        expect(screen.getByText('Test Term 2')).toBeInTheDocument();
    });

    it('renders category preview cards', () => {
        render(<HomeClient />);
        expect(screen.getByText('categories.Fintech')).toBeInTheDocument();
        expect(screen.getByText('categories.Finance')).toBeInTheDocument();
        expect(screen.getByText('categories.Technology')).toBeInTheDocument();
    });

    it('renders install CTA surfaces on the home page', () => {
        render(<HomeClient />);
        expect(screen.getAllByTestId('install-button').length).toBeGreaterThan(0);
    });
});
