import {
    GUEST_FAVORITE_LIMIT,
    resolveMemberEntitlements,
} from '@/lib/member-entitlements';

describe('resolveMemberEntitlements', () => {
    it('returns the guest policy for anonymous visitors', () => {
        expect(resolveMemberEntitlements({
            isAuthenticated: false,
            requiresProfileCompletion: false,
        })).toEqual({
            maxFavorites: GUEST_FAVORITE_LIMIT,
            canUseReviewMode: false,
            canUseAdvancedAnalytics: false,
            canUseMistakeReview: false,
            canInstallPwa: true,
            requiresProfileCompletion: false,
        });
    });

    it('returns the incomplete-member policy for gated Google users', () => {
        expect(resolveMemberEntitlements({
            isAuthenticated: true,
            requiresProfileCompletion: true,
        })).toEqual({
            maxFavorites: GUEST_FAVORITE_LIMIT,
            canUseReviewMode: false,
            canUseAdvancedAnalytics: false,
            canUseMistakeReview: false,
            canInstallPwa: true,
            requiresProfileCompletion: true,
        });
    });

    it('returns the full member policy for completed accounts', () => {
        expect(resolveMemberEntitlements({
            isAuthenticated: true,
            requiresProfileCompletion: false,
        })).toEqual({
            maxFavorites: Number.POSITIVE_INFINITY,
            canUseReviewMode: true,
            canUseAdvancedAnalytics: true,
            canUseMistakeReview: true,
            canInstallPwa: true,
            requiresProfileCompletion: false,
        });
    });
});
