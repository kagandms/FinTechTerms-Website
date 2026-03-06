import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { createTimeoutFetch } from '@/lib/api-response'

const timeoutFetch = createTimeoutFetch()

export async function createClient() {
    const cookieStore = await cookies()

    return createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return cookieStore.getAll()
                },
                setAll(cookiesToSet) {
                    try {
                        cookiesToSet.forEach(({ name, value, options }) => {
                            cookieStore.set(name, value, options)
                        })
                    } catch (error) {
                        // The `set` method was called from a Server Component.
                        console.warn(
                            'SUPABASE_SERVER_COOKIE_SET_SKIPPED',
                            error
                        )
                    }
                },
            },
            global: {
                fetch: timeoutFetch,
            },
        }
    )
}
