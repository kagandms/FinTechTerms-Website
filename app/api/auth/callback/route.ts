import { NextResponse } from 'next/server';
import { createAuthRouteClient } from '@/lib/auth/route-handler';
import { logger } from '@/lib/logger';
import {
    resolveAuthRequestOrigin,
    resolveSafeAuthNextPath,
} from '@/lib/auth/redirect-target';
import { getSafeAuthErrorCode } from '@/lib/auth/error-messages';

export const dynamic = 'force-dynamic';

const buildAuthErrorRedirect = (origin: string, errorCode: string): NextResponse => (
    NextResponse.redirect(new URL(`/profile?authError=${encodeURIComponent(errorCode)}`, origin))
);

const resolveProviderAuthErrorCode = (requestUrl: URL): string => {
    const providerErrorDescription = requestUrl.searchParams.get('error_description');
    const providerError = requestUrl.searchParams.get('error');

    return getSafeAuthErrorCode(providerErrorDescription ?? providerError);
};

export async function GET(request: Request) {
    const requestUrl = new URL(request.url);
    const code = requestUrl.searchParams.get('code');
    const next = requestUrl.searchParams.get('next');
    const providerError = requestUrl.searchParams.get('error');
    const origin = resolveAuthRequestOrigin(request);

    if (providerError) {
        const errorCode = resolveProviderAuthErrorCode(requestUrl);
        logger.warn('AUTH_CALLBACK_PROVIDER_FAILED', {
            route: '/api/auth/callback',
            providerError,
            errorCode,
        });
        return buildAuthErrorRedirect(origin, errorCode);
    }

    if (code) {
        const authContext = await createAuthRouteClient();
        if (authContext) {
            const { supabase, applyCookies } = authContext;
            const { error } = await supabase.auth.exchangeCodeForSession(code);
            if (!error) {
                return applyCookies(NextResponse.redirect(new URL(resolveSafeAuthNextPath(next, origin), origin)));
            }

            logger.warn('AUTH_CALLBACK_EXCHANGE_FAILED', {
                route: '/api/auth/callback',
                error: error instanceof Error ? error : undefined,
            });
            return buildAuthErrorRedirect(origin, getSafeAuthErrorCode(error));
        }
    }

    return buildAuthErrorRedirect(origin, 'GENERIC');
}
