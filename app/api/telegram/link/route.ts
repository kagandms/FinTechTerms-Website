import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
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
            { error: 'Çok fazla istek atıldı. Lütfen daha sonra tekrar deneyin.' },
            { status: 429, headers: { 'Retry-After': limitCheck.retryAfter.toString() } }
        );
    }

    try {
        const supabase = await createClient();

        // 2. Auth Check - Must be signed in to link an account
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
            return NextResponse.json(
                { error: 'Bu işlemi yapmak için giriş yapmalısınız.' },
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
            if (error.message.includes('Geçersiz veya süresi dolmuş token')) {
                return NextResponse.json({ error: 'Geçersiz veya süresi dolmuş kod. Lütfen bot üzerinden yeni bir kod alın.' }, { status: 400 });
            }
            return NextResponse.json({ error: error.message || 'Veritabanı hatası oluştu.' }, { status: 500 });
        }

        // Successfully linked
        return NextResponse.json({
            success: true,
            message: data?.message || 'Hesap başarıyla birleştirildi!',
            telegram_id: data?.telegram_id
        });

    } catch (error) {
        if (error instanceof z.ZodError) {
            return NextResponse.json({
                error: 'Geçersiz format',
                details: error.errors
            }, { status: 400 });
        }

        console.error('Internal Server Error in /api/telegram/link:', error);
        return NextResponse.json({
            error: 'Sunucu hatası oluştu.'
        }, { status: 500 });
    }
}
