// ============================================
// Supabase Auth Session Refresh Proxy (Middleware Helper)
//
// PURPOSE: This is a middleware helper that refreshes Supabase auth
// cookies on every request. It ensures Server Components and API routes
// always have a valid session by calling `getUser()` (not `getSession()`)
// which triggers token refresh on Supabase's side.
//
// USAGE: Import `proxy` in middleware.ts and call it in the middleware chain.
// This file is NOT a Next.js middleware itself — it's a reusable function.
//
// SEE ALSO: ADR-002 in docs/ADR.md for Supabase architecture decision.
// ============================================

import { type NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export async function proxy(request: NextRequest) {
    let supabaseResponse = NextResponse.next({
        request: {
            headers: request.headers,
        },
    })

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    // Skip middleware if Supabase is not configured
    if (!supabaseUrl || !supabaseAnonKey) {
        return supabaseResponse
    }

    const supabase = createServerClient(
        supabaseUrl,
        supabaseAnonKey,
        {
            cookies: {
                getAll() {
                    return request.cookies.getAll()
                },
                setAll(cookiesToSet) {
                    // Set cookies on the request (for downstream server components)
                    cookiesToSet.forEach(({ name, value }) => {
                        request.cookies.set(name, value)
                    })

                    // Create a new response with updated cookies
                    supabaseResponse = NextResponse.next({
                        request: {
                            headers: request.headers,
                        },
                    })

                    // Set cookies on the response (for the browser)
                    cookiesToSet.forEach(({ name, value, options }) => {
                        supabaseResponse.cookies.set(name, value, options)
                    })
                },
            },
        }
    )

    // Refresh the auth token on every request
    // IMPORTANT: Do NOT use getSession() here, it does not refresh the token
    await supabase.auth.getUser()

    return supabaseResponse
}

export const config = {
    matcher: [
        /*
         * Match all request paths except for the ones starting with:
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         * - Static assets (svg, png, jpg, etc.)
         */
        '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
    ],
}
