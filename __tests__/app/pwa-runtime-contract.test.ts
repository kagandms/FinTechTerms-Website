/**
 * @jest-environment node
 */

import fs from 'node:fs';
import path from 'node:path';

describe('PWA runtime contract', () => {
    it('ships a committed service worker asset at public/sw.js', () => {
        const serviceWorkerPath = path.join(process.cwd(), 'public', 'sw.js');

        expect(fs.existsSync(serviceWorkerPath)).toBe(true);
        expect(fs.readFileSync(serviceWorkerPath, 'utf8')).toContain('STATIC_CACHE_NAME');
    });
});
