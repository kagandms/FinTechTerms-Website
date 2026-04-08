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

describe('getServerEnv', () => {
    const originalEnv = process.env;

    beforeEach(() => {
        jest.resetModules();
        process.env = {
            ...originalEnv,
            NODE_ENV: 'test',
            NEXT_PUBLIC_SITE_URL: 'https://fintechterms.example',
            NEXT_PUBLIC_SUPABASE_URL: 'https://project.supabase.co',
            NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon-key',
            OPENROUTER_API_KEY: 'openrouter-key',
            AI_PRIMARY_MODEL: 'qwen/qwen3-next-80b-a3b-instruct:free',
            AI_FALLBACK_MODELS: 'openai/gpt-oss-120b:free,google/gemma-3-27b-it:free',
            OPENROUTER_REFERER: 'https://fintechterms.example',
            OPENROUTER_APP_NAME: 'FinTechTerms',
        };
    });

    afterAll(() => {
        process.env = originalEnv;
    });

    it('should parse OpenRouter AI configuration from server env', async () => {
        const { getServerEnv, hasConfiguredAiEnv } = await import('@/lib/env');

        expect(getServerEnv()).toMatchObject({
            openRouterApiKey: 'openrouter-key',
            aiPrimaryModel: 'qwen/qwen3-next-80b-a3b-instruct:free',
            aiFallbackModels: [
                'openai/gpt-oss-120b:free',
                'google/gemma-3-27b-it:free',
            ],
            openRouterReferer: 'https://fintechterms.example',
            openRouterAppName: 'FinTechTerms',
        });
        expect(hasConfiguredAiEnv()).toBe(true);
    });

    it('should detect when distributed rate limiting env is configured', async () => {
        process.env.UPSTASH_REDIS_REST_URL = 'https://example.upstash.io';
        process.env.UPSTASH_REDIS_REST_TOKEN = 'upstash-token-12345678901234567890';

        const { hasConfiguredRateLimiterEnv } = await import('@/lib/env');

        expect(hasConfiguredRateLimiterEnv()).toBe(true);
    });

    it('should fail fast for production runtime when distributed rate limiting env is missing', async () => {
        process.env = {
            ...process.env,
            NODE_ENV: 'production',
        };
        delete process.env.UPSTASH_REDIS_REST_URL;
        delete process.env.UPSTASH_REDIS_REST_TOKEN;

        const { assertProductionRateLimiterEnv } = await import('@/lib/env');

        expect(() => assertProductionRateLimiterEnv()).toThrow(
            'Production runtime requires UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN. Configure distributed rate limiting before starting the app.'
        );
    });

    it('should fail fast for production runtime when critical runtime env is missing', async () => {
        process.env = {
            ...process.env,
            NODE_ENV: 'production',
            NEXT_PUBLIC_SUPABASE_URL: 'https://project.supabase.co',
            NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon-key',
            SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
            STUDY_SESSION_TOKEN_SECRET: 'study-session-secret',
            OPENROUTER_API_KEY: 'openrouter-key',
            AI_PRIMARY_MODEL: 'openai/gpt-oss-20b',
            AI_FALLBACK_MODELS: '',
            ADMIN_USER_IDS: '',
            NEXT_PUBLIC_SENTRY_DSN: '',
            UPSTASH_REDIS_REST_URL: 'https://example.upstash.io',
            UPSTASH_REDIS_REST_TOKEN: 'upstash-token-12345678901234567890',
        };

        const { assertProductionRuntimeEnv } = await import('@/lib/env');

        expect(() => assertProductionRuntimeEnv()).toThrow(
            'Production runtime is missing required environment variables: AI_FALLBACK_MODELS, ADMIN_USER_IDS, NEXT_PUBLIC_SENTRY_DSN.'
        );
    });
});
