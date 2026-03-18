import { z } from 'zod';
import {
    createRequestId,
    errorResponse,
    getClientIp,
    handleRouteError,
    successResponse,
} from '@/lib/api-response';
import { completeIdempotentRequest, failIdempotentRequest, reserveIdempotentRequest } from '@/lib/api-idempotency';
import { apiRouteRateLimiter, favoritesMutationRateLimiter } from '@/lib/rate-limiter';
import {
    createRequestScopedClient,
    createServiceRoleClient,
    resolveAuthenticatedUser,
} from '@/lib/supabaseAdmin';
import { AUTH_REQUIRED_MESSAGE } from '@/lib/auth/session';

const FavoriteRequestSchema = z.object({
    termId: z.string().min(1, 'Term ID is required'),
    shouldFavorite: z.boolean(),
    idempotencyKey: z.string().uuid(),
});

const GLOBAL_RATE_LIMIT_HEADERS = {
    'X-RateLimit-Limit': '100',
    'X-RateLimit-Policy': '100;w=60, 10;w=10',
};

const WRITE_RATE_LIMIT = 10;

const markFavoriteFailure = async (
    supabaseAdmin: ReturnType<typeof createServiceRoleClient>,
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
        console.error('FAVORITES_IDEMPOTENCY_FAIL_ERROR', error);
    }
};

export async function POST(request: Request) {
    const requestId = createRequestId(request);
    const ip = getClientIp(request);
    let authenticatedUserId: string | null = null;
    const limitCheck = apiRouteRateLimiter.check(ip);
    const headers = {
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

    let body: unknown;

    try {
        body = await request.json();
    } catch (error) {
        console.error('POST_FAVORITES_INVALID_JSON', error);
        return errorResponse({
            status: 400,
            code: 'INVALID_JSON',
            message: 'Invalid JSON payload.',
            requestId,
            retryable: false,
            headers,
        });
    }

    const validatedData = FavoriteRequestSchema.safeParse(body);
    if (!validatedData.success) {
        console.error('POST_FAVORITES_VALIDATION_ERROR', validatedData.error.flatten());
        return errorResponse({
            status: 400,
            code: 'INVALID_TERM_ID',
            message: 'termId is required.',
            requestId,
            retryable: false,
            headers,
        });
    }

    const supabaseAdmin = createServiceRoleClient();
    const { termId, shouldFavorite, idempotencyKey } = validatedData.data;

    try {
        const user = await resolveAuthenticatedUser(request);
        if (!user) {
            return errorResponse({
                status: 401,
                code: 'UNAUTHORIZED',
                message: AUTH_REQUIRED_MESSAGE,
                requestId,
                retryable: false,
                headers,
            });
        }
        authenticatedUserId = user.id;

        const writeLimitCheck = favoritesMutationRateLimiter.check(`${user.id}:${ip}`);
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
            supabaseAdmin,
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

        const { data: termData, error: termError } = await supabaseAdmin
            .from('terms')
            .select('id')
            .eq('id', termId)
            .maybeSingle();

        if (termError) {
            console.error('POST_FAVORITES_TERM_LOOKUP_ERROR', termError);
            await markFavoriteFailure(supabaseAdmin, user.id, idempotencyKey, 500, {
                code: 'FAVORITES_UPDATE_FAILED',
                message: 'Unable to validate term.',
            });
            return errorResponse({
                status: 500,
                code: 'FAVORITES_UPDATE_FAILED',
                message: 'Unable to validate term.',
                requestId,
                retryable: true,
                headers: guardedHeaders,
            });
        }

        if (!termData) {
            await markFavoriteFailure(supabaseAdmin, user.id, idempotencyKey, 404, {
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

        if (shouldFavorite) {
            const { error: insertError } = await supabaseAdmin
                .from('user_favorites')
                .upsert({
                    user_id: user.id,
                    term_id: termId,
                    source: 'web',
                }, {
                    onConflict: 'user_id,term_id',
                    ignoreDuplicates: true,
                });

            if (insertError) {
                console.error('POST_FAVORITES_INSERT_ERROR', insertError);
                await markFavoriteFailure(supabaseAdmin, user.id, idempotencyKey, 500, {
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
        } else {
            const { error: deleteError } = await supabaseAdmin
                .from('user_favorites')
                .delete()
                .eq('user_id', user.id)
                .eq('term_id', termId);

            if (deleteError) {
                console.error('POST_FAVORITES_DELETE_ERROR', deleteError);
                await markFavoriteFailure(supabaseAdmin, user.id, idempotencyKey, 500, {
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
        }

        const favoritesResponse = await supabaseAdmin
            .from('user_favorites')
            .select('term_id')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false });

        if (favoritesResponse.error) {
            console.error('POST_FAVORITES_LIST_ERROR', favoritesResponse.error);
            await markFavoriteFailure(supabaseAdmin, user.id, idempotencyKey, 500, {
                code: 'FAVORITES_UPDATE_FAILED',
                message: 'Unable to load updated favorites.',
            });
            return errorResponse({
                status: 500,
                code: 'FAVORITES_UPDATE_FAILED',
                message: 'Unable to load updated favorites.',
                requestId,
                retryable: true,
                headers: guardedHeaders,
            });
        }

        const favorites = (favoritesResponse.data || []).map((row) => row.term_id);
        const responseBody = {
            success: true,
            isFavorite: favorites.includes(termId),
            termId,
            favorites,
        };

        try {
            await completeIdempotentRequest({
                supabaseAdmin,
                userId: user.id,
                action: 'favorite_mutation',
                idempotencyKey,
                statusCode: 200,
                responseBody,
            });
        } catch (error) {
            console.error('FAVORITES_IDEMPOTENCY_COMPLETE_ERROR', error);
        }

        return successResponse(
            responseBody,
            requestId,
            { headers: guardedHeaders }
        );
    } catch (error) {
        if (authenticatedUserId) {
            await markFavoriteFailure(supabaseAdmin, authenticatedUserId, idempotencyKey, 500, {
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
            console.error('GET_FAVORITES_FAILED', response.error);
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
