/**
 * @jest-environment node
 */

import fs from 'node:fs';
import path from 'node:path';

const ROUTE_ONLY_WRITE_ROUTES = [
    'app/api/favorites/route.ts',
    'app/api/record-quiz/route.ts',
    'app/api/study-sessions/route.ts',
] as const;

describe('trusted server-side mutation boundaries', () => {
    it('instantiates the service-role client only in route-only write handlers', () => {
        const profileSource = fs.readFileSync(
            path.resolve(process.cwd(), 'app/api/profile/route.ts'),
            'utf8'
        );

        expect(profileSource).not.toContain('createServiceRoleClient');

        for (const routePath of ROUTE_ONLY_WRITE_ROUTES) {
            const absolutePath = path.resolve(process.cwd(), routePath);
            const source = fs.readFileSync(absolutePath, 'utf8');

            expect(source).toContain('createServiceRoleClient');
        }
    });

    it('calls the intended write boundary functions from route-only handlers', () => {
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
        expect(favoritesSource).not.toMatch(/rpc\(\s*'toggle_user_favorite'/);
        expect(recordQuizSource).toMatch(/rpc\(\s*'record_study_event'/);
        expect(studySessionsSource).toMatch(/rpc\(\s*'start_study_session_server'/);
        expect(studySessionsSource).toMatch(/rpc\(\s*'bind_study_session_token_server'/);
        expect(studySessionsSource).toMatch(/rpc\(\s*'update_study_session_by_token_server'/);
    });
});
