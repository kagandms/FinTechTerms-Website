import type { AuthenticatedUser } from '@/lib/auth/user';
import type { MemberEntitlements } from '@/lib/member-entitlements';

export interface AuthSessionState {
    user: AuthenticatedUser | null;
    isAuthenticated: boolean;
    isAdmin: boolean;
    entitlements: MemberEntitlements;
    requiresProfileCompletion: boolean;
    memberStateUnavailable: boolean;
}
