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
import { logger } from '@/lib/logger';

const LoginSchema = z.object({
    email: z.string().email(),
    password: z.string().min(1),
});

export async function POST(request: Request) {
    const requestId = createRequestId(request);

    try {
        const body = await request.json();
        const parsed = LoginSchema.safeParse(body);

        if (!parsed.success) {
            return errorResponse({
                status: 400,
                code: 'VALIDATION_ERROR',
                message: 'Login payload is invalid.',
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

        const { data, error } = await supabase.auth.signInWithPassword(parsed.data);
        if (error || !data.user) {
            logger.warn('AUTH_LOGIN_FAILED', {
                requestId,
                route: '/api/auth/login',
                error: error instanceof Error ? error : undefined,
            });
            return errorResponse({
                status: 401,
                code: 'INVALID_CREDENTIALS',
                message: error?.message ?? 'Invalid email or password.',
                requestId,
                retryable: false,
                headers: getAuthRouteHeaders(),
            });
        }

        logger.info('AUTH_LOGIN_SUCCEEDED', {
            requestId,
            route: '/api/auth/login',
            userId: data.user.id,
            hasSession: Boolean(data.session),
        });
        return applyCookies(successResponse({ success: true }, requestId, {
            headers: getAuthRouteHeaders(),
        }));
    } catch (error) {
        return handleRouteError(error, {
            requestId,
            code: 'AUTH_LOGIN_FAILED',
            message: 'Unable to sign in.',
            retryable: true,
            status: 503,
            headers: getAuthRouteHeaders(),
            logLabel: 'AUTH_LOGIN_ROUTE_FAILED',
        });
    }
}
