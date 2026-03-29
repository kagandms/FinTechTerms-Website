import 'server-only';

import { createRequestScopedClient, resolveAuthenticatedUser } from '@/lib/supabaseAdmin';
import { getSupabaseUserProviders } from '@/lib/auth/user';
import { logger } from '@/lib/logger';
import { resolveMemberEntitlements, type MemberEntitlements } from '@/lib/member-entitlements';
import { hasPersistedBirthDate } from '@/lib/profile-birth-date';

export interface RequestMemberEntitlementsResult {
    user: Awaited<ReturnType<typeof resolveAuthenticatedUser>>;
    entitlements: MemberEntitlements;
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
        };
    }

    const providers = getSupabaseUserProviders(user);
    let requiresProfileCompletion = false;

    if (providers.includes('google')) {
        const supabase = await createRequestScopedClient(request);
        const { data, error } = supabase
            ? await supabase
                .from('profiles')
                .select('birth_date')
                .eq('id', user.id)
                .maybeSingle()
            : { data: null, error: new Error('Supabase request client unavailable.') };

        if (error) {
            logger.warn('SERVER_MEMBER_ENTITLEMENTS_PROFILE_CHECK_FAILED', {
                route: 'resolveRequestMemberEntitlements',
                userId: user.id,
                error: error instanceof Error ? error : new Error(String(error)),
            });
        }

        requiresProfileCompletion = !hasPersistedBirthDate(data?.birth_date);
    }

    return {
        user,
        entitlements: resolveMemberEntitlements({
            isAuthenticated: true,
            requiresProfileCompletion,
        }),
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

    if (!memberState.entitlements.canUseAdvancedAnalytics) {
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
