import { z } from 'zod';
import {
    createRequestId,
    errorResponse,
    getClientIp,
    handleRouteError,
    readJsonRequest,
    successResponse,
} from '@/lib/api-response';
import {
    createAuthRouteClient,
    createAuthUnavailableResponse,
    getAuthRouteHeaders,
} from '@/lib/auth/route-handler';
import {
    createAuthRateLimitError,
    enforceSameOriginRoute,
    isJsonRequestValid,
} from '@/lib/auth/route-protection';
import { getSafeAuthErrorCode } from '@/lib/auth/error-messages';
import { logger } from '@/lib/logger';
import { authLoginRateLimiter, isRateLimiterUnavailable } from '@/lib/rate-limiter';

const LoginSchema = z.object({
    email: z.string().email(),
    password: z.string().min(1),
});

const LOGIN_RATE_LIMIT_HEADERS = {
    ...getAuthRouteHeaders(),
    'X-RateLimit-Limit': '10',
    'X-RateLimit-Policy': '10;w=600',
};

export async function POST(request: Request) {
    const requestId = createRequestId(request);
    const originResponse = enforceSameOriginRoute(request, {
        requestId,
        headers: LOGIN_RATE_LIMIT_HEADERS,
    });

    if (originResponse) {
        return originResponse;
    }

    try {
        const jsonResult = await readJsonRequest<unknown>(request, {
            requestId,
            message: 'Invalid JSON payload.',
            headers: LOGIN_RATE_LIMIT_HEADERS,
        });
        if (!isJsonRequestValid(jsonResult)) {
            return jsonResult.response;
        }

        const body = jsonResult.data;
        const parsed = LoginSchema.safeParse(body);

        if (!parsed.success) {
            return errorResponse({
                status: 400,
                code: 'VALIDATION_ERROR',
                message: 'Login payload is invalid.',
                requestId,
                retryable: false,
                headers: LOGIN_RATE_LIMIT_HEADERS,
            });
        }

        const ip = getClientIp(request);
        const emailKey = parsed.data.email.trim().toLowerCase();
        const limitCheck = await authLoginRateLimiter.check(`${ip}:${emailKey}`);

        if (isRateLimiterUnavailable(limitCheck) || !limitCheck.allowed) {
            return createAuthRateLimitError(limitCheck, {
                requestId,
                headers: LOGIN_RATE_LIMIT_HEADERS,
                code: isRateLimiterUnavailable(limitCheck)
                    ? 'RATE_LIMITER_UNAVAILABLE'
                    : 'RATE_LIMITED',
                message: isRateLimiterUnavailable(limitCheck)
                    ? 'Authentication is temporarily unavailable.'
                    : 'RATE_LIMITED',
            });
        }

        const authContext = await createAuthRouteClient();
        if (!authContext) {
            return createAuthUnavailableResponse(requestId);
        }
        const { supabase, applyCookies } = authContext;

        const { data, error } = await supabase.auth.signInWithPassword(parsed.data);
        if (error || !data.user) {
            const safeCode = getSafeAuthErrorCode(error?.message);
            logger.warn('AUTH_LOGIN_FAILED', {
                requestId,
                route: '/api/auth/login',
                error: error instanceof Error ? error : undefined,
            });

            if (safeCode === 'RATE_LIMITED') {
                return createAuthRateLimitError({
                    allowed: false,
                    remaining: 0,
                    retryAfter: 60,
                    unavailable: false,
                }, {
                    requestId,
                    headers: LOGIN_RATE_LIMIT_HEADERS,
                    code: 'RATE_LIMITED',
                    message: 'RATE_LIMITED',
                });
            }

            return errorResponse({
                status: 401,
                code: 'INVALID_CREDENTIALS',
                message: 'INVALID_CREDENTIALS',
                requestId,
                retryable: false,
                headers: LOGIN_RATE_LIMIT_HEADERS,
            });
        }

        logger.info('AUTH_LOGIN_SUCCEEDED', {
            requestId,
            route: '/api/auth/login',
            userId: data.user.id,
            hasSession: Boolean(data.session),
        });
        return applyCookies(successResponse({ success: true }, requestId, {
            headers: LOGIN_RATE_LIMIT_HEADERS,
        }));
    } catch (error) {
        return handleRouteError(error, {
            requestId,
            code: 'AUTH_LOGIN_FAILED',
            message: 'Unable to sign in.',
            retryable: true,
            status: 503,
            headers: LOGIN_RATE_LIMIT_HEADERS,
            logLabel: 'AUTH_LOGIN_ROUTE_FAILED',
        });
    }
}
