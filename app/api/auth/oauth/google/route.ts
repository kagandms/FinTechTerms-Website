import { NextResponse } from 'next/server';
import {
    createRequestId,
    handleRouteError,
} from '@/lib/api-response';
import {
    createAuthRouteClient,
    createAuthUnavailableResponse,
} from '@/lib/auth/route-handler';
import { getPublicEnv } from '@/lib/env';

const resolveGoogleRedirect = (request: Request): string => {
    const requestUrl = new URL(request.url);
    const requestedRedirect = requestUrl.searchParams.get('redirectTo');
    const forwardedHost = request.headers.get('x-forwarded-host');
    const origin = forwardedHost ? `https://${forwardedHost}` : requestUrl.origin;

    let nextPath = '/profile?complete=1';

    if (requestedRedirect) {
        if (requestedRedirect.startsWith('/')) {
            nextPath = requestedRedirect;
        } else {
            try {
                const parsedUrl = new URL(requestedRedirect);
                // We check if it matches the dynamic origin
                if (parsedUrl.origin === origin || parsedUrl.origin === getPublicEnv().siteUrl) {
                    nextPath = parsedUrl.pathname + parsedUrl.search;
                }
            } catch {
                // Fall through to the default safe redirect target.
            }
        }
    }

    return `${origin}/api/auth/callback?next=${encodeURIComponent(nextPath)}`;
};

export async function GET(request: Request) {
    const requestId = createRequestId(request);

    try {
        const authContext = await createAuthRouteClient();
        if (!authContext) {
            return createAuthUnavailableResponse(requestId);
        }
        const { supabase, applyCookies } = authContext;

        const { data, error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: resolveGoogleRedirect(request),
            },
        });

        if (error || !data.url) {
            return applyCookies(NextResponse.redirect(new URL('/profile?auth=login&oauth=failed', request.url)));
        }

        return applyCookies(NextResponse.redirect(data.url));
    } catch (error) {
        return handleRouteError(error, {
            requestId,
            code: 'AUTH_GOOGLE_FAILED',
            message: 'Unable to start Google sign-in.',
            retryable: true,
            status: 503,
            logLabel: 'AUTH_GOOGLE_ROUTE_FAILED',
        });
    }
}
