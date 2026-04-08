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
import { authResendOtpRateLimiter, isRateLimiterUnavailable } from '@/lib/rate-limiter';

const ResendOtpSchema = z.object({
    email: z.string().email(),
});

const RESEND_OTP_RATE_LIMIT_HEADERS = {
    ...getAuthRouteHeaders(),
    'X-RateLimit-Limit': '5',
    'X-RateLimit-Policy': '5;w=600',
};

export async function POST(request: Request) {
    const requestId = createRequestId(request);
    const originResponse = enforceSameOriginRoute(request, {
        requestId,
        headers: RESEND_OTP_RATE_LIMIT_HEADERS,
    });

    if (originResponse) {
        return originResponse;
    }

    try {
        const jsonResult = await readJsonRequest<unknown>(request, {
            requestId,
            message: 'Invalid JSON payload.',
            headers: RESEND_OTP_RATE_LIMIT_HEADERS,
        });
        if (!isJsonRequestValid(jsonResult)) {
            return jsonResult.response;
        }

        const parsed = ResendOtpSchema.safeParse(jsonResult.data);
        if (!parsed.success) {
            return errorResponse({
                status: 400,
                code: 'VALIDATION_ERROR',
                message: 'OTP resend payload is invalid.',
                requestId,
                retryable: false,
                headers: RESEND_OTP_RATE_LIMIT_HEADERS,
            });
        }

        const ip = getClientIp(request);
        const emailKey = parsed.data.email.trim().toLowerCase();
        const limitCheck = await authResendOtpRateLimiter.check(`${ip}:${emailKey}`);
        if (isRateLimiterUnavailable(limitCheck) || !limitCheck.allowed) {
            return createAuthRateLimitError(limitCheck, {
                requestId,
                headers: RESEND_OTP_RATE_LIMIT_HEADERS,
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
        const { error } = await supabase.auth.resend({
            type: 'signup',
            email: parsed.data.email,
        });

        if (error && getSafeAuthErrorCode(error.message) === 'RATE_LIMITED') {
            return createAuthRateLimitError({
                allowed: false,
                remaining: 0,
                retryAfter: 60,
                unavailable: false,
            }, {
                requestId,
                headers: RESEND_OTP_RATE_LIMIT_HEADERS,
                code: 'RATE_LIMITED',
                message: 'RATE_LIMITED',
            });
        }

        return applyCookies(successResponse({ success: true }, requestId, {
            headers: RESEND_OTP_RATE_LIMIT_HEADERS,
        }));
    } catch (error) {
        return handleRouteError(error, {
            requestId,
            code: 'OTP_RESEND_FAILED',
            message: 'Unable to resend the OTP code.',
            retryable: true,
            status: 503,
            headers: RESEND_OTP_RATE_LIMIT_HEADERS,
            logLabel: 'AUTH_RESEND_OTP_ROUTE_FAILED',
        });
    }
}
