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

const RecoveryExchangeSchema = z.object({
    accessToken: z.string().min(1),
    refreshToken: z.string().min(1),
});

export async function POST(request: Request) {
    const requestId = createRequestId(request);

    try {
        const body = await request.json();
        const parsed = RecoveryExchangeSchema.safeParse(body);

        if (!parsed.success) {
            return errorResponse({
                status: 400,
                code: 'VALIDATION_ERROR',
                message: 'Recovery exchange payload is invalid.',
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

        const { error } = await supabase.auth.setSession({
            access_token: parsed.data.accessToken,
            refresh_token: parsed.data.refreshToken,
        });

        if (error) {
            return errorResponse({
                status: 400,
                code: 'RECOVERY_EXCHANGE_FAILED',
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
            code: 'RECOVERY_EXCHANGE_FAILED',
            message: 'Unable to establish the recovery session.',
            retryable: true,
            status: 503,
            headers: getAuthRouteHeaders(),
            logLabel: 'AUTH_RECOVERY_EXCHANGE_ROUTE_FAILED',
        });
    }
}
