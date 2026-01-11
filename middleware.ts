
import { type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export async function middleware(request: NextRequest) {
    let response = await fetch(request.url, {
        method: 'HEAD',
    })
    response = new Response(null, {
        headers: response.headers,
        status: response.status,
        statusText: response.statusText,
    })

    // We need to create a response object first to pass to createServerClient
    // However, Next.js middleware requires us to return a NextResponse if we want to proceed.
    // The official pattern is slightly different. Let's use the standard "updateSession" pattern.

    // Standard Supabase Middleware Pattern
    return await updateSession(request)
}

async function updateSession(request: NextRequest) {
    let response = import('next/server').then(mod => mod.NextResponse.next({
        request: {
            headers: request.headers,
        },
    }))

    // Await the response promise
    let supabaseResponse = await response

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return request.cookies.getAll()
                },
                setAll(cookiesToSet) {
                    cookiesToSet.forEach(({ name, value, options }) => {
                        request.cookies.set(name, value)
                    })

                    cookiesToSet.forEach(({ name, value, options }) => {
                        supabaseResponse.cookies.set(name, value, options)
                    })
                },
            },
        }
    )

    // Refreshing the auth token
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
         * Feel free to modify this pattern to include more paths.
         */
        '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
    ],
}
