import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { createTimeoutFetch, type RegisteredRouteMetricContext } from '@/lib/api-response'
import { getPublicEnv } from '@/lib/public-env'
import { logger } from '@/lib/logger'
import { getSupabaseServerCookieOptions } from '@/lib/supabase-cookie-options'
import type { SupabaseClient } from '@supabase/supabase-js'

type ServerSupabaseClient = SupabaseClient

export async function createOptionalClient(
    metricContext?: RegisteredRouteMetricContext | null
): Promise<ServerSupabaseClient | null> {
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
                fetch: createTimeoutFetch(undefined, {
                    dependency: 'supabase',
                    requestId: metricContext?.requestId,
                    route: metricContext?.route,
                }),
            },
        }
    )
}

export async function createClient(
    metricContext?: RegisteredRouteMetricContext | null
): Promise<ServerSupabaseClient> {
    const supabaseClient = await createOptionalClient(metricContext)

    if (!supabaseClient) {
        throw new Error('Supabase server client requires NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.')
    }

    return supabaseClient
}
