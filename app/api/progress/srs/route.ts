import { z } from 'zod';
import {
    createRequestId,
    errorResponse,
    handleRouteError,
    readJsonRequest,
    successResponse,
} from '@/lib/api-response';
import { AUTH_REQUIRED_MESSAGE } from '@/lib/auth/session';
import { createRequestScopedClient, resolveAuthenticatedUser } from '@/lib/supabaseAdmin';

const ProgressSrsRequestSchema = z.object({
    termIds: z.array(z.string().min(1)).max(500).optional(),
    unbounded: z.boolean().optional(),
});

const PROGRESS_SRS_HEADERS = {
    'Cache-Control': 'no-store',
};

const USER_TERM_SRS_QUERY_COLUMNS = [
    'term_id',
    'srs_level',
    'next_review_date',
    'last_reviewed',
    'difficulty_score',
    'retention_rate',
    'times_reviewed',
    'times_correct',
].join(', ');

export async function POST(request: Request) {
    const requestId = createRequestId(request);

    try {
        const requestBody = await readJsonRequest<unknown>(request, {
            requestId,
            message: 'SRS progress request body must be valid JSON.',
            headers: PROGRESS_SRS_HEADERS,
        });

        if (!requestBody.ok) {
            return requestBody.response;
        }

        const body = requestBody.data;
        const parsed = ProgressSrsRequestSchema.safeParse(body);

        if (!parsed.success) {
            return errorResponse({
                status: 400,
                code: 'VALIDATION_ERROR',
                message: 'SRS progress payload is invalid.',
                requestId,
                retryable: false,
                headers: PROGRESS_SRS_HEADERS,
            });
        }

        const user = await resolveAuthenticatedUser(request);
        if (!user) {
            return errorResponse({
                status: 401,
                code: 'UNAUTHORIZED',
                message: AUTH_REQUIRED_MESSAGE,
                requestId,
                retryable: false,
                headers: PROGRESS_SRS_HEADERS,
            });
        }

        const supabase = await createRequestScopedClient(request);
        if (!supabase) {
            return errorResponse({
                status: 503,
                code: 'SRS_PROGRESS_UNAVAILABLE',
                message: 'Unable to load SRS progress.',
                requestId,
                retryable: true,
                headers: PROGRESS_SRS_HEADERS,
            });
        }

        const termIds = Array.from(new Set(parsed.data.termIds ?? []));
        if (!parsed.data.unbounded && termIds.length === 0) {
            return successResponse({
                status: 'ok',
                data: [],
            }, requestId, {
                headers: PROGRESS_SRS_HEADERS,
            });
        }

        let query = supabase
            .from('user_term_srs')
            .select(USER_TERM_SRS_QUERY_COLUMNS)
            .eq('user_id', user.id);

        if (!parsed.data.unbounded) {
            query = query.in('term_id', termIds);
        }

        const { data, error } = await query;

        if (error) {
            return successResponse({
                status: 'error',
                message: error.message,
            }, requestId, {
                headers: PROGRESS_SRS_HEADERS,
            });
        }

        return successResponse({
            status: 'ok',
            data: data ?? [],
        }, requestId, {
            headers: PROGRESS_SRS_HEADERS,
        });
    } catch (error) {
        return handleRouteError(error, {
            requestId,
            code: 'SRS_PROGRESS_UNAVAILABLE',
            message: 'Unable to load SRS progress.',
            retryable: true,
            status: 503,
            headers: PROGRESS_SRS_HEADERS,
            logLabel: 'PROGRESS_SRS_ROUTE_FAILED',
        });
    }
}
