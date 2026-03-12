import { createClient } from '@/utils/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import DashboardClient, { type DashboardQueryState } from '@/components/DashboardClient';
import { redirect } from 'next/navigation';
import { safeGetSupabaseUser } from '@/lib/auth/session';
import { getServerEnv } from '@/lib/env';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

const loadDashboardQuery = async <T,>(
    queryName: string,
    query: () => Promise<{ data: T[] | null; error: { message: string } | null }>
): Promise<DashboardQueryState<T>> => {
    const { data, error } = await query();

    if (error) {
        logger.error(`[AdminDashboard] ${queryName} query failed`, {
            route: 'AdminDashboard',
            error: new Error(error.message),
        });
        return {
            queryName,
            status: 'error',
            data: [],
        };
    }

    return {
        queryName,
        status: 'ready',
        data: data ?? [],
    };
};

export default async function AdminDashboard() {
    const env = getServerEnv();
    let userEmail: string | undefined;
    try {
        const supabaseAuth = await createClient();
        const authState = await safeGetSupabaseUser(supabaseAuth);
        userEmail = authState.user?.email;
    } catch (error) {
        logger.error('ADMIN_DASHBOARD_AUTH_ERROR', {
            route: 'AdminDashboard',
            error: error instanceof Error ? error : undefined,
        });
        redirect('/');
    }

    // Security Gate
    if (!userEmail || userEmail !== env.adminEmail) {
        redirect('/'); // Send unauthorized users to home
    }

    // 2. Data Fetching (Service Role for Admin Access)
    const supabaseAdmin = createServiceClient(
        env.supabaseUrl!,
        env.serviceRoleKey!
    );

    // 1. Learning Curve Data (Date vs Accuracy)
    const [learningData, latencyData, fatigueRaw, distributionRaw] = await Promise.all([
        loadDashboardQuery('Learning curve', async () => await supabaseAdmin
            .from('quiz_attempts')
            .select('created_at, is_correct')
            .eq('quiz_type', 'simulation')
            .order('created_at', { ascending: true })),
        loadDashboardQuery('Latency analysis', async () => await supabaseAdmin
            .from('quiz_attempts')
            .select('is_correct, response_time_ms')
            .eq('quiz_type', 'simulation')),
        loadDashboardQuery('Fatigue analysis', async () => await supabaseAdmin
            .from('quiz_attempts')
            .select('session_id, is_correct, created_at')
            .eq('quiz_type', 'simulation')),
        loadDashboardQuery('Class distribution', async () => await supabaseAdmin
            .from('study_sessions')
            .select(`
    id,
    anonymous_id,
    quiz_attempts (
      is_correct
    )
  `)
            .like('anonymous_id', 'bot_%')),
    ]);

    return (
        <div className="container mx-auto p-6 space-y-8">
            <h1 className="text-3xl font-bold mb-6">Simulation Analytics Dashboard</h1>

            <DashboardClient
                learningData={learningData}
                latencyData={latencyData}
                fatigueRaw={fatigueRaw}
                distributionRaw={distributionRaw}
            />
        </div>
    );
}
