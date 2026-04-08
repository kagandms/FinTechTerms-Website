/**
 * @jest-environment node
 */

import fs from 'node:fs';
import path from 'node:path';

const migrationPath = path.join(
    process.cwd(),
    'supabase/migrations/20260403140000_admin_dashboard_aggregate_rpc.sql'
);

describe('admin dashboard aggregate rpc migration', () => {
    const source = fs.readFileSync(migrationPath, 'utf8');

    it('restricts admin analytics RPCs to service_role', () => {
        expect(source).toContain("if v_request_role <> 'service_role' then");
        expect(source).toContain('grant execute on function public.get_admin_simulation_learning_curve() to service_role;');
        expect(source).toContain('grant execute on function public.get_admin_simulation_latency_summary() to service_role;');
        expect(source).toContain('grant execute on function public.get_admin_simulation_fatigue_curve() to service_role;');
        expect(source).toContain('grant execute on function public.get_admin_simulation_accuracy_distribution() to service_role;');
    });

    it('builds fatigue analytics from explicit session_id boundaries only', () => {
        expect(source).toContain('partition by qa.session_id');
        expect(source).toContain('qa.session_id is not null');
    });

    it('aggregates the full simulation dataset instead of sampling recent attempts', () => {
        expect(source).toContain("where qa.quiz_type = 'simulation'");
        expect(source).not.toContain('limit 5000');
    });
});
