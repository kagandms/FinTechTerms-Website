import { buildAuthSessionState, buildGuestAuthSessionState } from '@/lib/auth/session-state';

const mockResolveRequestMemberEntitlements = jest.fn();
const mockIsAdminUserId = jest.fn();

jest.mock('@/lib/server-member-entitlements', () => ({
    resolveRequestMemberEntitlements: (request: Request) => mockResolveRequestMemberEntitlements(request),
}));

jest.mock('@/lib/admin-access', () => ({
    isAdminUserId: (userId: string) => mockIsAdminUserId(userId),
}));

describe('auth session state', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockIsAdminUserId.mockReturnValue(false);
    });

    it('returns a guest session state when no authenticated user exists', () => {
        expect(buildGuestAuthSessionState()).toEqual({
            user: null,
            isAuthenticated: false,
            isAdmin: false,
            entitlements: {
                maxFavorites: 15,
                canUseReviewMode: false,
                canUseAiFeatures: false,
                canUseAdvancedAnalytics: false,
                canUseMistakeReview: false,
                canInstallPwa: true,
                requiresProfileCompletion: false,
            },
            requiresProfileCompletion: false,
            memberStateUnavailable: false,
        });
    });

    it('uses the persisted profile full_name as the canonical auth session display name', async () => {
        mockResolveRequestMemberEntitlements.mockResolvedValue({
            user: {
                id: 'user-1',
                email: 'alex@example.com',
                created_at: '2026-04-05T12:00:00.000Z',
                user_metadata: {
                    full_name: 'Old Metadata Name',
                },
                app_metadata: {
                    provider: 'email',
                    providers: ['email'],
                },
            },
            entitlements: {
                maxFavorites: Number.POSITIVE_INFINITY,
                canUseReviewMode: true,
                canUseAiFeatures: true,
                canUseAdvancedAnalytics: true,
                canUseMistakeReview: true,
                canInstallPwa: true,
                requiresProfileCompletion: false,
            },
            unavailable: null,
            profile: {
                fullName: 'Alex Stone',
                birthDate: '2000-01-01',
            },
        });

        const sessionState = await buildAuthSessionState({
            headers: {
                get: () => null,
            },
        } as unknown as Request);

        expect(sessionState.user).toEqual({
            id: 'user-1',
            email: 'alex@example.com',
            name: 'Alex Stone',
            createdAt: '2026-04-05T12:00:00.000Z',
            primaryProvider: 'email',
            providers: ['email'],
        });
        expect(sessionState.isAuthenticated).toBe(true);
        expect(sessionState.requiresProfileCompletion).toBe(false);
        expect(sessionState.memberStateUnavailable).toBe(false);
    });
});
