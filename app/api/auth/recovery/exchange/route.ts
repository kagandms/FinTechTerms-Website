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
import {
    getPasswordRecoveryCookieOptions,
    PASSWORD_RECOVERY_COOKIE_NAME,
} from '@/lib/auth/password-recovery-cookie';
import { authRecoveryExchangeRateLimiter, isRateLimiterUnavailable } from '@/lib/rate-limiter';

const RecoveryExchangeSchema = z.object({
    accessToken: z.string().min(1),
    refreshToken: z.string().min(1),
});

const RECOVERY_EXCHANGE_RATE_LIMIT_HEADERS = {
    ...getAuthRouteHeaders(),
    'X-RateLimit-Limit': '10',
    'X-RateLimit-Policy': '10;w=600',
};

export async function POST(request: Request) {
    const requestId = createRequestId(request);
    const originResponse = enforceSameOriginRoute(request, {
        requestId,
        headers: RECOVERY_EXCHANGE_RATE_LIMIT_HEADERS,
    });

    if (originResponse) {
        return originResponse;
    }

    try {
        const jsonResult = await readJsonRequest<unknown>(request, {
            requestId,
            message: 'Invalid JSON payload.',
            headers: RECOVERY_EXCHANGE_RATE_LIMIT_HEADERS,
        });
        if (!isJsonRequestValid(jsonResult)) {
            return jsonResult.response;
        }

        const parsed = RecoveryExchangeSchema.safeParse(jsonResult.data);
        if (!parsed.success) {
            return errorResponse({
                status: 400,
                code: 'VALIDATION_ERROR',
                message: 'Recovery exchange payload is invalid.',
                requestId,
                retryable: false,
                headers: RECOVERY_EXCHANGE_RATE_LIMIT_HEADERS,
            });
        }

        const ip = getClientIp(request);
        const limitCheck = await authRecoveryExchangeRateLimiter.check(ip);
        if (isRateLimiterUnavailable(limitCheck) || !limitCheck.allowed) {
            return createAuthRateLimitError(limitCheck, {
                requestId,
                headers: RECOVERY_EXCHANGE_RATE_LIMIT_HEADERS,
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
        const { error } = await supabase.auth.setSession({
            access_token: parsed.data.accessToken,
            refresh_token: parsed.data.refreshToken,
        });

        if (error) {
            return errorResponse({
                status: 400,
                code: 'RECOVERY_EXCHANGE_FAILED',
                message: 'Unable to establish the recovery session.',
                requestId,
                retryable: false,
                headers: RECOVERY_EXCHANGE_RATE_LIMIT_HEADERS,
            });
        }

        const response = successResponse({ success: true }, requestId, {
            headers: RECOVERY_EXCHANGE_RATE_LIMIT_HEADERS,
        });
        response.cookies.set(
            PASSWORD_RECOVERY_COOKIE_NAME,
            '1',
            getPasswordRecoveryCookieOptions()
        );

        return applyCookies(response);
    } catch (error) {
        return handleRouteError(error, {
            requestId,
            code: 'RECOVERY_EXCHANGE_FAILED',
            message: 'Unable to establish the recovery session.',
            retryable: true,
            status: 503,
            headers: RECOVERY_EXCHANGE_RATE_LIMIT_HEADERS,
            logLabel: 'AUTH_RECOVERY_EXCHANGE_ROUTE_FAILED',
        });
    }
}
