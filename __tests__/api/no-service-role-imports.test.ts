/**
 * @jest-environment node
 */

import fs from 'node:fs';
import path from 'node:path';

const ROUTES = [
    'app/api/favorites/route.ts',
    'app/api/record-quiz/route.ts',
    'app/api/study-sessions/route.ts',
] as const;

describe('internet-facing write routes', () => {
    it('do not import or call createServiceRoleClient', () => {
        for (const routePath of ROUTES) {
            const absolutePath = path.resolve(process.cwd(), routePath);
            const source = fs.readFileSync(absolutePath, 'utf8');

            expect(source).not.toContain('createServiceRoleClient');
        }
    });
});
