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
    SettingsPanel: () => <div data-testid="settings-panel" />,
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
    default: () => null,
}));
jest.mock('@/components/profile/Heatmap', () => ({
    __esModule: true,
    default: () => null,
}));
jest.mock('@/components/profile/ProfileErrorBoundary', () => ({
    __esModule: true,
    default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
jest.mock('@/components/profile/SRSNotificationCard', () => ({
    __esModule: true,
    default: () => null,
}));

describe('ProfilePageClient', () => {
    beforeEach(() => {
        jest.clearAllMocks();

        mockUseAuthLogic.mockReturnValue({
            user: { id: 'user-1', name: 'Alex Stone' },
            isAuthenticated: true,
            language: 'en',
            t: (key: string) => key,
            showAuthModal: false,
            setShowAuthModal: jest.fn(),
            setAuthMode: jest.fn(),
            showResetConfirm: false,
            setShowResetConfirm: jest.fn(),
            handleDataReset: jest.fn(),
            logout: jest.fn(),
        });
        mockUseTheme.mockReturnValue({
            theme: 'light',
            setTheme: jest.fn(),
        });
        mockUseLanguage.mockReturnValue({
            language: 'en',
            setLanguage: jest.fn(),
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
            isAuthenticated: true,
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
});
