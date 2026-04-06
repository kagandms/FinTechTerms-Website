import React from 'react';
import { render, screen } from '@testing-library/react';

const mockCreateClient = jest.fn();
const mockSafeGetSupabaseUser = jest.fn();
const mockCreateServiceRoleClient = jest.fn();
const mockRedirect = jest.fn();
const dashboardClientSpy = jest.fn();

jest.mock('next/link', () => ({
    __esModule: true,
    default: ({ href, children }: { href: string; children: React.ReactNode }) => (
        <a href={href}>{children}</a>
    ),
}));

jest.mock('next/navigation', () => ({
    redirect: (...args: unknown[]) => mockRedirect(...args),
}));

jest.mock('@/utils/supabase/server', () => ({
    createClient: () => mockCreateClient(),
}));

jest.mock('@/lib/auth/session', () => ({
    safeGetSupabaseUser: (...args: unknown[]) => mockSafeGetSupabaseUser(...args),
}));

jest.mock('@/lib/admin-access', () => ({
    isAdminUserId: () => true,
}));

jest.mock('@/lib/env', () => ({
    getServerEnv: () => ({
        adminUserIds: ['admin-1'],
    }),
}));

jest.mock('@/lib/supabaseAdmin', () => ({
    createServiceRoleClient: () => mockCreateServiceRoleClient(),
}));

jest.mock('@/components/DashboardClient', () => ({
    __esModule: true,
    default: (props: unknown) => {
        dashboardClientSpy(props);
        return <div data-testid="dashboard-client" />;
    },
}));

describe('admin dashboard page', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockCreateClient.mockReturnValue({});
        mockSafeGetSupabaseUser.mockResolvedValue({
            user: { id: 'admin-1' },
        });
    });

    it('degrades only the failing panel when an aggregate RPC throws', async () => {
        const rpc = jest.fn().mockImplementation((name: string) => {
            if (name === 'get_admin_simulation_learning_curve') {
                throw new Error('network failure');
            }

            if (name === 'get_admin_simulation_latency_summary') {
                return Promise.resolve({
                    data: [{ name: 'Correct', ms: 1000 }],
                    error: null,
                });
            }

            if (name === 'get_admin_simulation_fatigue_curve') {
                return Promise.resolve({
                    data: [{ order: 1, errorRate: 20 }],
                    error: null,
                });
            }

            return Promise.resolve({
                data: [{ range: '0-5%', count: 1 }],
                error: null,
            });
        });
        mockCreateServiceRoleClient.mockReturnValue({ rpc });

        const AdminDashboardPage = (await import('@/app/(app)/admin/dashboard/page')).default;
        const view = await AdminDashboardPage();

        render(view);

        expect(screen.getByTestId('dashboard-client')).toBeInTheDocument();
        expect(dashboardClientSpy).toHaveBeenCalledWith(expect.objectContaining({
            learningData: expect.objectContaining({
                queryName: 'Learning curve',
                status: 'error',
                data: [],
            }),
            latencyData: expect.objectContaining({
                queryName: 'Latency analysis',
                status: 'ready',
            }),
            fatigueRaw: expect.objectContaining({
                queryName: 'Fatigue analysis',
                status: 'ready',
            }),
            distributionRaw: expect.objectContaining({
                queryName: 'Class distribution',
                status: 'ready',
            }),
        }));
    });
});
