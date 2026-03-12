import * as Sentry from '@sentry/nextjs';
import { getServerEnv } from '@/lib/env';

const env = getServerEnv();

Sentry.init({
    dsn: env.sentryDsn ?? undefined,
    enabled: Boolean(env.sentryDsn),
    environment: env.sentryEnvironment,
    tracesSampleRate: env.sentryTracesSampleRate,
    sendDefaultPii: false,
});
