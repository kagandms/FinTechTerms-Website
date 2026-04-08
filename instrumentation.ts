import * as Sentry from '@sentry/nextjs';
import { assertProductionRateLimiterEnv } from '@/lib/env';

export async function register(): Promise<void> {
    assertProductionRateLimiterEnv();

    if (process.env.NEXT_RUNTIME === 'nodejs') {
        await import('./sentry.server.config');
    }

    if (process.env.NEXT_RUNTIME === 'edge') {
        await import('./sentry.edge.config');
    }
}

export const onRequestError = Sentry.captureRequestError;
