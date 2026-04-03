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
import { createRequestScopedClient } from '@/lib/supabaseAdmin';
import { resolveRequestMemberEntitlements } from '@/lib/server-member-entitlements';

const EXPORT_PAGE_SIZE = 500;
const MAX_EXPORT_ATTEMPTS = 10_000;

const loadDownloadAttempts = async (
    supabase: NonNullable<Awaited<ReturnType<typeof createRequestScopedClient>>>,
    userId: string
): Promise<{ attempts: Awaited<ReturnType<typeof loadLearningStatsExportAttempts>>['attempts']; tooLarge: boolean }> => {
    let cursor: string | null = null;
    const attempts: Awaited<ReturnType<typeof loadLearningStatsExportAttempts>>['attempts'] = [];

    do {
        const page = await loadLearningStatsExportAttempts(supabase, userId, {
            cursor,
            limit: EXPORT_PAGE_SIZE,
        });
        attempts.push(...page.attempts);

        if (attempts.length > MAX_EXPORT_ATTEMPTS) {
            return {
                attempts: attempts.slice(0, MAX_EXPORT_ATTEMPTS),
                tooLarge: true,
            };
        }

        cursor = page.nextCursor;
    } while (cursor);

    return {
        attempts,
        tooLarge: false,
    };
};

/**
 * Export the authenticated user's full quiz attempt history for analytics.
 */
export async function GET(request: Request) {
    const requestId = createRequestId(request);
    const requestUrl = new URL(request.url);
    const cursor = requestUrl.searchParams.get('cursor');
    const shouldDownload = requestUrl.searchParams.get('download') === '1';
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
        const memberState = await resolveRequestMemberEntitlements(request);
        const user = memberState.user;

        if (memberState.unavailable) {
            return errorResponse({
                status: memberState.unavailable.status,
                code: memberState.unavailable.code,
                message: memberState.unavailable.message,
                requestId,
                retryable: true,
            });
        }

        if (!user) {
            return errorResponse({
                status: 401,
                code: 'UNAUTHORIZED',
                message: AUTH_REQUIRED_MESSAGE,
                requestId,
                retryable: false,
            });
        }

        if (!memberState.entitlements.canUseAdvancedAnalytics) {
            return errorResponse({
                status: 403,
                code: 'MEMBER_REQUIRED',
                message: 'Complete your member setup to unlock analytics export.',
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

        if (shouldDownload) {
            const exportedAt = new Date().toISOString();
            const { attempts, tooLarge } = await loadDownloadAttempts(supabase, user.id);

            if (tooLarge) {
                return errorResponse({
                    status: 413,
                    code: 'ANALYTICS_EXPORT_TOO_LARGE',
                    message: 'Analytics export exceeds the maximum download size. Use the paginated export endpoint instead.',
                    requestId,
                    retryable: false,
                });
            }

            return new Response(JSON.stringify({
                exportedAt,
                attempts,
            }), {
                status: 200,
                headers: {
                    'Cache-Control': 'no-store',
                    'Content-Type': 'application/json; charset=utf-8',
                    'Content-Disposition': `attachment; filename="fintechterms-analytics-${exportedAt.slice(0, 10)}.json"`,
                    'X-Request-Id': requestId,
                },
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
