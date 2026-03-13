import { normalizeLanguage } from '@/lib/language';
import type { Language } from '@/types';

const LOCAL_DEVELOPMENT_SITE_URL = 'http://localhost:3000';

const PUBLIC_PLACEHOLDER_VALUES = new Set([
    '',
    'your_anon_key_here',
    'https://your-project.supabase.co',
    'https://your-domain.example',
]);

const SERVER_PLACEHOLDER_VALUES = new Set([
    '',
    'your_service_role_key_here',
    'admin@example.com',
]);

export interface PublicEnv {
    readonly siteUrl: string;
    readonly defaultLanguage: Language;
    readonly gaId: string | null;
    readonly supabaseUrl: string | null;
    readonly supabaseAnonKey: string | null;
    readonly sentryDsn: string | null;
    readonly sentryEnvironment: string;
    readonly sentryTracesSampleRate: number;
}

export interface ServerEnv extends PublicEnv {
    readonly adminEmail: string | null;
    readonly serviceRoleKey: string | null;
    readonly sentryAuthToken: string | null;
    readonly sentryOrg: string | null;
    readonly sentryProject: string | null;
}

const normalizeSiteUrl = (value: string): string => (
    value.endsWith('/')
        ? value.slice(0, -1)
        : value
);

const isValidAbsoluteUrl = (value: string): boolean => {
    try {
        const parsedUrl = new URL(value);
        return parsedUrl.protocol === 'http:' || parsedUrl.protocol === 'https:';
    } catch {
        return false;
    }
};

const unwrapQuotedEnvValue = (value: string): string => {
    const trimmedValue = value.trim();

    if (trimmedValue.length < 2) {
        return trimmedValue;
    }

    const firstCharacter = trimmedValue[0];
    const lastCharacter = trimmedValue[trimmedValue.length - 1];
    const hasMatchingQuotes = (
        (firstCharacter === '"' && lastCharacter === '"')
        || (firstCharacter === '\'' && lastCharacter === '\'')
    );

    if (!hasMatchingQuotes) {
        return trimmedValue;
    }

    return trimmedValue.slice(1, -1).trim();
};

const readOptionalValue = (
    rawValue: string | null | undefined,
    placeholderValues: ReadonlySet<string>
): string | null => {
    const value = rawValue ? unwrapQuotedEnvValue(rawValue) : null;

    if (!value || placeholderValues.has(value)) {
        return null;
    }

    return value;
};

const readPlatformSiteUrl = (): string | null => {
    const renderExternalUrl = readOptionalValue(process.env.RENDER_EXTERNAL_URL, new Set(['']));

    if (renderExternalUrl) {
        if (!isValidAbsoluteUrl(renderExternalUrl)) {
            throw new Error('RENDER_EXTERNAL_URL must be an absolute http(s) URL.');
        }

        return normalizeSiteUrl(renderExternalUrl);
    }

    const vercelUrl = readOptionalValue(process.env.VERCEL_URL, new Set(['']));

    if (!vercelUrl) {
        return null;
    }

    return normalizeSiteUrl(`https://${vercelUrl}`);
};

const readRequiredSiteUrl = (): string => {
    const configuredUrl = readOptionalValue(
        process.env.NEXT_PUBLIC_SITE_URL,
        new Set(['', 'https://your-domain.example'])
    );

    if (configuredUrl) {
        if (!isValidAbsoluteUrl(configuredUrl)) {
            throw new Error(
                'NEXT_PUBLIC_SITE_URL must be an absolute http(s) URL.'
            );
        }

        return normalizeSiteUrl(configuredUrl);
    }

    if (process.env.NODE_ENV !== 'production') {
        return LOCAL_DEVELOPMENT_SITE_URL;
    }

    if (typeof window !== 'undefined' && window.location.origin) {
        return normalizeSiteUrl(window.location.origin);
    }

    const platformSiteUrl = readPlatformSiteUrl();

    if (platformSiteUrl) {
        return platformSiteUrl;
    }

    throw new Error(
        'Missing required environment variable NEXT_PUBLIC_SITE_URL. Set it to the public site origin before running a production build or starting the server.'
    );
};

