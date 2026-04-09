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
import {
    analyticsExportDownloadRateLimiter,
    analyticsExportRouteRateLimiter,
    isRateLimiterUnavailable,
} from '@/lib/rate-limiter';
import { createRequestScopedClient } from '@/lib/supabaseAdmin';
import { resolveRequestMemberEntitlements } from '@/lib/server-member-entitlements';

const EXPORT_PAGE_SIZE = 500;
const MAX_EXPORT_ATTEMPTS = 10_000;
const EXPORT_RATE_LIMIT_HEADERS = {
    'X-RateLimit-Limit': '12',
    'X-RateLimit-Policy': '12;w=60',
};
const EXPORT_DOWNLOAD_RATE_LIMIT_HEADERS = {
    'X-RateLimit-Limit': '2',
    'X-RateLimit-Policy': '2;w=60',
};

const loadDownloadAttempts = async (
    supabase: NonNullable<Awaited<ReturnType<typeof createRequestScopedClient>>>,
    userId: string
): Promise<{ snapshotCreatedAt: string; tooLarge: boolean }> => {
    let cursor: string | null = null;
    let totalAttempts = 0;
    let snapshotCreatedAt: string | null = null;

    do {
        const page = await loadLearningStatsExportAttempts(supabase, userId, {
            cursor,
            limit: EXPORT_PAGE_SIZE,
        });
        snapshotCreatedAt ??= page.snapshotCreatedAt;
        totalAttempts += page.attempts.length;

        if (totalAttempts > MAX_EXPORT_ATTEMPTS) {
            return {
                snapshotCreatedAt: snapshotCreatedAt ?? new Date().toISOString(),
                tooLarge: true,
            };
        }

        cursor = page.nextCursor;
    } while (cursor);

    return {
        snapshotCreatedAt: snapshotCreatedAt ?? new Date().toISOString(),
        tooLarge: false,
    };
};

const createDownloadStream = (
    supabase: NonNullable<Awaited<ReturnType<typeof createRequestScopedClient>>>,
    userId: string,
    exportedAt: string,
    snapshotCreatedAt: string
): ReadableStream<Uint8Array> => {
    const encoder = new TextEncoder();

    return new ReadableStream<Uint8Array>({
        async start(controller) {
            let cursor: string | null = null;
            let isFirstAttempt = true;

            try {
                controller.enqueue(encoder.encode(`{"exportedAt":${JSON.stringify(exportedAt)},"attempts":[`));

                do {
                    const page = await loadLearningStatsExportAttempts(supabase, userId, {
                        cursor,
                        limit: EXPORT_PAGE_SIZE,
                        snapshotCreatedAt,
                    });

                    for (const attempt of page.attempts) {
                        const prefix = isFirstAttempt ? '' : ',';
                        controller.enqueue(encoder.encode(`${prefix}${JSON.stringify(attempt)}`));
                        isFirstAttempt = false;
                    }

                    cursor = page.nextCursor;
                } while (cursor);

                controller.enqueue(encoder.encode(']}'));
                controller.close();
            } catch (error) {
                controller.error(error);
            }
        },
    });
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

        const exportRateLimiter = shouldDownload
            ? analyticsExportDownloadRateLimiter
            : analyticsExportRouteRateLimiter;
        const rateLimitHeaders = shouldDownload
            ? EXPORT_DOWNLOAD_RATE_LIMIT_HEADERS
            : EXPORT_RATE_LIMIT_HEADERS;
        const limitCheck = await exportRateLimiter.check(user.id);

        if (isRateLimiterUnavailable(limitCheck)) {
            return errorResponse({
                status: 503,
                code: 'RATE_LIMITER_UNAVAILABLE',
                message: 'Analytics export is temporarily unavailable.',
                requestId,
                retryable: true,
                headers: rateLimitHeaders,
            });
        }

        if (!limitCheck.allowed) {
            return errorResponse({
                status: 429,
                code: shouldDownload
                    ? 'ANALYTICS_EXPORT_DOWNLOAD_RATE_LIMITED'
                    : 'ANALYTICS_EXPORT_RATE_LIMITED',
                message: shouldDownload
                    ? 'Too many analytics download requests. Please try again later.'
                    : 'Too many analytics export requests. Please try again later.',
                requestId,
                retryable: true,
                headers: {
                    ...rateLimitHeaders,
                    'Retry-After': String(limitCheck.retryAfter),
                },
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
                headers: rateLimitHeaders,
            });
        }

        if (shouldDownload) {
            const exportedAt = new Date().toISOString();
            const { snapshotCreatedAt, tooLarge } = await loadDownloadAttempts(supabase, user.id);

            if (tooLarge) {
                return errorResponse({
                    status: 413,
                    code: 'ANALYTICS_EXPORT_TOO_LARGE',
                    message: 'Analytics export exceeds the maximum download size. Use the paginated export endpoint instead.',
                    requestId,
                    retryable: false,
                    headers: rateLimitHeaders,
                });
            }

            return new Response(createDownloadStream(
                supabase,
                user.id,
                exportedAt,
                snapshotCreatedAt
            ), {
                status: 200,
                headers: {
                    ...rateLimitHeaders,
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
                ...rateLimitHeaders,
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
                headers: shouldDownload
                    ? EXPORT_DOWNLOAD_RATE_LIMIT_HEADERS
                    : EXPORT_RATE_LIMIT_HEADERS,
            });
        }

        return handleRouteError(error, {
            requestId,
            code: 'ANALYTICS_EXPORT_FAILED',
            message: 'Unable to export analytics data.',
            timeoutCode: 'ANALYTICS_EXPORT_TIMEOUT',
            timeoutMessage: 'Analytics export timed out.',
            headers: shouldDownload
                ? EXPORT_DOWNLOAD_RATE_LIMIT_HEADERS
                : EXPORT_RATE_LIMIT_HEADERS,
            logLabel: 'GET_ANALYTICS_EXPORT_FAILED',
        });
    }
}
