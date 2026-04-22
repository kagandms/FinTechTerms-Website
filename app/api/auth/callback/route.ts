import { NextResponse } from 'next/server';
import { createAuthRouteClient } from '@/lib/auth/route-handler';
import { getPublicEnv } from '@/lib/env';

export async function GET(request: Request) {
    const requestUrl = new URL(request.url);
    const code = requestUrl.searchParams.get('code');
    const next = requestUrl.searchParams.get('next') || '/profile?complete=1';
    const siteUrl = getPublicEnv().siteUrl;

    if (code) {
        const authContext = await createAuthRouteClient();
        if (authContext) {
            const { supabase, applyCookies } = authContext;
            const { error } = await supabase.auth.exchangeCodeForSession(code);
            if (!error) {
                // Successfully exchanged the code. Redirect to the target URL.
                // Make sure to apply the cookies that were set during exchange.
                return applyCookies(NextResponse.redirect(new URL(next, siteUrl)));
            }
        }
    }

    // Return the user to an error page with instructions
    return NextResponse.redirect(new URL('/profile?authError=OAuthCallbackError', siteUrl));
}
