const { default: withPWA } = require("@ducanh2912/next-pwa");

const sensitiveNetworkOnlyRoutes = [
    {
        urlPattern: ({ url }) =>
            url.pathname === '/profile'
            || url.pathname.startsWith('/profile/')
            || url.pathname.startsWith('/api/telegram/link')
            || url.pathname.startsWith('/api/auth/')
            || url.pathname.startsWith('/auth'),
        handler: 'NetworkOnly',
        method: 'GET',
    },
];

const withPWAConfig = withPWA({
    dest: "public",
    cacheOnFrontEndNav: true,
    aggressiveFrontEndNavCaching: true,
    extendDefaultRuntimeCaching: true,
    reloadOnOnline: true,
    swcMinify: true,
    disable: process.env.NODE_ENV === "development",
    workboxOptions: {
        disableDevLogs: true,
        runtimeCaching: sensitiveNetworkOnlyRoutes,
    },
});

/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: true,
    env: {
        NEXT_PUBLIC_DEFAULT_LANGUAGE: 'ru',
    },
    // Explicitly empty for now as we force webpack in package.json
    turbopack: {},
    // Security headers for production
    async headers() {
        return [
            {
                source: '/(.*)',
                headers: [
                    { key: 'Content-Language', value: 'ru' },
                    { key: 'X-Frame-Options', value: 'DENY' },
                    { key: 'X-Content-Type-Options', value: 'nosniff' },
                    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
                    { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
                    { key: 'X-DNS-Prefetch-Control', value: 'on' },
                    {
                        key: 'Strict-Transport-Security',
                        value: 'max-age=31536000; includeSubDomains; preload'
                    },
                    {
                        key: 'Content-Security-Policy',
                        value: [
                            "default-src 'self'",
                            "script-src 'self' 'unsafe-inline' https://www.googletagmanager.com https://www.google-analytics.com",
                            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
                            "font-src 'self' https://fonts.gstatic.com",
                            "img-src 'self' data: blob: https:",
                            "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://www.google-analytics.com",
                            "frame-src 'none'",
                            "object-src 'none'",
                            "base-uri 'self'",
                            "form-action 'self'",
                            "worker-src 'self'",
                        ].join('; ')
                    },
                ],
            },
        ];
    },
};

module.exports = withPWAConfig(nextConfig);
