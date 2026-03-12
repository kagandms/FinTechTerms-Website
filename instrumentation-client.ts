import * as Sentry from '@sentry/nextjs';
import { getPublicEnv } from '@/lib/env';

const env = getPublicEnv();

Sentry.init({
    dsn: env.sentryDsn ?? undefined,
    enabled: Boolean(env.sentryDsn),
    environment: env.sentryEnvironment,
    tracesSampleRate: env.sentryTracesSampleRate,
    sendDefaultPii: false,
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
