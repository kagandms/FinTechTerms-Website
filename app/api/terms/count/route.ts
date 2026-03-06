import { createClient } from '@/utils/supabase/server';
import {
    createRequestId,
    errorResponse,
    handleRouteError,
    successResponse,
} from '@/lib/api-response';

export async function GET(request: Request) {
    const requestId = createRequestId(request);

    try {
        const supabase = await createClient();
        const { count, error } = await supabase
            .from('terms')
            .select('*', { count: 'exact', head: true });

        if (error) {
            console.error('TERMS_COUNT_FETCH_ERROR', error);
            return errorResponse({
                status: 500,
                code: 'TERMS_COUNT_FETCH_FAILED',
                message: 'Unable to fetch term count.',
                requestId,
                retryable: true,
            });
        }

        return successResponse({ count: count || 0 }, requestId);
    } catch (error) {
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
