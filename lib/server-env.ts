import 'server-only';

import {
    getPublicEnv,
    hasConfiguredEnvValue,
    readListValue,
    readOptionalValue,
    unwrapQuotedEnvValue,
    type PublicEnv,
} from '@/lib/public-env';

export type { PublicEnv } from '@/lib/public-env';

const SERVER_PLACEHOLDER_VALUES = new Set([
    '',
    'your_service_role_key_here',
    'admin@example.com',
]);

export interface ServerEnv extends PublicEnv {
    readonly adminEmail: string | null;
    readonly adminUserIds: readonly string[];
    readonly serviceRoleKey: string | null;
    readonly studySessionTokenSecret: string | null;
    readonly openRouterApiKey: string | null;
    readonly aiPrimaryModel: string | null;
    readonly aiFallbackModels: readonly string[];
    readonly openRouterReferer: string | null;
    readonly openRouterAppName: string | null;
    readonly sentryAuthToken: string | null;
    readonly sentryOrg: string | null;
    readonly sentryProject: string | null;
}

const readAdminUserIds = (rawValue: string | null | undefined): string[] => (
    (rawValue ?? '')
        .split(',')
        .map((value) => unwrapQuotedEnvValue(value).trim())
        .filter(Boolean)
);

const buildServerEnv = (): ServerEnv => ({
    ...getPublicEnv(),
    adminEmail: readOptionalValue(process.env.ADMIN_EMAIL, SERVER_PLACEHOLDER_VALUES),
    adminUserIds: readAdminUserIds(process.env.ADMIN_USER_IDS),
    serviceRoleKey: readOptionalValue(process.env.SUPABASE_SERVICE_ROLE_KEY, SERVER_PLACEHOLDER_VALUES),
    studySessionTokenSecret: readOptionalValue(
        process.env.STUDY_SESSION_TOKEN_SECRET,
        new Set(['', 'your_study_session_token_secret_here'])
    ),
    openRouterApiKey: readOptionalValue(process.env.OPENROUTER_API_KEY, new Set(['', 'your_openrouter_api_key_here'])),
    aiPrimaryModel: readOptionalValue(process.env.AI_PRIMARY_MODEL, new Set([''])),
    aiFallbackModels: readListValue(process.env.AI_FALLBACK_MODELS),
    openRouterReferer: readOptionalValue(process.env.OPENROUTER_REFERER, new Set([''])),
    openRouterAppName: readOptionalValue(process.env.OPENROUTER_APP_NAME, new Set([''])),
    sentryAuthToken: readOptionalValue(process.env.SENTRY_AUTH_TOKEN, new Set([''])),
    sentryOrg: readOptionalValue(process.env.SENTRY_ORG, new Set([''])),
    sentryProject: readOptionalValue(process.env.SENTRY_PROJECT, new Set([''])),
});

let cachedServerEnv: ServerEnv | null = null;

export const getServerEnv = (): ServerEnv => {
    if (process.env.NODE_ENV === 'test') {
        return buildServerEnv();
    }

    if (!cachedServerEnv) {
        cachedServerEnv = buildServerEnv();
    }

    return cachedServerEnv;
};

export const hasConfiguredServiceRoleEnv = (
    env: ServerEnv = getServerEnv()
): boolean => Boolean(env.supabaseUrl && env.serviceRoleKey);

export const hasConfiguredRateLimiterEnv = (): boolean => (
    hasConfiguredEnvValue(process.env.UPSTASH_REDIS_REST_URL)
    && hasConfiguredEnvValue(process.env.UPSTASH_REDIS_REST_TOKEN)
);

export const hasConfiguredStudySessionEnv = (
    env: ServerEnv = getServerEnv()
): boolean => Boolean(
    env.supabaseUrl
    && env.studySessionTokenSecret
    && env.supabaseAnonKey
);

export const hasConfiguredAiEnv = (
    env: ServerEnv = getServerEnv()
): boolean => Boolean(
    env.openRouterApiKey
    && env.aiPrimaryModel
);

const collectMissingProductionRuntimeKeys = (
    env: ServerEnv = getServerEnv()
): string[] => {
    const missing: string[] = [];

    if (!env.supabaseUrl) missing.push('NEXT_PUBLIC_SUPABASE_URL');
    if (!env.supabaseAnonKey) missing.push('NEXT_PUBLIC_SUPABASE_ANON_KEY');
    if (!env.serviceRoleKey) missing.push('SUPABASE_SERVICE_ROLE_KEY');
    if (!env.studySessionTokenSecret) missing.push('STUDY_SESSION_TOKEN_SECRET');
    if (!env.openRouterApiKey) missing.push('OPENROUTER_API_KEY');
    if (!env.aiPrimaryModel) missing.push('AI_PRIMARY_MODEL');
    if (env.aiFallbackModels.length === 0) missing.push('AI_FALLBACK_MODELS');
    if (env.adminUserIds.length === 0) missing.push('ADMIN_USER_IDS');
    if (!env.sentryDsn) missing.push('NEXT_PUBLIC_SENTRY_DSN');
    if (!hasConfiguredRateLimiterEnv()) missing.push('UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN');

    return missing;
};

export const assertProductionRateLimiterEnv = (): void => {
    if (process.env.NODE_ENV !== 'production') {
        return;
    }

    if (hasConfiguredRateLimiterEnv()) {
        return;
    }

    throw new Error(
        'Production runtime requires UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN. Configure distributed rate limiting before starting the app.'
    );
};

export const assertProductionRuntimeEnv = (
    env: ServerEnv = getServerEnv()
): void => {
    if (process.env.NODE_ENV !== 'production') {
        return;
    }

    const missingKeys = collectMissingProductionRuntimeKeys(env);
    if (missingKeys.length === 0) {
        return;
    }

    throw new Error(
        `Production runtime is missing required environment variables: ${missingKeys.join(', ')}.`
    );
};
