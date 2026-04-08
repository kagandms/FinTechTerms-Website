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
import { authVerifyOtpRateLimiter, isRateLimiterUnavailable } from '@/lib/rate-limiter';

const VerifyOtpSchema = z.object({
    email: z.string().email(),
    token: z.string().regex(/^\d{6}$/),
    password: z.string().min(1).optional(),
});

const VERIFY_OTP_RATE_LIMIT_HEADERS = {
    ...getAuthRouteHeaders(),
    'X-RateLimit-Limit': '10',
    'X-RateLimit-Policy': '10;w=600',
};

export async function POST(request: Request) {
    const requestId = createRequestId(request);
    const originResponse = enforceSameOriginRoute(request, {
        requestId,
        headers: VERIFY_OTP_RATE_LIMIT_HEADERS,
    });

    if (originResponse) {
        return originResponse;
    }

    try {
        const jsonResult = await readJsonRequest<unknown>(request, {
            requestId,
            message: 'Invalid JSON payload.',
            headers: VERIFY_OTP_RATE_LIMIT_HEADERS,
        });
        if (!isJsonRequestValid(jsonResult)) {
            return jsonResult.response;
        }

        const parsed = VerifyOtpSchema.safeParse(jsonResult.data);
        if (!parsed.success) {
            return errorResponse({
                status: 400,
                code: 'VALIDATION_ERROR',
                message: 'OTP verification payload is invalid.',
                requestId,
                retryable: false,
                headers: VERIFY_OTP_RATE_LIMIT_HEADERS,
            });
        }

        const ip = getClientIp(request);
        const emailKey = parsed.data.email.trim().toLowerCase();
        const limitCheck = await authVerifyOtpRateLimiter.check(`${ip}:${emailKey}`);
        if (isRateLimiterUnavailable(limitCheck) || !limitCheck.allowed) {
            return createAuthRateLimitError(limitCheck, {
                requestId,
                headers: VERIFY_OTP_RATE_LIMIT_HEADERS,
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
        const { data, error } = await supabase.auth.verifyOtp({
            email: parsed.data.email,
            token: parsed.data.token,
            type: 'signup',
        });

        if (error) {
            const safeCode = getSafeAuthErrorCode(error.message);
            if (safeCode === 'RATE_LIMITED') {
                return createAuthRateLimitError({
                    allowed: false,
                    remaining: 0,
                    retryAfter: 60,
                    unavailable: false,
                }, {
                    requestId,
                    headers: VERIFY_OTP_RATE_LIMIT_HEADERS,
                    code: 'RATE_LIMITED',
                    message: 'RATE_LIMITED',
                });
            }

            return errorResponse({
                status: 400,
                code: 'OTP_VERIFICATION_FAILED',
                message: 'OTP_INVALID_OR_EXPIRED',
                requestId,
                retryable: false,
                headers: VERIFY_OTP_RATE_LIMIT_HEADERS,
            });
        }

        if (!data.user) {
            return errorResponse({
                status: 409,
                code: 'OTP_VERIFICATION_FAILED',
                message: 'OTP_INVALID_OR_EXPIRED',
                requestId,
                retryable: false,
                headers: VERIFY_OTP_RATE_LIMIT_HEADERS,
            });
        }

        if (!data.session && parsed.data.password) {
            const signInResult = await supabase.auth.signInWithPassword({
                email: parsed.data.email,
                password: parsed.data.password,
            });

            if (signInResult.error || !signInResult.data.session) {
                return errorResponse({
                    status: 409,
                    code: 'OTP_SESSION_UNAVAILABLE',
                    message: 'Verification succeeded, but an authenticated session could not be established. Please sign in.',
                    requestId,
                    retryable: false,
                    headers: VERIFY_OTP_RATE_LIMIT_HEADERS,
                });
            }
        }

        return applyCookies(successResponse({ success: true }, requestId, {
            headers: VERIFY_OTP_RATE_LIMIT_HEADERS,
        }));
    } catch (error) {
        return handleRouteError(error, {
            requestId,
            code: 'OTP_VERIFICATION_FAILED',
            message: 'Unable to verify the OTP code.',
            retryable: true,
            status: 503,
            headers: VERIFY_OTP_RATE_LIMIT_HEADERS,
            logLabel: 'AUTH_VERIFY_OTP_ROUTE_FAILED',
        });
    }
}
