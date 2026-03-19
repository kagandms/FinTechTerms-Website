import Link from 'next/link';
import { createClient } from '@/utils/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import DashboardClient, { type DashboardQueryState } from '@/components/DashboardClient';
import { redirect } from 'next/navigation';
import { safeGetSupabaseUser } from '@/lib/auth/session';
import { getServerEnv } from '@/lib/env';
import { logger } from '@/lib/logger';
import { isAdminUserId } from '@/lib/admin-access';

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
    let userId: string | undefined;
    try {
        const supabaseAuth = await createClient();
        const authState = await safeGetSupabaseUser(supabaseAuth);
        userId = authState.user?.id;
    } catch (error) {
        logger.error('ADMIN_DASHBOARD_AUTH_ERROR', {
            route: 'AdminDashboard',
            error: error instanceof Error ? error : undefined,
        });
        redirect('/dashboard');
    }

    // Security Gate
    if (!isAdminUserId(userId ?? null, env)) {
        redirect('/dashboard');
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
            .select('user_id, is_correct, created_at')
            .eq('quiz_type', 'simulation')),
        loadDashboardQuery('Class distribution', async () => await supabaseAdmin
            .from('quiz_attempts')
            .select('user_id, is_correct')
            .eq('quiz_type', 'simulation')),
    ]);

    return (
        <div className="container mx-auto p-6 space-y-8">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <h1 className="text-3xl font-bold">Simulation Analytics Dashboard</h1>
                <Link
                    href="/admin/dashboard/seo"
                    className="inline-flex items-center justify-center rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition-colors hover:border-slate-900 hover:text-slate-950"
                >
                    Open SEO readiness
                </Link>
            </div>

            <DashboardClient
                learningData={learningData}
                latencyData={latencyData}
                fatigueRaw={fatigueRaw}
                distributionRaw={distributionRaw}
            />
        </div>
    );
}
