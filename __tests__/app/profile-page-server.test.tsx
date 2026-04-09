import React from 'react';
import { render } from '@testing-library/react';

const mockCreateOptionalClient = jest.fn();
const mockSafeGetSupabaseUser = jest.fn();
const mockGetLearningStats = jest.fn();
const profilePageClientSpy = jest.fn();

jest.mock('@/utils/supabase/server', () => ({
    createOptionalClient: () => mockCreateOptionalClient(),
}));

jest.mock('@/lib/auth/session', () => ({
    safeGetSupabaseUser: (...args: unknown[]) => mockSafeGetSupabaseUser(...args),
}));

jest.mock('@/app/actions/getLearningStats', () => ({
    getLearningStats: () => mockGetLearningStats(),
}));

jest.mock('@/app/profile/ProfilePageClient', () => ({
    __esModule: true,
    default: (props: unknown) => {
        profilePageClientSpy(props);
        return <div data-testid="profile-page-client" />;
    },
}));

describe('profile page server loader', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockGetLearningStats.mockResolvedValue({
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
        });
    });

    it('does not treat auth metadata birth dates as persisted profile completion data', async () => {
        const maybeSingle = jest.fn().mockResolvedValue({
            data: {
                full_name: null,
                birth_date: null,
            },
            error: null,
        });
        const select = jest.fn(() => ({
            eq: jest.fn(() => ({
                maybeSingle,
            })),
        }));
        const from = jest.fn(() => ({ select }));

        mockCreateOptionalClient.mockResolvedValue({ from });
        mockSafeGetSupabaseUser.mockResolvedValue({
            user: {
                id: 'user-1',
                email: 'alex@example.com',
                user_metadata: {
                    name: 'Alex Stone',
                    birth_date: '2000-01-01',
                },
            },
        });

        const ProfilePage = (await import('@/app/(app)/profile/page')).default;
        const view = await ProfilePage();
        render(view);

        expect(profilePageClientSpy).toHaveBeenCalledWith(expect.objectContaining({
            initialProfileData: expect.objectContaining({
                name: 'Alex',
                surname: 'Stone',
                birthDate: '',
            }),
            profileWarningCode: 'PROFILE_DATA_PARTIAL',
        }));
    });
});
