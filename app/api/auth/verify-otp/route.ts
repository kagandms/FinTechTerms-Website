import { z } from 'zod';
import {
    createRequestId,
    errorResponse,
    handleRouteError,
    successResponse,
} from '@/lib/api-response';
import {
    createAuthRouteClient,
    createAuthUnavailableResponse,
    getAuthRouteHeaders,
} from '@/lib/auth/route-handler';

const VerifyOtpSchema = z.object({
    email: z.string().email(),
    token: z.string().regex(/^\d{6}$/),
    password: z.string().min(1).optional(),
});

export async function POST(request: Request) {
    const requestId = createRequestId(request);

    try {
        const body = await request.json();
        const parsed = VerifyOtpSchema.safeParse(body);

        if (!parsed.success) {
            return errorResponse({
                status: 400,
                code: 'VALIDATION_ERROR',
                message: 'OTP verification payload is invalid.',
                requestId,
                retryable: false,
                headers: getAuthRouteHeaders(),
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
            return errorResponse({
                status: 400,
                code: 'OTP_VERIFICATION_FAILED',
                message: error.message,
                requestId,
                retryable: false,
                headers: getAuthRouteHeaders(),
            });
        }

        if (!data.user) {
            return errorResponse({
                status: 409,
                code: 'OTP_VERIFICATION_FAILED',
                message: 'Verification failed.',
                requestId,
                retryable: false,
                headers: getAuthRouteHeaders(),
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
                    headers: getAuthRouteHeaders(),
                });
            }
        }

        return applyCookies(successResponse({ success: true }, requestId, {
            headers: getAuthRouteHeaders(),
        }));
    } catch (error) {
        return handleRouteError(error, {
            requestId,
            code: 'OTP_VERIFICATION_FAILED',
            message: 'Unable to verify the OTP code.',
            retryable: true,
            status: 503,
            headers: getAuthRouteHeaders(),
            logLabel: 'AUTH_VERIFY_OTP_ROUTE_FAILED',
        });
    }
}
