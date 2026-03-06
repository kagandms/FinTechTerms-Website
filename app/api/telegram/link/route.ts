import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import {
    createRequestId,
    createTimeoutFetch,
    errorResponse,
    getClientIp,
    getDeviceFingerprint,
    handleRouteError,
    successResponse,
} from '@/lib/api-response';
import { completeIdempotentRequest, failIdempotentRequest, reserveIdempotentRequest } from '@/lib/api-idempotency';
import { telegramLinkRateLimiter } from '@/lib/rate-limiter';
import { AUTH_REQUIRED_MESSAGE } from '@/lib/auth/session';
import { resolveAuthenticatedUser } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

const LinkTokenSchema = z.object({
    token: z.string().length(6).regex(/^\d+$/, 'Token must be a 6-digit number'),
    idempotencyKey: z.string().uuid(),
});

const TELEGRAM_LINK_LIMIT = 5;

const createRouteSupabaseClient = (
    apiKey: string,
    bearerToken?: string
) => createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    apiKey,
    {
        global: {
            fetch: createTimeoutFetch(),
            headers: bearerToken ? { Authorization: `Bearer ${bearerToken}` } : undefined,
        },
    }
);

const isInvalidLinkTokenError = (message: string): boolean => {
    const normalized = message.toLowerCase();
    return normalized.includes('geçersiz veya süresi dolmuş token')
        || normalized.includes('invalid token')
        || normalized.includes('expired');
};

const createAdminClient = () => createRouteSupabaseClient(
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const markTelegramFailure = async (
    supabaseAdmin: ReturnType<typeof createAdminClient>,
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
            action: 'telegram_link',
            idempotencyKey,
            statusCode,
            responseBody,
        });
    } catch (error) {
        console.error('TELEGRAM_LINK_IDEMPOTENCY_FAIL_ERROR', error);
    }
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
            });
        }

        const supabaseAdmin = createAdminClient();
        const { data, error } = await supabaseAdmin
            .from('telegram_users')
            .select('telegram_id, telegram_username')
            .eq('user_id', user.id)
            .single();

        if (error && error.code !== 'PGRST116') {
            console.error('GET_TELEGRAM_LINK_STATUS_DB_ERROR', error);
            return errorResponse({
                status: 500,
                code: 'TELEGRAM_LINK_STATUS_FAILED',
                message: 'Unable to load Telegram link status.',
                requestId,
                retryable: true,
            });
        }

        if (data) {
            return successResponse(
                {
                    isLinked: true,
                    telegram_id: data.telegram_id,
                    telegram_username: data.telegram_username,
                },
                requestId
            );
        }

        return successResponse({ isLinked: false }, requestId);
    } catch (error) {
        return handleRouteError(error, {
            requestId,
            code: 'TELEGRAM_LINK_STATUS_FAILED',
            message: 'Unable to load Telegram link status.',
            timeoutCode: 'TELEGRAM_LINK_STATUS_TIMEOUT',
            timeoutMessage: 'Telegram link status request timed out.',
            logLabel: 'GET_TELEGRAM_LINK_FAILED',
        });
    }
}

export async function DELETE(request: Request) {
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

        const supabaseAdmin = createAdminClient();

        const { error: deletionError } = await supabaseAdmin
            .from('telegram_users')
            .delete()
            .eq('user_id', user.id);

        if (deletionError) {
            console.error('DELETE_TELEGRAM_LINK_MAPPING_ERROR', deletionError);
            return errorResponse({
                status: 500,
                code: 'TELEGRAM_UNLINK_FAILED',
                message: 'Unable to unlink Telegram account.',
                requestId,
                retryable: true,
            });
        }

        const { error: profileUpdateError } = await supabaseAdmin
            .from('profiles')
            .update({ telegram_id: null })
            .eq('id', user.id);

        if (profileUpdateError) {
            console.warn('DELETE_TELEGRAM_LINK_PROFILE_SYNC_WARNING', profileUpdateError);
        }

        return successResponse(
            {
                success: true,
                message: 'Telegram authentication successfully unlinked',
                isLinked: false,
            },
            requestId
        );
    } catch (error) {
        return handleRouteError(error, {
            requestId,
            code: 'TELEGRAM_UNLINK_FAILED',
            message: 'Unable to unlink Telegram account.',
            timeoutCode: 'TELEGRAM_UNLINK_TIMEOUT',
            timeoutMessage: 'Telegram unlink request timed out.',
            logLabel: 'DELETE_TELEGRAM_LINK_FAILED',
        });
    }
}