const parseTraceSampleRate = (value: string | null): number => {
    if (!value) {
        return 0.1;
    }

    const parsed = Number.parseFloat(value);
    if (!Number.isFinite(parsed)) {
        return 0.1;
    }

    if (parsed < 0) {
        return 0;
    }

    if (parsed > 1) {
        return 1;
    }

    return parsed;
};

const resolveSentryEnvironment = (): string => (
    process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT?.trim()
    || process.env.SENTRY_ENVIRONMENT?.trim()
    || process.env.VERCEL_ENV?.trim()
    || process.env.NODE_ENV
    || 'development'
);

const buildPublicEnv = (): PublicEnv => ({
    siteUrl: readRequiredSiteUrl(),
    defaultLanguage: normalizeLanguage(process.env.NEXT_PUBLIC_DEFAULT_LANGUAGE) ?? 'ru',
    gaId: readOptionalValue(process.env.NEXT_PUBLIC_GA_ID, new Set([''])),
    supabaseUrl: (() => {
        const value = readOptionalValue(process.env.NEXT_PUBLIC_SUPABASE_URL, PUBLIC_PLACEHOLDER_VALUES);
        return value && isValidAbsoluteUrl(value) ? value : null;
    })(),
    supabaseAnonKey: readOptionalValue(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, PUBLIC_PLACEHOLDER_VALUES),
    sentryDsn: readOptionalValue(process.env.NEXT_PUBLIC_SENTRY_DSN, new Set([''])),
    sentryEnvironment: resolveSentryEnvironment(),
    sentryTracesSampleRate: parseTraceSampleRate(
        readOptionalValue(process.env.SENTRY_TRACES_SAMPLE_RATE, new Set(['']))
    ),
});

let cachedPublicEnv: PublicEnv | null = null;
let cachedServerEnv: ServerEnv | null = null;

export const getPublicEnv = (): PublicEnv => {
    if (process.env.NODE_ENV === 'test') {
        return buildPublicEnv();
    }

    if (!cachedPublicEnv) {
        cachedPublicEnv = buildPublicEnv();
    }

    return cachedPublicEnv;
};

export const getServerEnv = (): ServerEnv => {
    if (process.env.NODE_ENV === 'test') {
        return {
            ...buildPublicEnv(),
            adminEmail: readOptionalValue(process.env.ADMIN_EMAIL, SERVER_PLACEHOLDER_VALUES),
            serviceRoleKey: readOptionalValue(process.env.SUPABASE_SERVICE_ROLE_KEY, SERVER_PLACEHOLDER_VALUES),
            sentryAuthToken: readOptionalValue(process.env.SENTRY_AUTH_TOKEN, new Set([''])),
            sentryOrg: readOptionalValue(process.env.SENTRY_ORG, new Set([''])),
            sentryProject: readOptionalValue(process.env.SENTRY_PROJECT, new Set([''])),
        };
    }

    if (!cachedServerEnv) {
        cachedServerEnv = {
            ...getPublicEnv(),
            adminEmail: readOptionalValue(process.env.ADMIN_EMAIL, SERVER_PLACEHOLDER_VALUES),
            serviceRoleKey: readOptionalValue(process.env.SUPABASE_SERVICE_ROLE_KEY, SERVER_PLACEHOLDER_VALUES),
            sentryAuthToken: readOptionalValue(process.env.SENTRY_AUTH_TOKEN, new Set([''])),
            sentryOrg: readOptionalValue(process.env.SENTRY_ORG, new Set([''])),
            sentryProject: readOptionalValue(process.env.SENTRY_PROJECT, new Set([''])),
        };
    }

    return cachedServerEnv;
};

export const hasConfiguredPublicSupabaseEnv = (
    env: PublicEnv = getPublicEnv()
): boolean => Boolean(env.supabaseUrl && env.supabaseAnonKey);

export const hasConfiguredServiceRoleEnv = (
    env: ServerEnv = getServerEnv()
): boolean => Boolean(env.supabaseUrl && env.serviceRoleKey);
