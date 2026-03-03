import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function GET() {
    try {
        const supabase = await createClient();
        const { count, error } = await supabase
            .from('terms')
            .select('*', { count: 'exact', head: true });

        if (error) {
            console.error('Error fetching term count:', error);
            return NextResponse.json({ count: 500 }, { status: 200 });
        }

        return NextResponse.json({ count: count || 500 }, { status: 200 });
    } catch (e: any) {
        console.error('Term count API error:', e);
        return NextResponse.json({ count: 500 }, { status: 200 });
    }
}
