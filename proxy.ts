import { createServerClient } from '@supabase/ssr';
import { type NextRequest, NextResponse } from 'next/server';
import { hasRequestAuthCookies, isAuthSessionError } from '@/lib/auth/session';

const PROTECTED_PATHS = ['/profile', '/quiz', '/favorites'];

const isProtectedPath = (pathname: string): boolean => (
    PROTECTED_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`))
);

const createPassThroughResponse = (request: NextRequest): NextResponse => (
    NextResponse.next({
        request: {
            headers: request.headers,
        },
    })
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

    return redirectResponse;
};

export async function proxy(request: NextRequest) {
    const requiresAuth = isProtectedPath(request.nextUrl.pathname);
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
        return requiresAuth
            ? NextResponse.redirect(new URL('/', request.url))
            : NextResponse.next();
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
