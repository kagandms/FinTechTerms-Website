import {
    createRequestId,
    handleRouteError,
    successResponse,
} from '@/lib/api-response';
import { buildAuthSessionState } from '@/lib/auth/session-state';
import { getAuthRouteHeaders } from '@/lib/auth/route-handler';

export async function GET(request: Request) {
    const requestId = createRequestId(request);

    try {
        const payload = await buildAuthSessionState(request);
        return successResponse(payload, requestId, {
            headers: getAuthRouteHeaders(),
        });
    } catch (error) {
        return handleRouteError(error, {
            requestId,
            code: 'AUTH_SESSION_FAILED',
            message: 'Unable to load the current session.',
            retryable: true,
            status: 503,
            headers: getAuthRouteHeaders(),
            logLabel: 'AUTH_SESSION_ROUTE_FAILED',
        });
    }
}
