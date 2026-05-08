#!/usr/bin/env node

import { loadLocalEnv } from './env-validation-utils.mjs';

const CANONICAL_PUBLIC_SITE_URL = 'https://www.fintechterms.com';
const ENFORCE_FLAG = 'ENFORCE_PUBLIC_SITE_ORIGIN';

const normalizeUrl = (value) => (
    value.endsWith('/') ? value.slice(0, -1) : value
);

const shouldEnforcePublicOrigin = () => (
    process.env[ENFORCE_FLAG]?.trim() === '1'
    || process.env.VERCEL_ENV?.trim() === 'production'
);

const getConfiguredSiteUrl = () => (
    normalizeUrl(process.env.NEXT_PUBLIC_SITE_URL?.trim() ?? '')
);

loadLocalEnv({ allowLocalEnv: true });

if (!shouldEnforcePublicOrigin()) {
    console.log(JSON.stringify({
        ok: true,
        enforced: false,
        canonicalPublicSiteUrl: CANONICAL_PUBLIC_SITE_URL,
    }, null, 2));
    process.exit(0);
}

const configuredSiteUrl = getConfiguredSiteUrl();

if (configuredSiteUrl !== CANONICAL_PUBLIC_SITE_URL) {
    console.error(JSON.stringify({
        ok: false,
        message: 'NEXT_PUBLIC_SITE_URL must match the canonical public origin for production SEO.',
        expected: CANONICAL_PUBLIC_SITE_URL,
        actual: configuredSiteUrl || null,
    }, null, 2));
    process.exit(1);
}

console.log(JSON.stringify({
    ok: true,
    enforced: true,
    canonicalPublicSiteUrl: CANONICAL_PUBLIC_SITE_URL,
}, null, 2));
