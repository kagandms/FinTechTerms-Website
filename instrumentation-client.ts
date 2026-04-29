import * as Sentry from '@sentry/nextjs';
import { getPublicEnv } from '@/lib/public-env';

const env = getPublicEnv();

Sentry.init({
    dsn: env.sentryDsn ?? undefined,
    enabled: Boolean(env.sentryDsn),
    environment: env.sentryEnvironment,
    tracesSampleRate: env.sentryTracesSampleRate,
    sendDefaultPii: false,
    beforeSend: (event) => (event.level === 'info' ? null : event),
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
