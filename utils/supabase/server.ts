import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { createTimeoutFetch } from '@/lib/api-response'
import { getPublicEnv } from '@/lib/env'
import { logger } from '@/lib/logger'
import { getSupabaseServerCookieOptions } from '@/lib/supabase-cookie-options'
import type { SupabaseClient } from '@supabase/supabase-js'

const timeoutFetch = createTimeoutFetch()

type ServerSupabaseClient = SupabaseClient

export async function createOptionalClient(): Promise<ServerSupabaseClient | null> {
    const cookieStore = await cookies()
    const env = getPublicEnv()

    if (!env.supabaseUrl || !env.supabaseAnonKey) {
        return null
    }

    return createServerClient(
        env.supabaseUrl,
        env.supabaseAnonKey,
        {
            cookieOptions: getSupabaseServerCookieOptions(),
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
                        logger.warn('SUPABASE_SERVER_COOKIE_SET_SKIPPED', {
                            route: 'createServerSupabaseClient',
                            error: error instanceof Error ? error : undefined,
                        })
                    }
                },
            },
            global: {
                fetch: timeoutFetch,
            },
        }
    )
}

export async function createClient(): Promise<ServerSupabaseClient> {
    const supabaseClient = await createOptionalClient()

    if (!supabaseClient) {
        throw new Error('Supabase server client requires NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.')
    }

    return supabaseClient
}
