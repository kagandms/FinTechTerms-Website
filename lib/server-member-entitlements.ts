import 'server-only';

import { createRequestScopedClient, resolveAuthenticatedUser } from '@/lib/supabaseAdmin';
import { logger } from '@/lib/logger';
import { resolveMemberEntitlements, type MemberEntitlements } from '@/lib/member-entitlements';
import { hasPersistedBirthDate } from '@/lib/profile-birth-date';

export interface RequestMemberProfileSnapshot {
    fullName: string | null;
    birthDate: string | null;
}

export interface RequestMemberEntitlementsResult {
    user: Awaited<ReturnType<typeof resolveAuthenticatedUser>>;
    entitlements: MemberEntitlements;
    profile?: RequestMemberProfileSnapshot | null;
    unavailable:
        | {
            status: 503;
            code: 'MEMBER_STATE_UNAVAILABLE';
            message: string;
        }
        | null;
}

export interface RequestAiAccessResult extends RequestMemberEntitlementsResult {
    denial:
        | {
            status: 401 | 403;
            code: 'UNAUTHORIZED' | 'MEMBER_REQUIRED';
            message: string;
        }
        | null;
}

const MEMBER_STATE_UNAVAILABLE = {
    status: 503 as const,
    code: 'MEMBER_STATE_UNAVAILABLE' as const,
    message: 'Member state is temporarily unavailable. Please try again.',
};

const normalizeProfileField = (value: unknown): string | null => {
    if (typeof value !== 'string') {
        return null;
    }

    const normalizedValue = value.trim();
    return normalizedValue || null;
};

export const resolveRequestMemberEntitlements = async (
    request: Request
): Promise<RequestMemberEntitlementsResult> => {
    const user = await resolveAuthenticatedUser(request);

    if (!user) {
        return {
            user: null,
            entitlements: resolveMemberEntitlements({
                isAuthenticated: false,
                requiresProfileCompletion: false,
            }),
            profile: null,
            unavailable: null,
        };
    }

    const supabase = await createRequestScopedClient(request);
    if (!supabase) {
        logger.warn('SERVER_MEMBER_ENTITLEMENTS_CLIENT_UNAVAILABLE', {
            route: 'resolveRequestMemberEntitlements',
            userId: user.id,
        });
        return {
            user,
            entitlements: resolveMemberEntitlements({
                isAuthenticated: true,
                requiresProfileCompletion: true,
            }),
            profile: null,
            unavailable: MEMBER_STATE_UNAVAILABLE,
        };
    }

    const { data, error } = await supabase
        .from('profiles')
        .select('full_name, birth_date')
        .eq('id', user.id)
        .maybeSingle();

    if (error) {
        logger.warn('SERVER_MEMBER_ENTITLEMENTS_PROFILE_CHECK_FAILED', {
            route: 'resolveRequestMemberEntitlements',
            userId: user.id,
            error: error instanceof Error ? error : new Error(String(error)),
        });
        return {
            user,
            entitlements: resolveMemberEntitlements({
                isAuthenticated: true,
                requiresProfileCompletion: true,
            }),
            profile: null,
            unavailable: MEMBER_STATE_UNAVAILABLE,
        };
    }

    const requiresProfileCompletion = !hasPersistedBirthDate(data?.birth_date);
    const profile = {
        fullName: normalizeProfileField(data?.full_name),
        birthDate: normalizeProfileField(data?.birth_date),
    };

    return {
        user,
        entitlements: resolveMemberEntitlements({
            isAuthenticated: true,
            requiresProfileCompletion,
        }),
        profile,
        unavailable: null,
    };
};

export const resolveRequestAiAccess = async (
    request: Request
): Promise<RequestAiAccessResult> => {
    const memberState = await resolveRequestMemberEntitlements(request);

    if (!memberState.user) {
        return {
            ...memberState,
            denial: {
                status: 401,
                code: 'UNAUTHORIZED',
                message: 'Sign in to use AI features.',
            },
        };
    }

    if (!memberState.entitlements.canUseAiFeatures) {
        return {
            ...memberState,
            denial: {
                status: 403,
                code: 'MEMBER_REQUIRED',
                message: 'Complete your member setup to unlock AI features.',
            },
        };
    }

    return {
        ...memberState,
        denial: null,
    };
};
