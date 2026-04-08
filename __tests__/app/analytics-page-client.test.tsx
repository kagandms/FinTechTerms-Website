import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import AnalyticsPageClient from '@/app/(app)/analytics/AnalyticsPageClient';

const mockUseLanguage = jest.fn();
const mockUseSRS = jest.fn();
const mockUseAuth = jest.fn();

jest.mock('@/contexts/LanguageContext', () => ({
    useLanguage: () => mockUseLanguage(),
}));

jest.mock('@/contexts/SRSContext', () => ({
    useSRS: () => mockUseSRS(),
}));

jest.mock('@/contexts/AuthContext', () => ({
    useAuth: () => mockUseAuth(),
}));

jest.mock('@/lib/i18n', () => ({
    getTranslationValue: () => ({
        title: 'Analytics',
        subtitle: 'Subtitle',
        back: 'Back',
        overview: 'Overview',
        totalTerms: 'Total terms',
        favorites: 'Favorites',
        reviewed: 'Reviewed',
        mastered: 'Mastered',
        categoryAnalysis: 'Category analysis',
        terms: 'terms',
        difficulty: 'Difficulty',
        retention: 'Retention',
        srsDistribution: 'SRS distribution',
        box: 'Box',
        learningProgress: 'Learning progress',
        streak: 'Streak',
        days: 'Days',
        accuracy: 'Accuracy',
        totalReviews: 'Total reviews',
        avgResponseTime: 'Average response time',
        recentActivity: 'Recent activity',
        noActivity: 'No activity',
        correct: 'Correct',
        wrong: 'Wrong',
        exportData: 'Export',
        forResearch: 'For research',
        unknownTerm: 'Unknown',
        srsLevels: ['L1', 'L2', 'L3', 'L4', 'L5'],
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

describe('AnalyticsPageClient', () => {
    const originalFetch = global.fetch;

    beforeEach(() => {
        mockUseLanguage.mockReturnValue({
            language: 'en',
            t: (key: string) => ({
                'categories.Fintech': 'Fintech',
                'categories.Finance': 'Finance',
                'categories.Technology': 'Technology',
            }[key] ?? key),
        });
        mockUseAuth.mockReturnValue({
            entitlements: {
                canUseAiFeatures: true,
                canUseAdvancedAnalytics: true,
            },
            isAuthenticated: true,
            requiresProfileCompletion: false,
        });
        mockUseSRS.mockReturnValue({
            terms: [
                {
                    id: 'fav-finance-1',
                    category: 'Finance',
                    term_en: 'Finance 1',
                    term_ru: 'Finance 1',
                    term_tr: 'Finance 1',
                    difficulty_score: 2,
                    retention_rate: 0.5,
                    times_reviewed: 1,
                    srs_level: 2,
                },
                {
                    id: 'fav-finance-2',
                    category: 'Finance',
                    term_en: 'Finance 2',
                    term_ru: 'Finance 2',
                    term_tr: 'Finance 2',
                    difficulty_score: 3,
                    retention_rate: 0.75,
                    times_reviewed: 2,
                    srs_level: 4,
                },
                {
                    id: 'non-favorite-finance',
                    category: 'Finance',
                    term_en: 'Finance 3',
                    term_ru: 'Finance 3',
                    term_tr: 'Finance 3',
                    difficulty_score: 5,
                    retention_rate: 1,
                    times_reviewed: 7,
                    srs_level: 5,
                },
                {
                    id: 'tech-favorite',
                    category: 'Technology',
                    term_en: 'Tech',
                    term_ru: 'Tech',
                    term_tr: 'Tech',
                    difficulty_score: 1,
                    retention_rate: 0.25,
                    times_reviewed: 1,
                    srs_level: 1,
                },
            ],
            userProgress: {
                favorites: ['fav-finance-1', 'fav-finance-2', 'tech-favorite'],
                quiz_history: [],
                current_streak: 0,
            },
            stats: {
                totalFavorites: 3,
                mastered: 1,
                learning: 2,
                dueToday: 0,
            },
            quizPreview: {
                attemptCount: 0,
                correctCount: 0,
                avgResponseTimeMs: null,
            },
        });
    });

    afterEach(() => {
        global.fetch = originalFetch;
        jest.useRealTimers();
    });

    it('computes category counts from favorites only', () => {
        render(
            <AnalyticsPageClient
                learningStats={{
                    ok: true,
                    data: {
                        heatmap: [],
                        currentStreak: 0,
                        lastStudyDate: null,
                        badges: [],
                        activeDays: 0,
                        totalActivity: 0,
                        todayActivity: 0,
                        totalReviews: 3,
                        correctReviews: 2,
                        accuracy: 67,
                        avgResponseTimeMs: 1200,
                        recentAttempts: [],
                    },
                }}
            />
        );

        expect(screen.getByText('Finance')).toBeInTheDocument();
        expect(screen.getByText('2 terms')).toBeInTheDocument();
        expect(screen.queryByText('3 terms')).not.toBeInTheDocument();
    });

    it('does not fall back to local authenticated quiz history when server aggregates are unavailable', () => {
        mockUseSRS.mockReturnValue({
            terms: [
                {
                    id: 'fav-finance-1',
                    category: 'Finance',
                    term_en: 'Finance 1',
                    term_ru: 'Finance 1',
                    term_tr: 'Finance 1',
                    difficulty_score: 2,
                    retention_rate: 0.5,
                    times_reviewed: 1,
                    srs_level: 2,
                },
            ],
            userProgress: {
                favorites: ['fav-finance-1'],
                quiz_history: [
                    {
                        id: 'attempt-1',
                        term_id: 'fav-finance-1',
                        is_correct: true,
                        response_time_ms: 900,
                        timestamp: '2026-03-11T12:00:00.000Z',
                        quiz_type: 'daily',
                    },
                ],
                current_streak: 2,
            },
            stats: {
                totalFavorites: 1,
                mastered: 0,
                learning: 1,
                dueToday: 0,
            },
            quizPreview: {
                attemptCount: 0,
                correctCount: 0,
                avgResponseTimeMs: null,
            },
        });

        render(
            <AnalyticsPageClient
                learningStats={{
                    ok: false,
                    error: {
                        code: 'LEARNING_STATS_UNAVAILABLE',
                        message: 'Unavailable',
                        status: 500,
                    },
                }}
            />
        );

        expect(screen.getAllByText('—').length).toBeGreaterThan(0);
        expect(screen.getByText('No activity')).toBeInTheDocument();
        expect(screen.queryByText('Correct')).not.toBeInTheDocument();
    });

    it('shows the teaser analytics surface when advanced analytics are locked', () => {
        mockUseAuth.mockReturnValue({
            entitlements: {
                canUseAiFeatures: false,
                canUseAdvancedAnalytics: false,
            },
            isAuthenticated: false,
            requiresProfileCompletion: false,
        });
        mockUseSRS.mockReturnValue({
            terms: [],
            userProgress: {
                favorites: [],
                quiz_history: [],
                current_streak: 0,
            },
            stats: {
                totalFavorites: 0,
                mastered: 0,
                learning: 0,
                dueToday: 0,
            },
            quizPreview: {
                attemptCount: 4,
                correctCount: 3,
                avgResponseTimeMs: 980,
            },
        });

        render(
            <AnalyticsPageClient
                learningStats={{
                    ok: false,
                    error: {
                        code: 'UNAUTHORIZED',
                        message: 'Unauthorized',
                        status: 401,
                    },
                }}
            />
        );

        expect(screen.getByText('Unlock full member analytics')).toBeInTheDocument();
        expect(screen.getByText('This session attempts')).toBeInTheDocument();
        expect(screen.getByText('%75')).toBeInTheDocument();
        expect(screen.queryByText('Category analysis')).not.toBeInTheDocument();
    });

    it('shows a bounded timeout error when analytics export stalls', async () => {
        jest.useFakeTimers();
        global.fetch = jest.fn().mockImplementation((_input: RequestInfo | URL, init?: RequestInit) => (
            new Promise<Response>((_resolve, reject) => {
                init?.signal?.addEventListener('abort', () => {
                    const error = new Error('aborted');
                    error.name = 'AbortError';
                    reject(error);
                }, { once: true });
            })
        )) as typeof fetch;

        render(
            <AnalyticsPageClient
                learningStats={{
                    ok: true,
                    data: {
                        heatmap: [],
                        currentStreak: 0,
                        lastStudyDate: null,
                        badges: [],
                        activeDays: 0,
                        totalActivity: 0,
                        todayActivity: 0,
                        totalReviews: 3,
                        correctReviews: 2,
                        accuracy: 67,
                        avgResponseTimeMs: 1200,
                        recentAttempts: [],
                    },
                }}
            />
        );

        fireEvent.click(screen.getByRole('button', { name: /Export/i }));

        await act(async () => {
            await jest.advanceTimersByTimeAsync(10_000);
        });

        await waitFor(() => {
            expect(screen.getByText('Analytics export timed out. Please try again.')).toBeInTheDocument();
        });
    });
});
