import { createServerClient } from '@supabase/ssr';
import { type NextRequest, NextResponse } from 'next/server';
import { hasRequestAuthCookies, isAuthSessionError } from '@/lib/auth/session';
import { buildContentSecurityPolicy, CSP_NONCE_HEADER } from '@/lib/csp';
import { getPublicEnv } from '@/lib/env';
import { buildLegacyStaticRedirectPath, buildLegacyTermRedirectPath } from '@/lib/legacy-public-routes';
import { LANGUAGE_COOKIE_NAME, normalizeLanguage, resolvePreferredLanguage } from '@/lib/language';

// Intentionally empty: authenticated surfaces enforce access per page/API boundary, not here.
const PROTECTED_PATHS: string[] = [];

const isProtectedPath = (pathname: string): boolean => (
    PROTECTED_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`))
);

const appendVaryHeader = (response: NextResponse, value: string) => {
    const currentValues = (response.headers.get('Vary') ?? '')
        .split(',')
        .map(entry => entry.trim())
        .filter(Boolean);

    if (!currentValues.includes(value)) {
        currentValues.push(value);
    }

    if (currentValues.length > 0) {
        response.headers.set('Vary', currentValues.join(', '));
    }
};

const applySecurityHeaders = (
    response: NextResponse,
    nonce: string
): NextResponse => {
    response.headers.set(CSP_NONCE_HEADER, nonce);
    response.headers.set('Content-Security-Policy', buildContentSecurityPolicy(nonce));
    return response;
};

const resolveRequestLocale = (request: NextRequest) => {
    const queryLocale = normalizeLanguage(request.nextUrl.searchParams.get('lang'));

    if (queryLocale) {
        return queryLocale;
    }

    const pathLocale = normalizeLanguage(request.nextUrl.pathname.split('/')[1]);

    if (pathLocale) {
        return pathLocale;
    }

    return resolvePreferredLanguage({
        cookieValue: request.cookies.get(LANGUAGE_COOKIE_NAME)?.value ?? null,
        acceptLanguage: request.headers.get('accept-language'),
    });
};

const applyLocalizedHeaders = (request: NextRequest, response: NextResponse): NextResponse => {
    const language = resolveRequestLocale(request);

    response.headers.set('Content-Language', language);
    appendVaryHeader(response, 'Accept-Language');
    appendVaryHeader(response, 'Cookie');
    return response;
};

const createPassThroughResponse = (
    request: NextRequest,
    nonce: string
): NextResponse => {
    request.cookies.set(LANGUAGE_COOKIE_NAME, resolveRequestLocale(request));

    const requestHeaders = new Headers(request.headers);
    requestHeaders.set('x-ftt-locale', resolveRequestLocale(request));
    requestHeaders.set(CSP_NONCE_HEADER, nonce);

    return applySecurityHeaders(applyLocalizedHeaders(
        request,
        NextResponse.next({
            request: {
                headers: requestHeaders,
            },
        })
    ), nonce);
};

const buildPermanentRedirectResponse = (
    request: NextRequest,
    redirectPath: string,
    nonce: string
): NextResponse => applySecurityHeaders(applyLocalizedHeaders(
    request,
    NextResponse.redirect(new URL(redirectPath, request.url), 308)
), nonce);

const buildRedirectResponse = (
    request: NextRequest,
    supabaseResponse: NextResponse,
    clearAuthCookies: boolean,
    nonce: string
): NextResponse => {
    const redirectUrl = new URL('/profile', request.url);
    redirectUrl.searchParams.set('auth', 'login');
    redirectUrl.searchParams.set(
        'next',
        `${request.nextUrl.pathname}${request.nextUrl.search}`
    );
    const redirectResponse = NextResponse.redirect(redirectUrl);

    for (const cookie of supabaseResponse.cookies.getAll()) {
        redirectResponse.cookies.set(cookie.name, cookie.value, cookie);
    }

    if (clearAuthCookies) {
        for (const cookie of request.cookies.getAll()) {
            if (!cookie.name.startsWith('sb-')) {
                continue;
            }

            redirectResponse.cookies.set(cookie.name, '', {
                ...cookie,
                maxAge: 0,
                expires: new Date(0),
                path: '/',
            });
        }
    }

    return applySecurityHeaders(applyLocalizedHeaders(request, redirectResponse), nonce);
};

const buildLegacyLocaleRedirect = (
    request: NextRequest,
    nonce: string
): NextResponse | null => {
    const { pathname, searchParams } = request.nextUrl;
    const localeInput = {
        queryLanguage: searchParams.get('lang'),
        cookieLanguage: request.cookies.get(LANGUAGE_COOKIE_NAME)?.value ?? null,
        acceptLanguage: request.headers.get('accept-language'),
    };

    if (pathname === '/about') {
        return buildPermanentRedirectResponse(
            request,
            buildLegacyStaticRedirectPath('/about', localeInput),
            nonce
        );
    }

    if (pathname === '/methodology') {
        return buildPermanentRedirectResponse(
            request,
            buildLegacyStaticRedirectPath('/methodology', localeInput),
            nonce
        );
    }

    const legacyTermMatch = pathname.match(/^\/term\/([^/]+)$/);
    if (!legacyTermMatch) {
        return null;
    }

    const termId = legacyTermMatch[1];

    if (!termId) {
        return null;
    }

    const redirectPath = buildLegacyTermRedirectPath({
        termId,
        ...localeInput,
    });

    if (!redirectPath) {
        return null;
    }

    return buildPermanentRedirectResponse(request, redirectPath, nonce);
};

export async function proxy(request: NextRequest) {
    const nonce = crypto.randomUUID();
    const legacyRedirect = buildLegacyLocaleRedirect(request, nonce);

    if (legacyRedirect) {
        return applySecurityHeaders(legacyRedirect, nonce);
    }

    const requiresAuth = isProtectedPath(request.nextUrl.pathname);
    const env = getPublicEnv();
    const supabaseUrl = env.supabaseUrl;
    const supabaseAnonKey = env.supabaseAnonKey;

    if (!supabaseUrl || !supabaseAnonKey) {
        return requiresAuth
            ? buildRedirectResponse(request, applySecurityHeaders(NextResponse.next(), nonce), false, nonce)
            : applySecurityHeaders(applyLocalizedHeaders(request, NextResponse.next()), nonce);
    }

    let supabaseResponse = createPassThroughResponse(request, nonce);

    const supabase = createServerClient(
        supabaseUrl,
        supabaseAnonKey,
        {
            cookies: {
                getAll() {
                    return request.cookies.getAll();
                },
                setAll(cookiesToSet) {
                    cookiesToSet.forEach(({ name, value }) => {
                        request.cookies.set(name, value);
                    });

                    supabaseResponse = createPassThroughResponse(request, nonce);

                    cookiesToSet.forEach(({ name, value, options }) => {
                        supabaseResponse.cookies.set(name, value, options);
                    });
                },
            },
        }
    );

    const {
        data: { user },
        error,
    } = await supabase.auth.getUser();

    if (!requiresAuth) {
        return supabaseResponse;
    }

    if (error || !user) {
        const shouldClearAuthCookies = (
            (error ? isAuthSessionError(error) : false)
            || (!user && hasRequestAuthCookies(request))
        );

        return buildRedirectResponse(
            request,
            supabaseResponse,
            shouldClearAuthCookies,
            nonce
        );
    }

    return supabaseResponse;
}

export const config = {
    matcher: [
        '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
    ],
};
