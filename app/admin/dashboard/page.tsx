import { createClient } from '@/utils/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import DashboardClient from '@/components/DashboardClient';
import { redirect } from 'next/navigation';

export default async function AdminDashboard() {
    // 1. Auth Check (Server Side Cookie Verification)
    const supabaseAuth = await createClient();
    const { data: { user } } = await supabaseAuth.auth.getUser();

    // Security Gate
    if (!user || user.email !== process.env.ADMIN_EMAIL) {
        redirect('/'); // Send unauthorized users to home
    }

    // 2. Data Fetching (Service Role for Admin Access)
    const supabaseAdmin = createServiceClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // 1. Learning Curve Data (Date vs Accuracy)
    const { data: learningData } = await supabaseAdmin
        .from('quiz_attempts')
        .select('created_at, is_correct')
        .eq('quiz_type', 'simulation')
        .order('created_at', { ascending: true });

    // 2. Latency Data (Correct vs Incorrect timing)
    const { data: latencyData } = await supabaseAdmin
        .from('quiz_attempts')
        .select('is_correct, response_time_ms')
        .eq('quiz_type', 'simulation');

    // 3. Fatigue Analysis (Needs session_id - pending schema update)
    // For now, we will try to fetch it, but if session_id is missing, we handle it gracefully or use dummy ordering
    const { data: fatigueRaw } = await supabaseAdmin
        .from('quiz_attempts')
        .select('session_id, is_correct, created_at') // ordering needs to be done in JS if no order column
        .eq('quiz_type', 'simulation');

    // 4. Class Distribution (Needs link to user/anonymous_id)
    const { data: distributionRaw } = await supabaseAdmin
        .from('study_sessions')
        .select(`
    id,
    anonymous_id,
    quiz_attempts (
      is_correct
    )
  `)
        .like('anonymous_id', 'bot_%');

    return (
        <div className="container mx-auto p-6 space-y-8">
            <h1 className="text-3xl font-bold mb-6">Simulation Analytics Dashboard</h1>

            <DashboardClient
                learningData={learningData || []}
                latencyData={latencyData || []}
                fatigueRaw={fatigueRaw || []}
                distributionRaw={distributionRaw || []}
            />
        </div>
    );
}
