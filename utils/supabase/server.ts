
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

const SUPABASE_TIMEOUT_MS = 8000
const SUPABASE_TIMEOUT_ERROR = 'SUPABASE_REQUEST_TIMEOUT_8S'

const timeoutFetch: typeof fetch = async (input, init = {}) => {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), SUPABASE_TIMEOUT_MS)
    const upstreamSignal = init.signal
    const relayAbort = () => controller.abort()

    if (upstreamSignal) {
        if (upstreamSignal.aborted) {
            relayAbort()
        } else {
            upstreamSignal.addEventListener('abort', relayAbort, { once: true })
        }
    }

    try {
        return await fetch(input, {
            ...init,
            signal: controller.signal,
        })
    } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
            throw new Error(SUPABASE_TIMEOUT_ERROR)
        }
        throw error
    } finally {
        clearTimeout(timeoutId)
        if (upstreamSignal) {
            upstreamSignal.removeEventListener('abort', relayAbort)
        }
    }
}

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
                        // This can be ignored if you have middleware refreshing
                        // user sessions.
                    }
                },
            },
            global: {
                fetch: timeoutFetch,
            },
        }
    )
}
