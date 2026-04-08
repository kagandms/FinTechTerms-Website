import { NextResponse } from 'next/server';
import {
    createRequestId,
    handleRouteError,
} from '@/lib/api-response';
import {
    createAuthRouteClient,
    createAuthUnavailableResponse,
} from '@/lib/auth/route-handler';
import { logger } from '@/lib/logger';

const resolveRedirectTarget = (request: Request, redirectTo: FormDataEntryValue | null): URL => {
    const requestUrl = new URL(request.url);
    const fallbackUrl = new URL('/profile', request.url);

    if (typeof redirectTo !== 'string') {
        return fallbackUrl;
    }

    const trimmedRedirect = redirectTo.trim();
    if (!trimmedRedirect.startsWith('/') || trimmedRedirect.startsWith('//')) {
        return fallbackUrl;
    }

    return new URL(trimmedRedirect, request.url);
};

const buildLoginErrorRedirect = (
    request: Request,
    errorCode: string,
    redirectTo: FormDataEntryValue | null
): NextResponse => {
    const redirectUrl = new URL('/profile', request.url);
    redirectUrl.searchParams.set('auth', 'login');
    redirectUrl.searchParams.set('authError', errorCode);

    if (typeof redirectTo === 'string' && redirectTo.trim().startsWith('/')) {
        redirectUrl.searchParams.set('next', redirectTo.trim());
    }

    return NextResponse.redirect(redirectUrl, 303);
};

export async function POST(request: Request) {
    const requestId = createRequestId(request);

    try {
        const formData = await request.formData();
        const email = formData.get('email');
        const password = formData.get('password');
        const redirectTo = formData.get('redirectTo');

        if (typeof email !== 'string' || typeof password !== 'string' || !email || !password) {
            logger.warn('AUTH_BROWSER_LOGIN_INVALID_PAYLOAD', {
                requestId,
                route: '/api/auth/login/browser',
            });
            return buildLoginErrorRedirect(request, 'INVALID_CREDENTIALS', redirectTo);
        }

        const authContext = await createAuthRouteClient();
        if (!authContext) {
            return createAuthUnavailableResponse(requestId);
        }
        const { supabase, applyCookies } = authContext;

        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password,
        });

        if (error || !data.user) {
            logger.warn('AUTH_BROWSER_LOGIN_FAILED', {
                requestId,
                route: '/api/auth/login/browser',
                error: error instanceof Error ? error : undefined,
            });
            return buildLoginErrorRedirect(request, 'INVALID_CREDENTIALS', redirectTo);
        }

        logger.info('AUTH_BROWSER_LOGIN_SUCCEEDED', {
            requestId,
            route: '/api/auth/login/browser',
            userId: data.user.id,
        });
        return applyCookies(NextResponse.redirect(resolveRedirectTarget(request, redirectTo), 303));
    } catch (error) {
        return handleRouteError(error, {
            requestId,
            code: 'AUTH_LOGIN_FAILED',
            message: 'Unable to sign in.',
            retryable: true,
            status: 503,
            logLabel: 'AUTH_BROWSER_LOGIN_ROUTE_FAILED',
        });
    }
}
