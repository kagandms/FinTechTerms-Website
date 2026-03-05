import { NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/utils/supabase/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { globalRateLimiter } from '@/lib/rate-limiter';
import { z } from 'zod';

// Token schema: 6 digit string
const LinkTokenSchema = z.object({
    token: z.string().length(6).regex(/^\d+$/, 'Token must be a 6-digit number')
});

const SUPABASE_TIMEOUT_MS = 8000;
const SUPABASE_TIMEOUT_ERROR = 'SUPABASE_REQUEST_TIMEOUT_8S';

const errorToMessage = (error: unknown): string => {
    if (error instanceof Error && error.message) {
        return error.message;
    }

    if (typeof error === 'string' && error.trim()) {
        return error;
    }

    try {
        return JSON.stringify(error);
    } catch {
        return 'Unknown error';
    }
};

const timeoutFetch: typeof fetch = async (input, init = {}) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), SUPABASE_TIMEOUT_MS);
    const upstreamSignal = init.signal;
    const relayAbort = () => controller.abort();

    if (upstreamSignal) {
        if (upstreamSignal.aborted) {
            relayAbort();
        } else {
            upstreamSignal.addEventListener('abort', relayAbort, { once: true });
        }
    }

    try {
        return await fetch(input, {
            ...init,
            signal: controller.signal
        });
    } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
            throw new Error(SUPABASE_TIMEOUT_ERROR);
        }
        throw error;
    } finally {
        clearTimeout(timeoutId);
        if (upstreamSignal) {
            upstreamSignal.removeEventListener('abort', relayAbort);
        }
    }
};

const buildCatchErrorResponse = (scope: string, error: unknown, extra: Record<string, unknown> = {}) => {
    const message = `${scope}: ${errorToMessage(error)}`;
    console.error(message, error);
    return NextResponse.json(
        { error: message, ...extra },
        { status: 500 }
    );
};

const getBearerToken = (request: Request): string | null => {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) return null;

    const token = authHeader.replace('Bearer ', '').trim();
    return token || null;
};

const resolveAuthenticatedContext = async (request: Request): Promise<{
    user: any | null;
    supabase: any;
    error: string | null;
}> => {
    const bearerToken = getBearerToken(request);

    if (bearerToken) {
        const tokenSupabase = createSupabaseClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            {
                global: {
                    fetch: timeoutFetch,
                    headers: { Authorization: `Bearer ${bearerToken}` }
                }
            }
        );

        const { data, error } = await tokenSupabase.auth.getUser();
        if (!error && data.user) {
            return { user: data.user, supabase: tokenSupabase, error: null };
        }
    }

    const cookieSupabase = await createServerClient();
    const { data, error } = await cookieSupabase.auth.getUser();
    if (error || !data.user) {
        return { user: null, supabase: cookieSupabase, error: error?.message || 'unauthorized' };
    }

    return { user: data.user, supabase: cookieSupabase, error: null };
};

export async function GET(request: Request) {
    try {
        const { user } = await resolveAuthenticatedContext(request);
        if (!user) {
            return NextResponse.json({ error: 'unauthorized', isLinked: false }, { status: 401 });
        }

        // Service Role client to bypass RLS for fetching
        const supabaseAdmin = createSupabaseClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!,
            {
                global: {
                    fetch: timeoutFetch
                }
            }
        );

        const { data, error } = await supabaseAdmin
            .from('telegram_users')
            .select('telegram_id, telegram_username')
            .eq('user_id', user.id)
            .single();

        if (error && error.code !== 'PGRST116') { // PGRST116: No rows found
            console.error('Error fetching telegram connection status:', error);
            return NextResponse.json({ error: 'Database error', isLinked: false }, { status: 500 });
        }

        if (data) {
            return NextResponse.json({
                isLinked: true,
                telegram_id: data.telegram_id,
                telegram_username: data.telegram_username
            });
        }

        return NextResponse.json({ isLinked: false });
    } catch (e) {
        return buildCatchErrorResponse('GET_TELEGRAM_LINK_FAILED', e, { isLinked: false });
    }
}

export async function DELETE(request: Request) {
    try {
        const { user } = await resolveAuthenticatedContext(request);
        if (!user) {
            return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
        }

        // Service Role client to bypass RLS for deletion
        const supabaseAdmin = createSupabaseClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!,
            {
                global: {
                    fetch: timeoutFetch
                }
            }
        );

        const { error } = await supabaseAdmin
            .from('telegram_users')
            .delete()
            .eq('user_id', user.id);

        if (error) {
            console.error('Error deleting telegram connection:', error);
            return NextResponse.json({ error: 'Database error' }, { status: 500 });
        }

        return NextResponse.json({ success: true, message: 'Telegram unlinked' });
    } catch (e) {
        return buildCatchErrorResponse('DELETE_TELEGRAM_LINK_FAILED', e);
    }
}

export async function POST(request: Request) {
    // 1. Rate Limiting based on IP
    const ip = request.headers.get('x-forwarded-for') || 'unknown';
    const limitCheck = globalRateLimiter.check(ip);

    if (!limitCheck.allowed) {
        return NextResponse.json(
            { error: 'Слишком много запросов. Too many requests. Çok fazla istek atıldı. Lütfen daha sonra tekrar deneyin.' },
            { status: 429, headers: { 'Retry-After': limitCheck.retryAfter.toString() } }
        );
    }

    let body: unknown;
    try {
        body = await request.json();
    } catch (error) {
        return NextResponse.json({
            error: `Неверный JSON payload. ${errorToMessage(error)}`
        }, { status: 400 });
    }

    const validatedData = LinkTokenSchema.safeParse(body);
    if (!validatedData.success) {
        return NextResponse.json({
            error: 'Неверный формат кода привязки.',
            details: validatedData.error.issues
        }, { status: 400 });
    }

    try {
        // Authenticate the user first
        const { user } = await resolveAuthenticatedContext(request);

        if (!user) {
            return NextResponse.json(
                { error: 'unauthorized' },
                { status: 401 }
            );
        }

        const { token } = validatedData.data;

        // Use Service Role admin client to bypass RLS on account_link_tokens table
        // The table has RLS enabled but NO read policies for authenticated users,
        // which was causing the RPC call to fail silently.
        const supabaseAdmin = createSupabaseClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!,
            {
                global: {
                    fetch: timeoutFetch
                }
            }
        );

        const { data, error } = await supabaseAdmin.rpc('link_telegram_account_v2', {
            p_token: token,
            p_web_user_id: user.id
        });

        if (error) {
            console.error('RPC Error (link_telegram_account_v2):', error);
            // Translate common RPC errors for the frontend
            if (error.message.includes('Geçersiz veya süresi dolmuş token') || error.message.includes('Expired')) {
                return NextResponse.json({ error: 'Неверный или просроченный код. Invalid or expired code. Geçersiz veya süresi dolmuş kod.' }, { status: 400 });
            }
            return NextResponse.json({ error: error.message || 'Ошибка базы данных. Database error occurred. Veritabanı hatası oluştu.' }, { status: 500 });
        }

        // Successfully linked
        return NextResponse.json({
            success: true,
            message: data?.message || 'Аккаунт Telegram успешно привязан! Telegram account successfully linked! Hesap başarıyla bağlandı!',
            telegram_id: data?.telegram_id
        });

    } catch (error) {
        return buildCatchErrorResponse('POST_TELEGRAM_LINK_FAILED', error);
    }
}
