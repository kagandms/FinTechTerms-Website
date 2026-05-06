export const CSP_NONCE_HEADER = 'x-csp-nonce';

export const buildContentSecurityPolicy = (_nonce: string): string => ([
    "default-src 'self'",
    // Static App Router pages emit framework inline scripts at build time; per-request nonces block hydration on prerendered HTML.
    "script-src 'self' 'unsafe-inline' https://www.googletagmanager.com https://www.google-analytics.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: blob: https:",
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://www.google-analytics.com https://*.google-analytics.com https://analytics.google.com https://stats.g.doubleclick.net https://*.ingest.sentry.io https://*.sentry.io",
    "frame-src 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "worker-src 'self'",
].join('; '));
