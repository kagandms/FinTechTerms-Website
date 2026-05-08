import { getPublicEnv } from '@/lib/public-env';

const DEFAULT_AUTH_NEXT_PATH = '/profile?complete=1';
const HTTPS_PROTOCOL = 'https:';

const isInternalPath = (value: string): boolean => (
    value.startsWith('/')
    && !value.startsWith('//')
    && !value.startsWith('/\\')
);

const normalizeOrigin = (rawOrigin: string | null | undefined): string | null => {
    if (!rawOrigin) {
        return null;
    }

    try {
        return new URL(rawOrigin).origin;
    } catch {
        return null;
    }
};

const resolveVercelPreviewOrigin = (): string | null => {
    const vercelUrl = process.env.VERCEL_URL?.trim();

    if (!vercelUrl) {
        return null;
    }

    if (vercelUrl.startsWith('http://') || vercelUrl.startsWith('https://')) {
        return normalizeOrigin(vercelUrl);
    }

    return normalizeOrigin(`https://${vercelUrl}`);
};

const resolveForwardedOrigin = (request: Request): string | null => {
    const forwardedHost = request.headers.get('x-forwarded-host')?.trim();

    if (!forwardedHost) {
        return null;
    }

    const forwardedProtocol = request.headers.get('x-forwarded-proto')?.trim();
    const protocol = forwardedProtocol === 'http' ? 'http:' : HTTPS_PROTOCOL;

    return normalizeOrigin(`${protocol}//${forwardedHost}`);
};

const resolveAllowedAuthOrigins = (requestOrigin: string): ReadonlySet<string> => {
    const origins = new Set<string>();
    const publicOrigin = normalizeOrigin(getPublicEnv().siteUrl);
    const previewOrigin = resolveVercelPreviewOrigin();
    const normalizedRequestOrigin = normalizeOrigin(requestOrigin);

    if (publicOrigin) {
        origins.add(publicOrigin);
    }

    if (previewOrigin) {
        origins.add(previewOrigin);
    }

    if (normalizedRequestOrigin && origins.has(normalizedRequestOrigin)) {
        origins.add(normalizedRequestOrigin);
    }

    return origins;
};

export const resolveAuthRequestOrigin = (request: Request): string => {
    const requestOrigin = new URL(request.url).origin;
    const allowedOrigins = resolveAllowedAuthOrigins(requestOrigin);
    const forwardedOrigin = resolveForwardedOrigin(request);

    if (forwardedOrigin && allowedOrigins.has(forwardedOrigin)) {
        return forwardedOrigin;
    }

    if (allowedOrigins.has(requestOrigin)) {
        return requestOrigin;
    }

    return normalizeOrigin(getPublicEnv().siteUrl) ?? requestOrigin;
};

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
        const allowedOrigins = resolveAllowedAuthOrigins(requestOrigin);

        if (allowedOrigins.has(parsedUrl.origin)) {
            return parsedUrl.pathname + parsedUrl.search;
        }
    } catch {
        return fallbackPath;
    }

    return fallbackPath;
};
