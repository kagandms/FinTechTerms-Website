const LOCAL_DEVELOPMENT_SITE_URL = 'http://localhost:3000';

const normalizeSiteUrl = (value: string): string => (
    value.endsWith('/')
        ? value.slice(0, -1)
        : value
);

export function getSiteUrl(): string {
    const configuredUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();

    if (configuredUrl) {
        return normalizeSiteUrl(configuredUrl);
    }

    if (process.env.NODE_ENV !== 'production') {
        return LOCAL_DEVELOPMENT_SITE_URL;
    }

    throw new Error(
        'Missing required environment variable NEXT_PUBLIC_SITE_URL. Set it to the public site origin before running a production build or starting the server.'
    );
}

export const siteUrl = getSiteUrl();
