import { getPublicEnv } from '@/lib/public-env';

const DEFAULT_AUTH_NEXT_PATH = '/profile?complete=1';

const isInternalPath = (value: string): boolean => (
    value.startsWith('/')
    && !value.startsWith('//')
    && !value.startsWith('/\\')
);

export const resolveSafeAuthNextPath = (
    rawTarget: string | null,
    requestOrigin: string,
    fallbackPath = DEFAULT_AUTH_NEXT_PATH
): string => {
    const target = rawTarget?.trim();

    if (!target) {
        return fallbackPath;
    }

    if (isInternalPath(target)) {
        return target;
    }

    try {
        const parsedUrl = new URL(target);
        const allowedOrigins = new Set([
            requestOrigin,
            getPublicEnv().siteUrl,
        ]);

        if (allowedOrigins.has(parsedUrl.origin)) {
            return parsedUrl.pathname + parsedUrl.search;
        }
    } catch {
        return fallbackPath;
    }

    return fallbackPath;
};
