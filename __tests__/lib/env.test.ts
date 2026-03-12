describe('getPublicEnv', () => {
    const originalEnv = process.env;

    beforeEach(() => {
        jest.resetModules();
        process.env = {
            ...originalEnv,
            NODE_ENV: 'test',
            NEXT_PUBLIC_SITE_URL: 'https://fintechterms.example',
            NEXT_PUBLIC_SUPABASE_URL: 'https://project.supabase.co',
            NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon-key',
            NEXT_PUBLIC_SENTRY_DSN: 'https://sentry.example/1',
        };
    });

    afterAll(() => {
        process.env = originalEnv;
    });

    it('should accept quoted public environment variables', async () => {
        process.env.NEXT_PUBLIC_SITE_URL = '"https://quoted.example"';
        process.env.NEXT_PUBLIC_SUPABASE_URL = '"https://quoted-project.supabase.co"';
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = '"quoted-anon-key"';
        process.env.NEXT_PUBLIC_SENTRY_DSN = '"https://sentry.example/quoted"';

        const { getPublicEnv } = await import('@/lib/env');

        expect(getPublicEnv()).toMatchObject({
            siteUrl: 'https://quoted.example',
            supabaseUrl: 'https://quoted-project.supabase.co',
            supabaseAnonKey: 'quoted-anon-key',
            sentryDsn: 'https://sentry.example/quoted',
        });
    });

    it('should keep unquoted public environment variables intact', async () => {
        const { getPublicEnv } = await import('@/lib/env');

        expect(getPublicEnv()).toMatchObject({
            siteUrl: 'https://fintechterms.example',
            supabaseUrl: 'https://project.supabase.co',
            supabaseAnonKey: 'anon-key',
            sentryDsn: 'https://sentry.example/1',
        });
    });
});
