import { z } from 'zod';
import {
    createRequestId,
    errorResponse,
    getClientIp,
    handleRouteError,
    successResponse,
} from '@/lib/api-response';
import {
    completeIdempotentRequest,
    deleteIdempotentRequest,
    failIdempotentRequest,
    inspectIdempotentRequest,
    reserveIdempotentRequest,
} from '@/lib/api-idempotency';
import {
    apiRouteRateLimiter,
    favoritesMutationRateLimiter,
    isRateLimiterUnavailable,
} from '@/lib/rate-limiter';
import {
    createRequestScopedClient,
    createServiceRoleClient,
    resolveAuthenticatedUser,
} from '@/lib/supabaseAdmin';
import { AUTH_REQUIRED_MESSAGE } from '@/lib/auth/session';
import { logger } from '@/lib/logger';
import { resolveRequestMemberEntitlements } from '@/lib/server-member-entitlements';

const FavoriteRequestSchema = z.object({
    termId: z.string().min(1, 'Term ID is required'),
    shouldFavorite: z.boolean(),
    idempotencyKey: z.string().uuid(),
});

const FavoriteMutationResponseSchema = z.object({
    success: z.literal(true),
    isFavorite: z.boolean(),
    termId: z.string().min(1),
    favorites: z.array(z.string().min(1)),
});

const GLOBAL_RATE_LIMIT_HEADERS = {
    'X-RateLimit-Limit': '100',
    'X-RateLimit-Policy': '100;w=60, 10;w=10',
};

const WRITE_RATE_LIMIT = 10;
const RATE_LIMITER_UNAVAILABLE_MESSAGE = 'Rate limiting is temporarily unavailable. Verify preview/staging runtime env includes UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN.';
const FAVORITES_LIMIT_REACHED_MESSAGE = 'Favorite limit reached. Complete your member setup to save more terms.';
type FavoriteIdempotencyClient = ReturnType<typeof createServiceRoleClient>;

const markFavoriteFailure = async (
    supabaseAdmin: FavoriteIdempotencyClient,
    userId: string,
    idempotencyKey: string | null,
    statusCode: number,
    responseBody: unknown
) => {
    if (!idempotencyKey) {
        return;
    }

    try {
        await failIdempotentRequest({
            supabaseAdmin,
            userId,
            action: 'favorite_mutation',
            idempotencyKey,
            statusCode,
            responseBody,
        });
    } catch (error) {
        logger.error('FAVORITES_IDEMPOTENCY_FAIL_ERROR', {
            route: 'POST /api/favorites',
            error: error instanceof Error ? error : undefined,
            userId,
        });
    }
};

