import { createClient as createSupabaseClient, type User } from '@supabase/supabase-js';
import { createTimeoutFetch } from '@/lib/api-response';
import { createClient as createServerClient } from '@/utils/supabase/server';
import { getPublicEnv, getServerEnv, hasConfiguredPublicSupabaseEnv } from '@/lib/env';
import {
    hasRequestAuthCookies,
    hasRequestAuthCredentials,
    safeGetSupabaseUser,
} from '@/lib/auth/session';

const createRouteSupabaseClient = (
    projectUrl: string,
    apiKey: string,
    bearerToken?: string
) => createSupabaseClient(
    projectUrl,
    apiKey,
    {
        global: {
            fetch: createTimeoutFetch(),
            headers: bearerToken ? { Authorization: `Bearer ${bearerToken}` } : undefined,
        },
    }
);

const getBearerToken = (request: Request): string | null => {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
        return null;
    }

    const token = authHeader.replace('Bearer ', '').trim();
    return token || null;
};

export const createServiceRoleClient = () => createRouteSupabaseClient(
    (() => {
        const env = getServerEnv();

        if (!env.supabaseUrl || !env.serviceRoleKey) {
            throw new Error(
                'Service role client requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.'
            );
        }

        return env.supabaseUrl;
    })(),
    (() => {
        const env = getServerEnv();

        if (!env.serviceRoleKey) {
            throw new Error(
                'Service role client requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.'
            );
        }

        return env.serviceRoleKey;
    })()
);

export interface RequestAuthState {
    user: User | null;
    hadCredentials: boolean;
    ghostSession: boolean;
}

export const resolveRequestAuthState = async (request: Request): Promise<RequestAuthState> => {
    const publicEnv = getPublicEnv();
    const bearerToken = getBearerToken(request);
    const hadCredentials = hasRequestAuthCredentials(request);
    let ghostSession = false;

    if (!hasConfiguredPublicSupabaseEnv(publicEnv)) {
        return {
            user: null,
            hadCredentials,
            ghostSession,
        };
    }

    if (bearerToken) {
        const tokenSupabase = createRouteSupabaseClient(
            publicEnv.supabaseUrl!,
            publicEnv.supabaseAnonKey!,
            bearerToken
        );

        const tokenUserState = await safeGetSupabaseUser(tokenSupabase);
        if (tokenUserState.user) {
            return {
                user: tokenUserState.user,
                hadCredentials: true,
                ghostSession: false,
            };
        }

        ghostSession = ghostSession || tokenUserState.ghostSession;
    }

    if (hasRequestAuthCookies(request)) {
        const cookieSupabase = await createServerClient();
        const cookieUserState = await safeGetSupabaseUser(cookieSupabase);

        if (cookieUserState.user) {
            return {
                user: cookieUserState.user,
                hadCredentials: true,
                ghostSession: false,
            };
        }

        ghostSession = ghostSession || cookieUserState.ghostSession;
    }

    return {
        user: null,
        hadCredentials,
        ghostSession,
    };
};

export const resolveAuthenticatedUser = async (request: Request): Promise<User | null> => {
    const authState = await resolveRequestAuthState(request);
    return authState.user;
};
