import { NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/utils/supabase/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { globalRateLimiter } from '@/lib/rate-limiter';
import { z } from 'zod';

// Token schema: 6 digit string
const LinkTokenSchema = z.object({
    token: z.string().length(6).regex(/^\d+$/, "Token must be a 6-digit number")
});

export async function POST(request: Request) {
    // 1. Rate Limiting based on IP
    const ip = request.headers.get('x-forwarded-for') || 'unknown';
    const limitCheck = globalRateLimiter.check(ip);

    if (!limitCheck.allowed) {
        return NextResponse.json(
            { error: 'Too many requests / Слишком много запросов / Çok fazla istek atıldı. Lütfen daha sonra tekrar deneyin.' },
            { status: 429, headers: { 'Retry-After': limitCheck.retryAfter.toString() } }
        );
    }

    try {
        // 2. Extract Auth Header
        const authHeader = request.headers.get('Authorization');
        const tokenStr = authHeader?.replace('Bearer ', '');

        let supabase;
        let user;

        if (tokenStr) {
            // Instantiate a client authenticated directly with the client JWT
            supabase = createSupabaseClient(
                process.env.NEXT_PUBLIC_SUPABASE_URL!,
                process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
                {
                    global: {
                        headers: { Authorization: `Bearer ${tokenStr}` }
                    }
                }
            );
            const { data } = await supabase.auth.getUser();
            user = data.user;
        } else {
            // Fallback to cookies if available
            supabase = await createServerClient();
            const { data } = await supabase.auth.getUser();
            user = data.user;
        }

        if (!user) {
            return NextResponse.json(
                { error: 'unauthorized' },
                { status: 401 }
            );
        }

        const body = await request.json();

        // 3. Validation with Zod
        const validatedData = LinkTokenSchema.parse(body);
        const { token } = validatedData;

        // 4. Call the RPC function 'link_telegram_account' 
        // We use the authenticated Supabase client so `auth.uid()` resolves correctly in RPC
        const { data, error } = await supabase.rpc('link_telegram_account', {
            p_token: token
        });

        if (error) {
            console.error('RPC Error (link_telegram_account):', error);
            // Translate common RPC errors for the frontend
            if (error.message.includes('Geçersiz veya süresi dolmuş token') || error.message.includes('Expired')) {
                return NextResponse.json({ error: 'Invalid or expired code. Please get a new one from the bot. / Неверный код. / Geçersiz veya süresi dolmuş kod.' }, { status: 400 });
            }
            return NextResponse.json({ error: error.message || 'Database error occurred. / Ошибка базы данных. / Veritabanı hatası oluştu.' }, { status: 500 });
        }

        // Successfully linked
        return NextResponse.json({
            success: true,
            message: data?.message || 'Telegram account successfully linked! / Аккаунт привязан! / Hesap başarıyla bağlandı!',
            telegram_id: data?.telegram_id
        });

    } catch (error) {
        if (error instanceof z.ZodError) {
            return NextResponse.json({
                error: 'Invalid format / Неверный формат / Geçersiz format',
                details: error.errors
            }, { status: 400 });
        }

        console.error('Internal Server Error in /api/telegram/link:', error);
        return NextResponse.json({
            error: 'Server error / Ошибка сервера / Sunucu hatası oluştu.'
        }, { status: 500 });
    }
}