export async function POST(request: Request) {
    const requestId = createRequestId(request);
    const ip = getClientIp(request);
    let authenticatedUserId: string | null = null;
    let headers: HeadersInit = GLOBAL_RATE_LIMIT_HEADERS;
    let idempotencyClient: FavoriteIdempotencyClient | null = null;

    let body: unknown;

    try {
        body = await request.json();
    } catch (error) {
        logger.warn('POST_FAVORITES_INVALID_JSON', {
            route: 'POST /api/favorites',
            error: error instanceof Error ? error : undefined,
        });
        return errorResponse({
            status: 400,
            code: 'INVALID_JSON',
            message: 'Invalid JSON payload.',
            requestId,
            retryable: false,
            headers: GLOBAL_RATE_LIMIT_HEADERS,
        });
    }

    const validatedData = FavoriteRequestSchema.safeParse(body);
    if (!validatedData.success) {
        logger.warn('POST_FAVORITES_VALIDATION_ERROR', {
            route: 'POST /api/favorites',
            validation: validatedData.error.flatten(),
        });
        return errorResponse({
            status: 400,
            code: 'INVALID_TERM_ID',
            message: 'termId is required.',
            requestId,
            retryable: false,
            headers: GLOBAL_RATE_LIMIT_HEADERS,
        });
    }

    try {
        const memberState = await resolveRequestMemberEntitlements(request);
        if (memberState.unavailable) {
            return errorResponse({
                status: memberState.unavailable.status,
                code: memberState.unavailable.code,
                message: memberState.unavailable.message,
                requestId,
                retryable: true,
                headers: GLOBAL_RATE_LIMIT_HEADERS,
            });
        }

        const user = memberState.user;
        if (!user) {
            return errorResponse({
                status: 401,
                code: 'UNAUTHORIZED',
                message: AUTH_REQUIRED_MESSAGE,
                requestId,
                retryable: false,
                headers: GLOBAL_RATE_LIMIT_HEADERS,
            });
        }
        authenticatedUserId = user.id;
        try {
            idempotencyClient = createServiceRoleClient({
                route: 'POST /api/favorites',
            });
        } catch (error) {
            logger.error('POST_FAVORITES_SERVICE_ROLE_CLIENT_UNAVAILABLE', {
                route: 'POST /api/favorites',
                error: error instanceof Error ? error : undefined,
                userId: user.id,
            });
            return errorResponse({
                status: 503,
                code: 'FAVORITES_UPDATE_FAILED',
                message: 'Unable to update favorites.',
                requestId,
                retryable: true,
                headers: GLOBAL_RATE_LIMIT_HEADERS,
            });
        }
        const supabaseClient = idempotencyClient;

        const { termId, shouldFavorite, idempotencyKey } = validatedData.data;

        const inspection = await inspectIdempotentRequest({
            supabaseAdmin: supabaseClient,
            userId: user.id,
            action: 'favorite_mutation',
            idempotencyKey,
            payload: {
                termId,
                shouldFavorite,
            },
        });

        if (inspection.kind === 'replay') {
            return successResponse(
                inspection.responseBody,
                requestId,
                {
                    status: inspection.statusCode,
                    headers: GLOBAL_RATE_LIMIT_HEADERS,
                }
            );
        }

        if (inspection.kind === 'conflict') {
            return errorResponse({
                status: 409,
                code: inspection.code,
                message: inspection.message,
                requestId,
                retryable: inspection.code === 'REQUEST_IN_PROGRESS',
                headers: GLOBAL_RATE_LIMIT_HEADERS,
            });
        }

        const limitCheck = await apiRouteRateLimiter.check(`favorites:${ip}`);

        if (isRateLimiterUnavailable(limitCheck)) {
            return errorResponse({
                status: 503,
                code: 'RATE_LIMITER_UNAVAILABLE',
                message: RATE_LIMITER_UNAVAILABLE_MESSAGE,
                requestId,
                retryable: true,
                headers: GLOBAL_RATE_LIMIT_HEADERS,
            });
        }

        headers = {
            ...GLOBAL_RATE_LIMIT_HEADERS,
            'X-RateLimit-Remaining': limitCheck.remaining.toString(),
        };

        if (!limitCheck.allowed) {
            return errorResponse({
                status: 429,
                code: 'RATE_LIMITED',
                message: 'Rate limit exceeded.',
                requestId,
                retryable: true,
                headers: {
                    ...headers,
                    'Retry-After': limitCheck.retryAfter.toString(),
                },
            });
        }

        const writeLimitCheck = await favoritesMutationRateLimiter.check(user.id);

        if (isRateLimiterUnavailable(writeLimitCheck)) {
            return errorResponse({
                status: 503,
                code: 'RATE_LIMITER_UNAVAILABLE',
                message: RATE_LIMITER_UNAVAILABLE_MESSAGE,
                requestId,
                retryable: true,
                headers,
            });
        }

        const guardedHeaders = {
            ...headers,
            'X-Write-RateLimit-Limit': WRITE_RATE_LIMIT.toString(),
            'X-Write-RateLimit-Remaining': writeLimitCheck.remaining.toString(),
        };

        if (!writeLimitCheck.allowed) {
            return errorResponse({
                status: 429,
                code: 'FAVORITES_RATE_LIMITED',
                message: 'Too many favorite updates. Please slow down.',
                requestId,
                retryable: true,
                headers: {
                    ...guardedHeaders,
                    'Retry-After': writeLimitCheck.retryAfter.toString(),
                },
            });
        }

        const reservation = await reserveIdempotentRequest({
            supabaseAdmin: supabaseClient,
            userId: user.id,
            action: 'favorite_mutation',
            idempotencyKey,
            payload: {
                termId,
                shouldFavorite,
            },
        });

        if (reservation.kind === 'replay') {
            return successResponse(
                reservation.responseBody,
                requestId,
                {
                    status: reservation.statusCode,
                    headers: guardedHeaders,
                }
            );
        }

        if (reservation.kind === 'conflict') {
            return errorResponse({
                status: 409,
                code: reservation.code,
                message: reservation.message,
                requestId,
                retryable: reservation.code === 'REQUEST_IN_PROGRESS',
                headers: guardedHeaders,
            });
        }

        const mutationSupabase = await createRequestScopedClient(request);
        if (!mutationSupabase) {
            await markFavoriteFailure(supabaseClient, user.id, idempotencyKey, 503, {
                code: 'FAVORITES_UPDATE_FAILED',
                message: 'Unable to update favorites.',
            });
            return errorResponse({
                status: 503,
                code: 'FAVORITES_UPDATE_FAILED',
                message: 'Unable to update favorites.',
                requestId,
                retryable: true,
                headers: guardedHeaders,
            });
        }

        const { data: mutationData, error: mutationError } = await mutationSupabase.rpc(
            'toggle_my_favorite',
            {
                p_term_id: termId,
                p_should_favorite: shouldFavorite,
            }
        );

        if (mutationError) {
            logger.error('POST_FAVORITES_RPC_ERROR', {
                route: 'POST /api/favorites',
                error: mutationError,
                userId: user.id,
                termId,
            });

            const isMissingTermError = mutationError.code === 'P0002'
                || (mutationError.message || '').toLowerCase().includes('term not found');

            if (isMissingTermError) {
                await markFavoriteFailure(supabaseClient, user.id, idempotencyKey, 404, {
                    code: 'TERM_NOT_FOUND',
                    message: 'Term not found.',
                });
                return errorResponse({
                    status: 404,
                    code: 'TERM_NOT_FOUND',
                    message: 'Term not found.',
                    requestId,
                    retryable: false,
                    headers: guardedHeaders,
                });
            }

            const isFavoriteLimitError = mutationError.code === '23514'
                || (mutationError.message || '').toLowerCase().includes('favorite limit');

            if (isFavoriteLimitError) {
                await markFavoriteFailure(supabaseClient, user.id, idempotencyKey, 409, {
                    code: 'FAVORITES_LIMIT_REACHED',
                    message: FAVORITES_LIMIT_REACHED_MESSAGE,
                });
                return errorResponse({
                    status: 409,
                    code: 'FAVORITES_LIMIT_REACHED',
                    message: FAVORITES_LIMIT_REACHED_MESSAGE,
                    requestId,
                    retryable: false,
                    headers: guardedHeaders,
                });
            }

            await markFavoriteFailure(supabaseClient, user.id, idempotencyKey, 500, {
                code: 'FAVORITES_UPDATE_FAILED',
                message: 'Unable to update favorites.',
            });
            return errorResponse({
                status: 500,
                code: 'FAVORITES_UPDATE_FAILED',
                message: 'Unable to update favorites.',
                requestId,
                retryable: true,
                headers: guardedHeaders,
            });
        }

        const responseBody = FavoriteMutationResponseSchema.parse(mutationData);

        try {
            await completeIdempotentRequest({
                supabaseAdmin: supabaseClient,
                userId: user.id,
                action: 'favorite_mutation',
                idempotencyKey,
                statusCode: 200,
                responseBody,
            });
        } catch (error) {
            logger.error('FAVORITES_IDEMPOTENCY_COMPLETE_ERROR', {
                route: 'POST /api/favorites',
                error: error instanceof Error ? error : undefined,
                userId: user.id,
            });
            try {
                await deleteIdempotentRequest({
                    supabaseAdmin: supabaseClient,
                    userId: user.id,
                    action: 'favorite_mutation',
                    idempotencyKey,
                });
            } catch (cleanupError) {
                logger.error('FAVORITES_IDEMPOTENCY_DELETE_ERROR', {
                    route: 'POST /api/favorites',
                    error: cleanupError instanceof Error ? cleanupError : undefined,
                    userId: user.id,
                });
            }
        }

        return successResponse(
            responseBody,
            requestId,
            { headers: guardedHeaders }
        );
    } catch (error) {
        if (authenticatedUserId && idempotencyClient) {
            const { idempotencyKey } = validatedData.data;
            await markFavoriteFailure(idempotencyClient, authenticatedUserId, idempotencyKey, 500, {
                code: 'FAVORITES_UPDATE_FAILED',
                message: 'Unable to update favorites.',
            });
        }

        return handleRouteError(error, {
            requestId,
            code: 'FAVORITES_UPDATE_FAILED',
            message: 'Unable to update favorites.',
            timeoutCode: 'FAVORITES_TIMEOUT',
            timeoutMessage: 'Favorite update request timed out.',
            headers,
            logLabel: 'POST_FAVORITES_FAILED',
        });
    }
}

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
            });
        }

        const supabase = await createRequestScopedClient(request);
        if (!supabase) {
            return errorResponse({
                status: 503,
                code: 'FAVORITES_LOAD_FAILED',
                message: 'Unable to load favorites.',
                requestId,
                retryable: false,
            });
        }

        const response = await supabase
            .from('user_favorites')
            .select('term_id')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false });

        if (response.error) {
            logger.error('GET_FAVORITES_FAILED', {
                route: 'GET /api/favorites',
                error: response.error,
                userId: user.id,
            });
            return errorResponse({
                status: 500,
                code: 'FAVORITES_LOAD_FAILED',
                message: 'Unable to load favorites.',
                requestId,
                retryable: true,
            });
        }

        return successResponse(
            {
                favorites: (response.data || []).map((row) => row.term_id),
            },
            requestId
        );
    } catch (error) {
        return handleRouteError(error, {
            requestId,
            code: 'FAVORITES_LOAD_FAILED',
            message: 'Unable to load favorites.',
            timeoutCode: 'FAVORITES_TIMEOUT',
            timeoutMessage: 'Favorites request timed out.',
            logLabel: 'GET_FAVORITES_FAILED',
        });
    }
}
