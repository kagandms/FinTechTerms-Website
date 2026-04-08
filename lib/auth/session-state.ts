import 'server-only';

import { isAdminUserId } from '@/lib/admin-access';
import { mapSupabaseUser } from '@/lib/auth/user';
import { resolveMemberEntitlements } from '@/lib/member-entitlements';
import { resolveRequestMemberEntitlements } from '@/lib/server-member-entitlements';
import { type AuthSessionState } from '@/lib/auth/session-state.types';

export const buildGuestAuthSessionState = (): AuthSessionState => ({
    user: null,
    isAuthenticated: false,
    isAdmin: false,
    entitlements: resolveMemberEntitlements({
        isAuthenticated: false,
        requiresProfileCompletion: false,
    }),
    requiresProfileCompletion: false,
    memberStateUnavailable: false,
});

export const buildAuthSessionState = async (request: Request): Promise<AuthSessionState> => {
    const memberState = await resolveRequestMemberEntitlements(request);
    const user = memberState.user;

    if (!user) {
        return buildGuestAuthSessionState();
    }

    return {
        user: mapSupabaseUser(user),
        isAuthenticated: true,
        isAdmin: isAdminUserId(user.id),
        entitlements: memberState.entitlements,
        requiresProfileCompletion: memberState.entitlements.requiresProfileCompletion,
        memberStateUnavailable: memberState.unavailable !== null,
    };
};
