import * as Sentry from '@sentry/nextjs';
import {
    createRequestId,
    errorResponse,
    handleRouteError,
    successResponse,
} from '@/lib/api-response';
import { AUTH_REQUIRED_MESSAGE } from '@/lib/auth/session';
import { getServerEnv } from '@/lib/env';
import { logger } from '@/lib/logger';
import { resolveAuthenticatedUser } from '@/lib/supabaseAdmin';

export async function POST(request: Request) {
    const requestId = createRequestId(request);
    const env = getServerEnv();

    try {
        const user = await resolveAuthenticatedUser(request);

        if (!user) {
            return errorResponse({
                status: 401,
                code: 'UNAUTHORIZED',
                message: AUTH_REQUIRED_MESSAGE,
                requestId,
                retryable: false,
            });
        }

        if (!env.adminEmail || user.email !== env.adminEmail) {
            return errorResponse({
                status: 403,
                code: 'FORBIDDEN',
                message: 'Admin access required.',
                requestId,
                retryable: false,
            });
        }

        if (!env.sentryDsn) {
            return errorResponse({
                status: 503,
                code: 'SENTRY_SMOKE_DISABLED',
                message: 'Sentry smoke testing is unavailable because NEXT_PUBLIC_SENTRY_DSN is not configured.',
                requestId,
                retryable: false,
            });
        }

        const smokeError = new Error('Sentry smoke test event');
        const eventId = Sentry.withScope((scope) => {
            scope.setTag('smoke', 'true');
            scope.setTag('route', '/api/admin/sentry-smoke');
            scope.setTag('environment', env.sentryEnvironment);
            scope.setTag('requestId', requestId);
            scope.setUser({
                id: user.id,
                email: user.email ?? undefined,
            });
            scope.setExtra('retryable', false);

            return Sentry.captureException(smokeError);
        });

        await Sentry.flush(2_000);

        logger.info('SENTRY_SMOKE_TRIGGERED', {
            requestId,
            route: '/api/admin/sentry-smoke',
            userId: user.id,
            tags: {
                smoke: 'true',
                environment: env.sentryEnvironment,
            },
        });

        return successResponse({ ok: true, eventId }, requestId);
    } catch (error) {
        return handleRouteError(error, {
            requestId,
            code: 'SENTRY_SMOKE_FAILED',
            message: 'Unable to send Sentry smoke event.',
            timeoutCode: 'SENTRY_SMOKE_TIMEOUT',
            timeoutMessage: 'Sentry smoke request timed out.',
            logLabel: 'SENTRY_SMOKE_ROUTE_FAILED',
        });
    }
}
