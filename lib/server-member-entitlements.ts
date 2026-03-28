import 'server-only';

import { createRequestScopedClient, resolveAuthenticatedUser } from '@/lib/supabaseAdmin';
import { getSupabaseUserMetadataBirthDate, getSupabaseUserProviders } from '@/lib/auth/user';
import { resolveMemberEntitlements, type MemberEntitlements } from '@/lib/member-entitlements';

interface RequestMemberEntitlementsResult {
    user: Awaited<ReturnType<typeof resolveAuthenticatedUser>>;
    entitlements: MemberEntitlements;
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

    if (providers.includes('google') && !getSupabaseUserMetadataBirthDate(user)) {
        const supabase = await createRequestScopedClient(request);
        const { data } = supabase
            ? await supabase
                .from('profiles')
                .select('birth_date')
                .eq('id', user.id)
                .maybeSingle()
            : { data: null };

        requiresProfileCompletion = !(typeof data?.birth_date === 'string' && data.birth_date.trim().length > 0);
    }

    return {
        user,
        entitlements: resolveMemberEntitlements({
            isAuthenticated: true,
            requiresProfileCompletion,
        }),
    };
};
