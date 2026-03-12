import {
    createRequestId,
    errorResponse,
    handleRouteError,
    successResponse,
} from '@/lib/api-response';
import { getPublicTermCount } from '@/lib/public-term-catalog';
import { logger } from '@/lib/logger';

export async function GET(request: Request) {
    const requestId = createRequestId(request);

    try {
        return successResponse({ count: await getPublicTermCount() }, requestId);
    } catch (error) {
        logger.error('TERMS_COUNT_ROUTE_FAILED', {
            requestId,
            route: '/api/terms/count',
            error: error instanceof Error ? error : undefined,
            retryable: true,
        });
        return handleRouteError(error, {
            requestId,
            code: 'TERMS_COUNT_FETCH_FAILED',
            message: 'Unable to fetch term count.',
            timeoutCode: 'TERMS_COUNT_TIMEOUT',
            timeoutMessage: 'Term count request timed out.',
            logLabel: 'TERMS_COUNT_ROUTE_FAILED',
        });
    }
}
