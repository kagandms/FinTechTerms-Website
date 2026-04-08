import { createServerClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { createTimeoutFetch, errorResponse } from '@/lib/api-response';
import { getPublicEnv, hasConfiguredPublicSupabaseEnv } from '@/lib/env';
import { getSupabaseServerCookieOptions } from '@/lib/supabase-cookie-options';

const AUTH_ROUTE_HEADERS = {
    'Cache-Control': 'no-store',
};

export const AUTH_ROUTE_UNAVAILABLE_CODE = 'AUTH_UNAVAILABLE';
export const AUTH_ROUTE_UNAVAILABLE_MESSAGE = 'Authentication is temporarily unavailable.';

interface PendingCookie {
    name: string;
    value: string;
    options?: Parameters<NextResponse['cookies']['set']>[2];
}

export interface AuthRouteClientContext {
    supabase: SupabaseClient;
    applyCookies: <T extends NextResponse>(response: T) => T;
}

export const createAuthRouteClient = async (): Promise<AuthRouteClientContext | null> => {
    const cookieStore = await cookies();
    const publicEnv = getPublicEnv();

    if (!hasConfiguredPublicSupabaseEnv(publicEnv)) {
        return null;
    }

    const pendingCookies: PendingCookie[] = [];
    const timeoutFetch = createTimeoutFetch();
    const supabase = createServerClient(
        publicEnv.supabaseUrl!,
        publicEnv.supabaseAnonKey!,
        {
            cookieOptions: getSupabaseServerCookieOptions(),
            cookies: {
                getAll() {
                    return cookieStore.getAll();
                },
                setAll(cookiesToSet) {
                    cookiesToSet.forEach(({ name, value, options }) => {
                        pendingCookies.push({ name, value, options });

                        try {
                            cookieStore.set(name, value, options);
                        } catch {
                            // Route handlers can still finalize cookies on the explicit response below.
                        }
                    });
                },
            },
            global: {
                fetch: timeoutFetch,
            },
        }
    );

    return {
        supabase,
        applyCookies: <T extends NextResponse>(response: T): T => {
            pendingCookies.forEach(({ name, value, options }) => {
                response.cookies.set(name, value, options);
            });

            return response;
        },
    };
};

export const createAuthUnavailableResponse = (requestId: string) => errorResponse({
    status: 503,
    code: AUTH_ROUTE_UNAVAILABLE_CODE,
    message: AUTH_ROUTE_UNAVAILABLE_MESSAGE,
    requestId,
    retryable: true,
    headers: AUTH_ROUTE_HEADERS,
});

export const getAuthRouteHeaders = (): HeadersInit => AUTH_ROUTE_HEADERS;
