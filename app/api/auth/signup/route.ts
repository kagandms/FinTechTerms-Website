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
import { isAcceptedBirthDate } from '@/lib/profile-birth-date';
import { authSignupRateLimiter, isRateLimiterUnavailable } from '@/lib/rate-limiter';

const SignupSchema = z.object({
    email: z.string().email(),
    password: z.string().min(8),
    name: z.string().trim().min(2),
    birthDate: z.string().trim().optional(),
}).superRefine((value, context) => {
    if (value.birthDate === undefined) {
        return;
    }

    if (isAcceptedBirthDate(value.birthDate)) {
        return;
    }

    context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Birth date must be a valid calendar date for a user aged 13 to 120.',
        path: ['birthDate'],
    });
});

const SIGNUP_RATE_LIMIT_HEADERS = {
    ...getAuthRouteHeaders(),
    'X-RateLimit-Limit': '5',
    'X-RateLimit-Policy': '5;w=600',
};

export async function POST(request: Request) {
    const requestId = createRequestId(request);
    const originResponse = enforceSameOriginRoute(request, {
        requestId,
        headers: SIGNUP_RATE_LIMIT_HEADERS,
    });

    if (originResponse) {
        return originResponse;
    }

    try {
        const jsonResult = await readJsonRequest<unknown>(request, {
            requestId,
            message: 'Invalid JSON payload.',
            headers: SIGNUP_RATE_LIMIT_HEADERS,
        });
        if (!isJsonRequestValid(jsonResult)) {
            return jsonResult.response;
        }

        const body = jsonResult.data;
        const parsed = SignupSchema.safeParse(body);

        if (!parsed.success) {
            return errorResponse({
                status: 400,
                code: 'VALIDATION_ERROR',
                message: 'Sign-up payload is invalid.',
                requestId,
                retryable: false,
                headers: SIGNUP_RATE_LIMIT_HEADERS,
            });
        }

        const ip = getClientIp(request);
        const emailKey = parsed.data.email.trim().toLowerCase();
        const limitCheck = await authSignupRateLimiter.check(`${ip}:${emailKey}`);
        if (isRateLimiterUnavailable(limitCheck) || !limitCheck.allowed) {
            return createAuthRateLimitError(limitCheck, {
                requestId,
                headers: SIGNUP_RATE_LIMIT_HEADERS,
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

        const { data, error } = await supabase.auth.signUp({
            email: parsed.data.email,
            password: parsed.data.password,
            options: {
                data: {
                    name: parsed.data.name,
                    birth_date: parsed.data.birthDate,
                },
                emailRedirectTo: undefined,
            },
        });

        if (error) {
            const safeCode = getSafeAuthErrorCode(error.message);
            console.error('[SIGNUP_DEBUG] Supabase signUp error:', error.message, '→ safeCode:', safeCode);
            if (safeCode === 'RATE_LIMITED') {
                return createAuthRateLimitError({
                    allowed: false,
                    remaining: 0,
                    retryAfter: 60,
                    unavailable: false,
                }, {
                    requestId,
                    headers: SIGNUP_RATE_LIMIT_HEADERS,
                    code: 'RATE_LIMITED',
                    message: 'RATE_LIMITED',
                });
            }

            return errorResponse({
                status: 400,
                code: safeCode,
                message: safeCode,
                requestId,
                retryable: false,
                headers: SIGNUP_RATE_LIMIT_HEADERS,
            });
        }

        // Prevent silent failure due to Supabase's obfuscated user enumeration prevention
        if (data.user && data.user.identities && data.user.identities.length === 0) {
            return errorResponse({
                status: 409,
                code: 'EMAIL_ALREADY_REGISTERED',
                message: 'EMAIL_ALREADY_REGISTERED',
                requestId,
                retryable: false,
                headers: SIGNUP_RATE_LIMIT_HEADERS,
            });
        }

        return applyCookies(successResponse({
            success: true,
            needsOTPVerification: Boolean(data.user && !data.session),
        }, requestId, {
            headers: SIGNUP_RATE_LIMIT_HEADERS,
        }));
    } catch (error) {
        return handleRouteError(error, {
            requestId,
            code: 'AUTH_SIGNUP_FAILED',
            message: 'Unable to create the account.',
            retryable: true,
            status: 503,
            headers: SIGNUP_RATE_LIMIT_HEADERS,
            logLabel: 'AUTH_SIGNUP_ROUTE_FAILED',
        });
    }
}
