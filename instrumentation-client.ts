import { getPublicEnv } from '@/lib/public-env';

const env = getPublicEnv();

type SentryClient = typeof import('@sentry/nextjs');

let sentryClientPromise: Promise<SentryClient | null> | null = null;
let hasRegisteredClientErrorListeners = false;

const getInitializedSentryClient = async (): Promise<SentryClient | null> => {
    if (!env.sentryDsn) {
        return null;
    }

    if (!sentryClientPromise) {
        sentryClientPromise = import('@sentry/nextjs').then((Sentry) => {
            Sentry.init({
                dsn: env.sentryDsn ?? undefined,
                enabled: true,
                environment: env.sentryEnvironment,
                tracesSampleRate: env.sentryTracesSampleRate,
                sendDefaultPii: false,
                beforeSend: (event) => (event.level === 'info' ? null : event),
            });

            return Sentry;
        });
    }

    return sentryClientPromise;
};

const captureClientException = async (error: unknown): Promise<void> => {
    const Sentry = await getInitializedSentryClient();

    if (!Sentry) {
        return;
    }

    Sentry.captureException(error);
};

const registerClientErrorListeners = (): void => {
    if (hasRegisteredClientErrorListeners) {
        return;
    }

    hasRegisteredClientErrorListeners = true;

    window.addEventListener('error', (event) => {
        void captureClientException(event.error ?? event.message);
    });

    window.addEventListener('unhandledrejection', (event) => {
        void captureClientException(event.reason);
    });
};

const scheduleAfterInitialLoad = (callback: () => void): void => {
    const scheduleDuringIdle = (): void => {
        if ('requestIdleCallback' in window) {
            window.requestIdleCallback(callback);
            return;
        }

        queueMicrotask(callback);
    };

    if (document.readyState === 'complete') {
        scheduleDuringIdle();
        return;
    }

    window.addEventListener('load', scheduleDuringIdle, { once: true });
};

if (env.sentryDsn && typeof window !== 'undefined') {
    scheduleAfterInitialLoad(registerClientErrorListeners);
}

export const onRouterTransitionStart = (): void => {};
