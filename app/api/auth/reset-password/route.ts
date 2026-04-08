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
import { getPublicEnv } from '@/lib/env';

const ResetPasswordSchema = z.object({
    email: z.string().email(),
});

export async function POST(request: Request) {
    const requestId = createRequestId(request);

    try {
        const body = await request.json();
        const parsed = ResetPasswordSchema.safeParse(body);

        if (!parsed.success) {
            return errorResponse({
                status: 400,
                code: 'VALIDATION_ERROR',
                message: 'Reset-password payload is invalid.',
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

        const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
            redirectTo: `${getPublicEnv().siteUrl}/profile?reset=true`,
        });

        if (error) {
            return errorResponse({
                status: 400,
                code: 'RESET_PASSWORD_FAILED',
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
            code: 'RESET_PASSWORD_FAILED',
            message: 'Unable to send the password reset email.',
            retryable: true,
            status: 503,
            headers: getAuthRouteHeaders(),
            logLabel: 'AUTH_RESET_PASSWORD_ROUTE_FAILED',
        });
    }
}
