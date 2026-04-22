import { NextResponse } from 'next/server';
import { createAuthRouteClient } from '@/lib/auth/route-handler';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    const requestUrl = new URL(request.url);
    const code = requestUrl.searchParams.get('code');
    const next = requestUrl.searchParams.get('next') || '/profile?complete=1';
    
    const forwardedHost = request.headers.get('x-forwarded-host');
    const origin = forwardedHost ? `https://${forwardedHost}` : requestUrl.origin;

    if (code) {
        const authContext = await createAuthRouteClient();
        if (authContext) {
            const { supabase, applyCookies } = authContext;
            const { error } = await supabase.auth.exchangeCodeForSession(code);
            if (!error) {
                return applyCookies(NextResponse.redirect(new URL(next, origin)));
            }

            logger.warn('AUTH_CALLBACK_EXCHANGE_FAILED', {
                route: '/api/auth/callback',
                error: error instanceof Error ? error : undefined,
            });
            return NextResponse.redirect(new URL(`/profile?authError=${encodeURIComponent(error.message)}`, origin));
        }
    }

    return NextResponse.redirect(new URL('/profile?authError=OAuthCallbackError', origin));
}
