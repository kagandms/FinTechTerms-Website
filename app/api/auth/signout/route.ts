import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { cookies } from 'next/headers';

export async function POST() {
    try {
        const supabase = await createClient();

        // 1. Invalidate GoTrue token
        await supabase.auth.signOut({ scope: 'local' });

        // 2. Bruteforce delete all Supabase cookies from the server-side to prevent SSR auto-login
        const cookieStore = await cookies();
        const allCookies = cookieStore.getAll();
        allCookies.forEach(cookie => {
            if (cookie.name.startsWith('sb-')) {
                cookieStore.delete(cookie.name);
            }
        });

        return NextResponse.json({ success: true, message: 'Signed out successfully' }, { status: 200 });
    } catch (e: any) {
        console.error('Sign out error:', e);
        return NextResponse.json({ error: e.message || 'Error occurred during sign out' }, { status: 500 });
    }
}
