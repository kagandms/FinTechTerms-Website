import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function POST() {
    try {
        const supabase = await createClient();

        // Tells Supabase Go-True server to invalidate the token 
        // This is necessary to fully revoke the session.
        const { error } = await supabase.auth.signOut({ scope: 'local' });

        if (error) {
            console.error('Supabase signOut error:', error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        // The createServerClient component sets the cookies immediately using header setters
        return NextResponse.json({ success: true, message: 'Signed out successfully' }, { status: 200 });
    } catch (e: any) {
        console.error('Sign out error:', e);
        return NextResponse.json({ error: e.message || 'Error occurred during sign out' }, { status: 500 });
    }
}
