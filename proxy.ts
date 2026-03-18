import { createServerClient } from '@supabase/ssr';
import { type NextRequest, NextResponse } from 'next/server';
import { hasRequestAuthCookies, isAuthSessionError } from '@/lib/auth/session';
import { getPublicEnv } from '@/lib/env';
import { buildLegacyStaticRedirectPath, buildLegacyTermRedirectPath } from '@/lib/legacy-public-routes';
import { LANGUAGE_COOKIE_NAME, normalizeLanguage, resolvePreferredLanguage } from '@/lib/language';

const PROTECTED_PATHS = ['/favorites'];

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

const createPassThroughResponse = (request: NextRequest): NextResponse => {
    request.cookies.set(LANGUAGE_COOKIE_NAME, resolveRequestLocale(request));

    const requestHeaders = new Headers(request.headers);
    requestHeaders.set('x-ftt-locale', resolveRequestLocale(request));

    return applyLocalizedHeaders(
        request,
        NextResponse.next({
            request: {
                headers: requestHeaders,
            },
        })
    );
};

const buildPermanentRedirectResponse = (
    request: NextRequest,
    redirectPath: string
): NextResponse => applyLocalizedHeaders(
    request,
    NextResponse.redirect(new URL(redirectPath, request.url), 308)
);

const buildRedirectResponse = (
    request: NextRequest,
    supabaseResponse: NextResponse,
    clearAuthCookies: boolean
): NextResponse => {
    const redirectResponse = NextResponse.redirect(new URL('/', request.url));

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

    return applyLocalizedHeaders(request, redirectResponse);
};

const buildLegacyLocaleRedirect = (request: NextRequest): NextResponse | null => {
    const { pathname, searchParams } = request.nextUrl;
    const localeInput = {
        queryLanguage: searchParams.get('lang'),
        cookieLanguage: request.cookies.get(LANGUAGE_COOKIE_NAME)?.value ?? null,
        acceptLanguage: request.headers.get('accept-language'),
    };

    if (pathname === '/about') {
        return buildPermanentRedirectResponse(
            request,
            buildLegacyStaticRedirectPath('/about', localeInput)
        );
    }

    if (pathname === '/methodology') {
        return buildPermanentRedirectResponse(
            request,
            buildLegacyStaticRedirectPath('/methodology', localeInput)
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

    return buildPermanentRedirectResponse(request, redirectPath);
};

export async function proxy(request: NextRequest) {
    const legacyRedirect = buildLegacyLocaleRedirect(request);

    if (legacyRedirect) {
        return legacyRedirect;
    }

    const requiresAuth = isProtectedPath(request.nextUrl.pathname);
    const env = getPublicEnv();
    const supabaseUrl = env.supabaseUrl;
    const supabaseAnonKey = env.supabaseAnonKey;

    if (!supabaseUrl || !supabaseAnonKey) {
        return requiresAuth
            ? applyLocalizedHeaders(request, NextResponse.redirect(new URL('/', request.url)))
            : applyLocalizedHeaders(request, NextResponse.next());
    }

    let supabaseResponse = createPassThroughResponse(request);

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

                    supabaseResponse = createPassThroughResponse(request);

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
            shouldClearAuthCookies
        );
    }

    return supabaseResponse;
}

export const config = {
    matcher: [
        '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
    ],
};
