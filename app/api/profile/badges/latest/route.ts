import {
    createRequestId,
    errorResponse,
    handleRouteError,
    successResponse,
} from '@/lib/api-response';
import { AUTH_REQUIRED_MESSAGE } from '@/lib/auth/session';
import { createRequestScopedClient, resolveAuthenticatedUser } from '@/lib/supabaseAdmin';

const BADGE_POLL_HEADERS = {
    'Cache-Control': 'no-store',
};

export async function GET(request: Request) {
    const requestId = createRequestId(request);

    try {
        const user = await resolveAuthenticatedUser(request);
        if (!user) {
            return errorResponse({
                status: 401,
                code: 'UNAUTHORIZED',
                message: AUTH_REQUIRED_MESSAGE,
                requestId,
                retryable: false,
                headers: BADGE_POLL_HEADERS,
            });
        }

        const supabase = await createRequestScopedClient(request);
        if (!supabase) {
            return errorResponse({
                status: 503,
                code: 'BADGE_FEED_UNAVAILABLE',
                message: 'Unable to load badge notifications.',
                requestId,
                retryable: true,
                headers: BADGE_POLL_HEADERS,
            });
        }

        const { data, error } = await supabase
            .from('user_badges')
            .select('id, badge_key, streak_days, unlocked_at')
            .eq('user_id', user.id)
            .order('unlocked_at', { ascending: false })
            .limit(10);

        if (error) {
            return errorResponse({
                status: 500,
                code: 'BADGE_FEED_UNAVAILABLE',
                message: 'Unable to load badge notifications.',
                requestId,
                retryable: true,
                headers: BADGE_POLL_HEADERS,
            });
        }

        return successResponse({
            badges: data ?? [],
        }, requestId, {
            headers: BADGE_POLL_HEADERS,
        });
    } catch (error) {
        return handleRouteError(error, {
            requestId,
            code: 'BADGE_FEED_UNAVAILABLE',
            message: 'Unable to load badge notifications.',
            retryable: true,
            status: 503,
            headers: BADGE_POLL_HEADERS,
            logLabel: 'BADGE_FEED_ROUTE_FAILED',
        });
    }
}
