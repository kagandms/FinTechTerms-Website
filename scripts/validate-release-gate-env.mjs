import { runValidation } from './env-validation-utils.mjs';

runValidation([
    'STAGING_BASE_URL',
    'SUPABASE_DB_URL',
    'SUPABASE_SERVICE_ROLE_KEY',
    'ADMIN_USER_IDS',
    'UPSTASH_REDIS_REST_URL',
    'UPSTASH_REDIS_REST_TOKEN',
    'NEXT_PUBLIC_SENTRY_DSN',
    'E2E_AUTH_EMAIL',
    'E2E_AUTH_PASSWORD',
    'E2E_SEED_SECRET',
    'SENTRY_SMOKE_EMAIL',
    'SENTRY_SMOKE_PASSWORD',
]);
