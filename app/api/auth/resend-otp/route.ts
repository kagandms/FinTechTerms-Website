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

const ResendOtpSchema = z.object({
    email: z.string().email(),
});

export async function POST(request: Request) {
    const requestId = createRequestId(request);

    try {
        const body = await request.json();
        const parsed = ResendOtpSchema.safeParse(body);

        if (!parsed.success) {
            return errorResponse({
                status: 400,
                code: 'VALIDATION_ERROR',
                message: 'OTP resend payload is invalid.',
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

        const { error } = await supabase.auth.resend({
            type: 'signup',
            email: parsed.data.email,
        });

        if (error) {
            return errorResponse({
                status: 400,
                code: 'OTP_RESEND_FAILED',
                message: error.message,
                requestId,
                retryable: false,
                headers: getAuthRouteHeaders(),
            });
        }

        return applyCookies(successResponse({ success: true }, requestId, {
            headers: getAuthRouteHeaders(),
        }));
    } catch (error) {
        return handleRouteError(error, {
            requestId,
            code: 'OTP_RESEND_FAILED',
            message: 'Unable to resend the OTP code.',
            retryable: true,
            status: 503,
            headers: getAuthRouteHeaders(),
            logLabel: 'AUTH_RESEND_OTP_ROUTE_FAILED',
        });
    }
}
