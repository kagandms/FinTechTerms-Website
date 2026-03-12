/**
 * @jest-environment node
 */

describe('site URL configuration', () => {
    const originalEnv = process.env;

    beforeEach(() => {
        jest.resetModules();
        process.env = { ...originalEnv };
    });

    afterAll(() => {
        process.env = originalEnv;
    });

    it('normalizes the configured site URL', () => {
        process.env.NEXT_PUBLIC_SITE_URL = 'https://fintechterms.app/';

        jest.isolateModules(() => {
            const { getSiteUrl } = require('@/lib/site-url');
            expect(getSiteUrl()).toBe('https://fintechterms.app');
        });
    });

    it('throws during production access when NEXT_PUBLIC_SITE_URL is missing', () => {
        delete process.env.NEXT_PUBLIC_SITE_URL;
        process.env = {
            ...process.env,
            NODE_ENV: 'production',
        };

        jest.isolateModules(() => {
            const { getSiteUrl } = require('@/lib/site-url');

            expect(() => getSiteUrl()).toThrow(
                'Missing required environment variable NEXT_PUBLIC_SITE_URL. Set it to the public site origin before running a production build or starting the server.'
            );
        });
    });
});
