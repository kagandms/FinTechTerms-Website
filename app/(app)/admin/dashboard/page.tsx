import Link from 'next/link';
import { createClient } from '@/utils/supabase/server';
import DashboardClient, {
    type DashboardQueryState,
    type DistributionRecord,
    type LatencyPoint,
    type LearningCurvePoint,
    type OrderedFatiguePoint,
} from '@/components/DashboardClient';
import { redirect } from 'next/navigation';
import { safeGetSupabaseUser } from '@/lib/auth/session';
import { getServerEnv } from '@/lib/env';
import { logger } from '@/lib/logger';
import { isAdminUserId } from '@/lib/admin-access';
import { createServiceRoleClient } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

const loadDashboardQuery = async <T,>(
    queryName: string,
    query: () => Promise<{ data: T[] | null; error: { message: string } | null }>
): Promise<DashboardQueryState<T>> => {
    try {
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
    } catch (error) {
        logger.error(`[AdminDashboard] ${queryName} query threw`, {
            route: 'AdminDashboard',
            error: error instanceof Error ? error : undefined,
        });
        return {
            queryName,
            status: 'error',
            data: [],
        };
    }
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

    let supabaseAdmin: ReturnType<typeof createServiceRoleClient> | null = null;

    try {
        supabaseAdmin = createServiceRoleClient();
    } catch (error) {
        logger.error('ADMIN_DASHBOARD_SERVICE_ROLE_CLIENT_ERROR', {
            route: 'AdminDashboard',
            error: error instanceof Error ? error : undefined,
        });
    }

    // Aggregated analytics are computed in SQL so the dashboard reflects the full dataset.
    const [learningData, latencyData, fatigueRaw, distributionRaw] = await Promise.all([
        loadDashboardQuery<LearningCurvePoint>('Learning curve', async () => {
            if (!supabaseAdmin) {
                throw new Error('Service-role client unavailable.');
            }
            const response = await supabaseAdmin.rpc('get_admin_simulation_learning_curve');
            return {
                data: response.data as LearningCurvePoint[] | null,
                error: response.error ? { message: response.error.message } : null,
            };
        }),
        loadDashboardQuery<LatencyPoint>('Latency analysis', async () => {
            if (!supabaseAdmin) {
                throw new Error('Service-role client unavailable.');
            }
            const response = await supabaseAdmin.rpc('get_admin_simulation_latency_summary');
            return {
                data: response.data as LatencyPoint[] | null,
                error: response.error ? { message: response.error.message } : null,
            };
        }),
        loadDashboardQuery<OrderedFatiguePoint>('Fatigue analysis', async () => {
            if (!supabaseAdmin) {
                throw new Error('Service-role client unavailable.');
            }
            const response = await supabaseAdmin.rpc('get_admin_simulation_fatigue_curve');
            return {
                data: response.data as OrderedFatiguePoint[] | null,
                error: response.error ? { message: response.error.message } : null,
            };
        }),
        loadDashboardQuery<DistributionRecord>('Class distribution', async () => {
            if (!supabaseAdmin) {
                throw new Error('Service-role client unavailable.');
            }
            const response = await supabaseAdmin.rpc('get_admin_simulation_accuracy_distribution');
            return {
                data: response.data as DistributionRecord[] | null,
                error: response.error ? { message: response.error.message } : null,
            };
        }),
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