export async function POST(request: Request) {
    const requestId = createRequestId(request);
    let authenticatedUserId: string | null = null;
    let body: unknown;

    try {
        body = await request.json();
    } catch (error) {
        console.error('POST_TELEGRAM_LINK_INVALID_JSON', error);
        return errorResponse({
            status: 400,
            code: 'INVALID_JSON',
            message: 'Invalid JSON payload.',
            requestId,
            retryable: false,
        });
    }

    const validatedData = LinkTokenSchema.safeParse(body);
    if (!validatedData.success) {
        console.error('POST_TELEGRAM_LINK_VALIDATION_ERROR', validatedData.error.flatten());
        return errorResponse({
            status: 400,
            code: 'INVALID_LINK_TOKEN',
            message: 'Link code must be a 6-digit numeric token.',
            requestId,
            retryable: false,
        });
    }

    let rateLimitHeaders: HeadersInit | undefined;
    let idempotencyKey: string | null = null;

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
        authenticatedUserId = user.id;

        const rateLimitKey = `${getClientIp(request)}:${getDeviceFingerprint(request) || user.id}`;
        const limitCheck = telegramLinkRateLimiter.check(rateLimitKey);
        rateLimitHeaders = {
            'X-RateLimit-Limit': TELEGRAM_LINK_LIMIT.toString(),
            'X-RateLimit-Remaining': limitCheck.remaining.toString(),
        };

        if (!limitCheck.allowed) {
            return errorResponse({
                status: 429,
                code: 'TELEGRAM_LINK_RATE_LIMITED',
                message: 'Too many Telegram link attempts. Please try again later.',
                requestId,
                retryable: true,
                headers: {
                    ...rateLimitHeaders,
                    'Retry-After': limitCheck.retryAfter.toString(),
                },
            });
        }

        const supabaseAdmin = createAdminClient();
        const { token, idempotencyKey: requestIdempotencyKey } = validatedData.data;
        idempotencyKey = requestIdempotencyKey;

        const reservation = await reserveIdempotentRequest({
            supabaseAdmin,
            userId: user.id,
            action: 'telegram_link',
            idempotencyKey,
            payload: { token },
        });

        if (reservation.kind === 'replay') {
            return successResponse(
                reservation.responseBody,
                requestId,
                {
                    status: reservation.statusCode,
                    headers: rateLimitHeaders,
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
                headers: rateLimitHeaders,
            });
        }

        const { data, error } = await supabaseAdmin.rpc('link_telegram_account_v2', {
            p_token: token,
            p_web_user_id: user.id,
        });

        if (error) {
            console.error('POST_TELEGRAM_LINK_RPC_ERROR', error);

            if (isInvalidLinkTokenError(error.message || '')) {
                await markTelegramFailure(supabaseAdmin, user.id, idempotencyKey, 400, {
                    code: 'INVALID_LINK_TOKEN',
                    message: 'Link code is invalid or expired.',
                });
                return errorResponse({
                    status: 400,
                    code: 'INVALID_LINK_TOKEN',
                    message: 'Link code is invalid or expired.',
                    requestId,
                    retryable: false,
                    headers: rateLimitHeaders,
                });
            }

            await markTelegramFailure(supabaseAdmin, user.id, idempotencyKey, 500, {
                code: 'TELEGRAM_LINK_FAILED',
                message: 'Unable to link Telegram account.',
            });
            return errorResponse({
                status: 500,
                code: 'TELEGRAM_LINK_FAILED',
                message: 'Unable to link Telegram account.',
                requestId,
                retryable: true,
                headers: rateLimitHeaders,
            });
        }

        const responseBody = {
            success: true,
            message: data?.message || 'Telegram account successfully linked.',
            telegram_id: data?.telegram_id,
        };

        try {
            await completeIdempotentRequest({
                supabaseAdmin,
                userId: user.id,
                action: 'telegram_link',
                idempotencyKey,
                statusCode: 200,
                responseBody,
            });
        } catch (error) {
            console.error('TELEGRAM_LINK_IDEMPOTENCY_COMPLETE_ERROR', error);
        }

        return successResponse(
            responseBody,
            requestId,
            { headers: rateLimitHeaders }
        );
    } catch (error) {
        if (authenticatedUserId) {
            const supabaseAdmin = createAdminClient();
            await markTelegramFailure(supabaseAdmin, authenticatedUserId, idempotencyKey, 500, {
                code: 'TELEGRAM_LINK_FAILED',
                message: 'Unable to link Telegram account.',
            });
        }

        return handleRouteError(error, {
            requestId,
            code: 'TELEGRAM_LINK_FAILED',
            message: 'Unable to link Telegram account.',
            timeoutCode: 'TELEGRAM_LINK_TIMEOUT',
            timeoutMessage: 'Telegram linking request timed out.',
            headers: rateLimitHeaders,
            logLabel: 'POST_TELEGRAM_LINK_FAILED',
        });
    }
}
