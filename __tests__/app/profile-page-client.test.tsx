/**
 * @jest-environment jsdom
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';

import ProfilePageClient from '@/app/profile/ProfilePageClient';

const mockUseAuthLogic = jest.fn();
const mockUseTheme = jest.fn();
const mockUseLanguage = jest.fn();
const mockUseSRS = jest.fn();
const mockUseAuth = jest.fn();
const mockShowToast = jest.fn();
const mockSrsNotificationCard = jest.fn(() => <div data-testid="profile-srs-card" />);
const mockSettingsPanel = jest.fn((_props?: unknown) => <div data-testid="settings-panel" />);

const profileTranslationMap: Record<string, string> = {
    'profile.warningPartial': 'Some profile fields could not be loaded. Showing the latest available data.',
    'profile.warningUnavailable': 'Profile data is temporarily unavailable.',
    'profile.learningAnalyticsUnavailable': 'Spaced repetition analytics are temporarily unavailable.',
    'profile.renderError': 'The profile screen hit an unexpected error.',
    'profile.viewLibrary': 'View Library',
    'profile.favoritesTitle': 'My Favorites',
    'profile.savedWordsCount': '{count} words saved',
    'profile.guestCreateTitle': 'Create Account',
    'profile.guestCreateDescription': 'Save progress and sync devices.',
    'profile.registerCta': 'Sign Up',
    'profile.installTitle': 'Install App',
    'profile.installDescription': 'Add to your home screen. Enjoy offline mode and quick access.',
    'profile.contactTitle': 'Contact',
    'profile.contactDescription': 'Reach out to us with questions or suggestions:',
    'profile.footerDictionary': 'TR-EN-RU Economics & FinTech Dictionary',
    'profile.editProfileTitle': 'Edit Profile',
    'profile.editProfileDescription': 'Update your personal information and account settings.',
    'profile.edit': 'Edit',
    'profile.closeEdit': 'Close',
    'profile.title': 'Profile',
    'profile.guestMessage': 'Log in to save your progress.',
    'profile.welcomeBack': 'Welcome back, {name}',
    'auth.login': 'Sign In',
    'auth.logout': 'Log Out',
};

jest.mock('@/hooks/useAuthLogic', () => ({
    useAuthLogic: () => mockUseAuthLogic(),
}));

jest.mock('@/contexts/ThemeContext', () => ({
    useTheme: () => mockUseTheme(),
}));

jest.mock('@/contexts/LanguageContext', () => ({
    useLanguage: () => mockUseLanguage(),
}));

jest.mock('@/contexts/SRSContext', () => ({
    useSRS: () => mockUseSRS(),
}));

jest.mock('@/contexts/AuthContext', () => ({
    useAuth: () => mockUseAuth(),
}));

jest.mock('@/contexts/ToastContext', () => ({
    useToast: () => ({
        showToast: mockShowToast,
    }),
}));

jest.mock('@/components/features/profile/StatsGrid', () => ({
    StatsGrid: (props: { totalReviews: number | null; accuracy: number | null }) => (
        <div data-testid="stats-grid">
            {JSON.stringify({
                totalReviews: props.totalReviews,
                accuracy: props.accuracy,
            })}
        </div>
    ),
}));

jest.mock('@/components/features/profile/SettingsPanel', () => ({
    SettingsPanel: (props: unknown) => {
        mockSettingsPanel(props);
        return <div data-testid="settings-panel" />;
    },
}));

jest.mock('@/components/features/auth/AuthModal', () => ({
    AuthModal: () => null,
}));

jest.mock('@/components/features/profile/ResetConfirmModal', () => ({
    ResetConfirmModal: () => null,
}));

jest.mock('@/components/TelegramBanner', () => ({
    __esModule: true,
    default: () => null,
}));
jest.mock('@/components/features/profile/ProfileEditForm', () => ({
    ProfileEditForm: () => <div data-testid="profile-edit-form" />,
}));
jest.mock('@/components/InstallButton', () => ({
    __esModule: true,
    default: () => <div data-testid="install-button" />,
}));
jest.mock('@/components/profile/Heatmap', () => ({
    __esModule: true,
    default: () => null,
}));
jest.mock('@/components/profile/ProfileErrorBoundary', () => ({
    __esModule: true,
    default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
jest.mock('@/components/profile/AiStudyCoachCard', () => ({
    __esModule: true,
    default: () => <div data-testid="ai-study-coach-card" />,
}));
jest.mock('@/components/profile/SRSNotificationCard', () => ({
    __esModule: true,
    default: () => mockSrsNotificationCard(),
}));

describe('ProfilePageClient', () => {
    beforeEach(() => {
        jest.clearAllMocks();

        mockUseAuthLogic.mockReturnValue({
            user: { id: 'user-1', name: 'Alex Stone' },
            isAuthenticated: true,
            language: 'en',
            t: (key: string) => profileTranslationMap[key] ?? key,
            showAuthModal: false,
            setShowAuthModal: jest.fn(),
            setAuthMode: jest.fn(),
            showResetConfirm: false,
            setShowResetConfirm: jest.fn(),
            handleDataReset: jest.fn(),
            logout: jest.fn(),
            router: {
                push: jest.fn(),
            },
        });
        mockUseTheme.mockReturnValue({
            theme: 'light',
            setTheme: jest.fn(),
        });
        mockUseLanguage.mockReturnValue({
            language: 'en',
            setLanguage: jest.fn(),
            t: (key: string) => profileTranslationMap[key] ?? key,
        });
        mockUseSRS.mockReturnValue({
            stats: {
                totalFavorites: 3,
                mastered: 2,
                learning: 1,
                dueToday: 1,
            },
            refreshData: jest.fn(),
            userProgress: {
                quiz_history: [{ is_correct: false }],
                last_study_date: null,
            },
        });
        mockUseAuth.mockReturnValue({
            entitlements: {
                canUseAdvancedAnalytics: true,
            },
            favoriteLimit: Number.POSITIVE_INFINITY,
            isAuthenticated: true,
            refreshMemberState: jest.fn(),
            requiresProfileCompletion: false,
        });
    });

    it('derives accuracy from exact server counts', () => {
        render(
            <ProfilePageClient
                initialProfileData={null}
                profileWarningCode={null}
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
                        totalReviews: 20,
                        correctReviews: 15,
                        accuracy: 75,
                        avgResponseTimeMs: 1200,
                        recentAttempts: [],
                    },
                }}
            />
        );

        expect(screen.getByTestId('stats-grid')).toHaveTextContent('{"totalReviews":20,"accuracy":75}');
    });

    it('shows placeholders and warning toast when authenticated analytics are unavailable', async () => {
        render(
            <ProfilePageClient
                initialProfileData={null}
                profileWarningCode={null}
                learningStats={{
                    ok: false,
                    error: {
                        code: 'LEARNING_STATS_UNAVAILABLE',
                        message: 'Unable to load learning stats.',
                        status: 500,
                    },
                }}
            />
        );

        expect(screen.getByTestId('stats-grid')).toHaveTextContent('{"totalReviews":null,"accuracy":null}');

        await waitFor(() => {
            expect(mockShowToast).toHaveBeenCalledWith(
                'Spaced repetition analytics are temporarily unavailable.',
                'warning'
            );
        });
    });

    it('renders the shared install button on the profile page', () => {
        render(
            <ProfilePageClient
                initialProfileData={null}
                profileWarningCode={null}
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
                        totalReviews: 1,
                        correctReviews: 1,
                        accuracy: 100,
                        avgResponseTimeMs: 1200,
                        recentAttempts: [],
                    },
                }}
            />
        );

        expect(screen.getByTestId('install-button')).toBeInTheDocument();
    });

    it('passes the integrated profile editor section into settings', () => {
        render(
            <ProfilePageClient
                initialProfileData={null}
                profileWarningCode={null}
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
                        totalReviews: 1,
                        correctReviews: 1,
                        accuracy: 100,
                        avgResponseTimeMs: 1200,
                        recentAttempts: [],
                    },
                }}
            />
        );

        expect(mockSettingsPanel).toHaveBeenCalledWith(expect.objectContaining({
            profileEditorSection: expect.objectContaining({
                toggleTestId: 'profile-edit-toggle',
            }),
        }));
    });

    it('does not render the duplicate profile SRS notification card', () => {
        render(
            <ProfilePageClient
                initialProfileData={null}
                profileWarningCode={null}
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
                        totalReviews: 1,
                        correctReviews: 1,
                        accuracy: 100,
                        avgResponseTimeMs: 1200,
                        recentAttempts: [],
                    },
                }}
            />
        );

        expect(screen.queryByTestId('profile-srs-card')).not.toBeInTheDocument();
        expect(mockSrsNotificationCard).not.toHaveBeenCalled();
    });

    it('routes authenticated favorites navigation back through the profile flow', () => {
        render(
            <ProfilePageClient
                initialProfileData={null}
                profileWarningCode={null}
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
                        totalReviews: 1,
                        correctReviews: 1,
                        accuracy: 100,
                        avgResponseTimeMs: 1200,
                        recentAttempts: [],
                    },
                }}
            />
        );

        expect(screen.getAllByRole('link', { name: /View Library/i })[0]).toHaveAttribute('href', '/favorites?from=profile');
    });

    it('keeps the favorites link target stable for guests so proxy can redirect', () => {
        mockUseAuthLogic.mockReturnValue({
            user: null,
            isAuthenticated: false,
            language: 'en',
            t: (key: string) => profileTranslationMap[key] ?? key,
            showAuthModal: false,
            setShowAuthModal: jest.fn(),
            setAuthMode: jest.fn(),
            showResetConfirm: false,
            setShowResetConfirm: jest.fn(),
            handleDataReset: jest.fn(),
            logout: jest.fn(),
            router: {
                push: jest.fn(),
            },
        });
        mockUseAuth.mockReturnValue({
            entitlements: {
                canUseAdvancedAnalytics: false,
            },
            favoriteLimit: 15,
            isAuthenticated: false,
            refreshMemberState: jest.fn(),
            requiresProfileCompletion: false,
        });

        render(
            <ProfilePageClient
                initialProfileData={null}
                profileWarningCode={null}
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
                        totalReviews: 0,
                        correctReviews: 0,
                        accuracy: 0,
                        avgResponseTimeMs: null,
                        recentAttempts: [],
                    },
                }}
            />
        );

        expect(screen.getAllByRole('link', { name: /View Library/i })[0]).toHaveAttribute('href', '/favorites');
    });
});
