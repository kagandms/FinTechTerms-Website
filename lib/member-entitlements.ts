export interface MemberEntitlements {
    maxFavorites: number;
    canUseReviewMode: boolean;
    canUseAdvancedAnalytics: boolean;
    canUseMistakeReview: boolean;
    canInstallPwa: boolean;
    requiresProfileCompletion: boolean;
}

export interface ResolveMemberEntitlementsOptions {
    isAuthenticated: boolean;
    requiresProfileCompletion: boolean;
}

export const GUEST_FAVORITE_LIMIT = 15;

const guestEntitlements: MemberEntitlements = {
    maxFavorites: GUEST_FAVORITE_LIMIT,
    canUseReviewMode: false,
    canUseAdvancedAnalytics: false,
    canUseMistakeReview: false,
    canInstallPwa: true,
    requiresProfileCompletion: false,
};

const incompleteMemberEntitlements: MemberEntitlements = {
    maxFavorites: GUEST_FAVORITE_LIMIT,
    canUseReviewMode: false,
    canUseAdvancedAnalytics: false,
    canUseMistakeReview: false,
    canInstallPwa: true,
    requiresProfileCompletion: true,
};

const fullMemberEntitlements: MemberEntitlements = {
    maxFavorites: Number.POSITIVE_INFINITY,
    canUseReviewMode: true,
    canUseAdvancedAnalytics: true,
    canUseMistakeReview: true,
    canInstallPwa: true,
    requiresProfileCompletion: false,
};

export const resolveMemberEntitlements = ({
    isAuthenticated,
    requiresProfileCompletion,
}: ResolveMemberEntitlementsOptions): MemberEntitlements => {
    if (!isAuthenticated) {
        return guestEntitlements;
    }

    if (requiresProfileCompletion) {
        return incompleteMemberEntitlements;
    }

    return fullMemberEntitlements;
};
