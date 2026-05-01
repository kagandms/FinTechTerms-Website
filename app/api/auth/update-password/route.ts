import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { z } from 'zod';
import {
    createRequestId,
    errorResponse,
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
    getExpiredPasswordRecoveryCookieOptions,
    PASSWORD_RECOVERY_COOKIE_NAME,
} from '@/lib/auth/password-recovery-cookie';
import { getPublicEnv } from '@/lib/public-env';
import { supportsPasswordSignIn } from '@/lib/auth/user';
import { authUpdatePasswordRateLimiter, isRateLimiterUnavailable } from '@/lib/rate-limiter';

const UpdatePasswordSchema = z.object({
    password: z.string().min(8),
    currentPassword: z.string().min(1).optional(),
});

const UPDATE_PASSWORD_HEADERS = {
    ...getAuthRouteHeaders(),
    'X-RateLimit-Limit': '5',
    'X-RateLimit-Policy': '5;w=600',
};

export async function POST(request: Request) {
    const requestId = createRequestId(request);
    const originResponse = enforceSameOriginRoute(request, {
        requestId,
        headers: UPDATE_PASSWORD_HEADERS,
    });

    if (originResponse) {
        return originResponse;
    }

    try {
        const jsonResult = await readJsonRequest<unknown>(request, {
            requestId,
            message: 'Invalid JSON payload.',
            headers: UPDATE_PASSWORD_HEADERS,
        });
        if (!isJsonRequestValid(jsonResult)) {
            return jsonResult.response;
        }

        const parsed = UpdatePasswordSchema.safeParse(jsonResult.data);
        if (!parsed.success) {
            return errorResponse({
                status: 400,
                code: 'VALIDATION_ERROR',
                message: 'Update-password payload is invalid.',
                requestId,
                retryable: false,
                headers: UPDATE_PASSWORD_HEADERS,
            });
        }

        const authContext = await createAuthRouteClient();
        if (!authContext) {
            return createAuthUnavailableResponse(requestId);
        }

        const { supabase, applyCookies } = authContext;
        const { data: userState, error: userError } = await supabase.auth.getUser();
        if (userError || !userState.user) {
            return errorResponse({
                status: 401,
                code: 'UNAUTHORIZED',
                message: 'Authentication required',
                requestId,
                retryable: false,
                headers: UPDATE_PASSWORD_HEADERS,
            });
        }

        if (!supportsPasswordSignIn(userState.user)) {
            return errorResponse({
                status: 409,
                code: 'PASSWORD_MANAGED_BY_PROVIDER',
                message: 'This account does not use a Supabase email-password credential.',
                requestId,
                retryable: false,
                headers: UPDATE_PASSWORD_HEADERS,
            });
        }

        const limitCheck = await authUpdatePasswordRateLimiter.check(userState.user.id);
        if (isRateLimiterUnavailable(limitCheck) || !limitCheck.allowed) {
            return createAuthRateLimitError(limitCheck, {
                requestId,
                headers: UPDATE_PASSWORD_HEADERS,
                code: isRateLimiterUnavailable(limitCheck)
                    ? 'RATE_LIMITER_UNAVAILABLE'
                    : 'RATE_LIMITED',
                message: isRateLimiterUnavailable(limitCheck)
                    ? 'Authentication is temporarily unavailable.'
                    : 'RATE_LIMITED',
            });
        }

        const cookieStore = await cookies();
        const isRecoverySession = cookieStore.get(PASSWORD_RECOVERY_COOKIE_NAME)?.value === '1';
        const currentPassword = parsed.data.currentPassword;

        if (!isRecoverySession) {
            if (!currentPassword) {
                return errorResponse({
                    status: 400,
                    code: 'CURRENT_PASSWORD_REQUIRED',
                    message: 'Current password is required.',
                    requestId,
                    retryable: false,
                    headers: UPDATE_PASSWORD_HEADERS,
                });
            }

            const env = getPublicEnv();
            const verificationClient = createSupabaseClient(
                env.supabaseUrl!,
                env.supabaseAnonKey!,
                {
                    auth: {
                        persistSession: false,
                        autoRefreshToken: false,
                        detectSessionInUrl: false,
                    },
                }
            );
            const { error: signInError } = await verificationClient.auth.signInWithPassword({
                email: userState.user.email ?? '',
                password: currentPassword,
            });

            if (signInError) {
                return errorResponse({
                    status: 400,
                    code: 'CURRENT_PASSWORD_INVALID',
                    message: 'Current password incorrect',
                    requestId,
                    retryable: false,
                    headers: UPDATE_PASSWORD_HEADERS,
                });
            }
        }

        const { error } = await supabase.auth.updateUser({
            password: parsed.data.password,
        });

        if (error) {
            return errorResponse({
                status: 400,
                code: 'UPDATE_PASSWORD_FAILED',
                message: 'Unable to update the password.',
                requestId,
                retryable: false,
                headers: UPDATE_PASSWORD_HEADERS,
            });
        }

        const response = successResponse({ success: true }, requestId, {
            headers: UPDATE_PASSWORD_HEADERS,
        });
        if (isRecoverySession) {
            response.cookies.set(
                PASSWORD_RECOVERY_COOKIE_NAME,
                '',
                getExpiredPasswordRecoveryCookieOptions()
            );
        }

        return applyCookies(response);
    } catch (error) {
        return handleRouteError(error, {
            requestId,
            code: 'UPDATE_PASSWORD_FAILED',
            message: 'Unable to update the password.',
            retryable: true,
            status: 503,
            headers: UPDATE_PASSWORD_HEADERS,
            logLabel: 'AUTH_UPDATE_PASSWORD_ROUTE_FAILED',
        });
    }
}
