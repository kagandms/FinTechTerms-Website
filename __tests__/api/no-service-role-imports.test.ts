/**
 * @jest-environment node
 */

import fs from 'node:fs';
import path from 'node:path';

const PUBLIC_WRITE_ROUTES = [
    'app/api/favorites/route.ts',
    'app/api/record-quiz/route.ts',
    'app/api/study-sessions/route.ts',
] as const;

describe('trusted server-side mutation boundaries', () => {
    it('instantiates the service-role client only in explicit admin handlers', () => {
        const profileSource = fs.readFileSync(
            path.resolve(process.cwd(), 'app/api/profile/route.ts'),
            'utf8'
        );
        const adminDashboardSource = fs.readFileSync(
            path.resolve(process.cwd(), 'app/(app)/admin/dashboard/page.tsx'),
            'utf8'
        );

        expect(profileSource).not.toContain('createServiceRoleClient');
        expect(adminDashboardSource).toContain('createServiceRoleClient');

        for (const routePath of PUBLIC_WRITE_ROUTES) {
            const absolutePath = path.resolve(process.cwd(), routePath);
            const source = fs.readFileSync(absolutePath, 'utf8');

            expect(source).not.toContain('createServiceRoleClient');
        }
    });

    it('calls the intended request-scoped wrapper functions from public write handlers', () => {
        const favoritesSource = fs.readFileSync(
            path.resolve(process.cwd(), 'app/api/favorites/route.ts'),
            'utf8'
        );
        const recordQuizSource = fs.readFileSync(
            path.resolve(process.cwd(), 'app/api/record-quiz/route.ts'),
            'utf8'
        );
        const studySessionsSource = fs.readFileSync(
            path.resolve(process.cwd(), 'app/api/study-sessions/route.ts'),
            'utf8'
        );

        expect(favoritesSource).toMatch(/rpc\(\s*'toggle_my_favorite'/);
        expect(favoritesSource).not.toMatch(/rpc\(\s*'toggle_my_favorite_server'/);
        expect(recordQuizSource).toMatch(/rpc\(\s*'record_my_study_event'/);
        expect(recordQuizSource).not.toMatch(/rpc\(\s*'record_study_event'/);
        expect(studySessionsSource).toMatch(/rpc\(\s*'start_study_session'/);
        expect(studySessionsSource).toMatch(/rpc\(\s*'bind_study_session_token'/);
        expect(studySessionsSource).toMatch(/rpc\(\s*'update_study_session_by_token'/);
        expect(studySessionsSource).not.toMatch(/rpc\(\s*'start_study_session_server'/);
        expect(studySessionsSource).not.toMatch(/rpc\(\s*'bind_study_session_token_server'/);
        expect(studySessionsSource).not.toMatch(/rpc\(\s*'update_study_session_by_token_server'/);
    });
});
