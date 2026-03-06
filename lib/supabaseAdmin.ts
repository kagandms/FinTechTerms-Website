import { createClient as createSupabaseClient, type User } from '@supabase/supabase-js';
import { createTimeoutFetch } from '@/lib/api-response';
import { createClient as createServerClient } from '@/utils/supabase/server';

const createRouteSupabaseClient = (
    apiKey: string,
    bearerToken?: string
) => createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
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
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export const resolveAuthenticatedUser = async (request: Request): Promise<User | null> => {
    const bearerToken = getBearerToken(request);

    if (bearerToken) {
        const tokenSupabase = createRouteSupabaseClient(
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            bearerToken
        );

        const { data, error } = await tokenSupabase.auth.getUser();
        if (!error && data.user) {
            return data.user;
        }
    }

    const cookieSupabase = await createServerClient();
    const { data, error } = await cookieSupabase.auth.getUser();
    if (error || !data.user) {
        return null;
    }

    return data.user;
};
