import {
    createRequestId,
    errorResponse,
    handleRouteError,
    successResponse,
} from '@/lib/api-response';
import { AUTH_REQUIRED_MESSAGE } from '@/lib/auth/session';
import {
    InvalidAnalyticsExportCursorError,
    loadLearningStatsExportAttempts,
} from '@/lib/learning-stats';
import { createRequestScopedClient, resolveAuthenticatedUser } from '@/lib/supabaseAdmin';

/**
 * Export the authenticated user's full quiz attempt history for analytics.
 */
export async function GET(request: Request) {
    const requestId = createRequestId(request);
    const requestUrl = new URL(request.url);
    const cursor = requestUrl.searchParams.get('cursor');
    const limit = (() => {
        const rawLimit = requestUrl.searchParams.get('limit');
        if (!rawLimit) {
            return undefined;
        }

        const parsedLimit = Number.parseInt(rawLimit, 10);
        return Number.isFinite(parsedLimit) && parsedLimit > 0
            ? parsedLimit
            : undefined;
    })();

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

        const supabase = await createRequestScopedClient(request);
        if (!supabase) {
            return errorResponse({
                status: 503,
                code: 'ANALYTICS_EXPORT_UNAVAILABLE',
                message: 'Analytics export is temporarily unavailable.',
                requestId,
                retryable: false,
            });
        }

        const { attempts, nextCursor } = await loadLearningStatsExportAttempts(supabase, user.id, {
            cursor,
            limit,
        });

        return successResponse({
            exportedAt: new Date().toISOString(),
            attempts,
            nextCursor,
        }, requestId, {
            headers: {
                'Cache-Control': 'no-store',
            },
        });
    } catch (error) {
        if (error instanceof InvalidAnalyticsExportCursorError) {
            return errorResponse({
                status: 400,
                code: 'INVALID_CURSOR',
                message: 'Analytics export cursor is invalid.',
                requestId,
                retryable: false,
            });
        }

        return handleRouteError(error, {
            requestId,
            code: 'ANALYTICS_EXPORT_FAILED',
            message: 'Unable to export analytics data.',
            timeoutCode: 'ANALYTICS_EXPORT_TIMEOUT',
            timeoutMessage: 'Analytics export timed out.',
            logLabel: 'GET_ANALYTICS_EXPORT_FAILED',
        });
    }
}
