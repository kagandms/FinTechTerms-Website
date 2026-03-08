import { NextResponse } from 'next/server';
import { z } from 'zod';
import {
    createRequestId,
    errorResponse,
    getClientIp,
    handleRouteError,
    successResponse,
} from '@/lib/api-response';
import { AUTH_REQUIRED_MESSAGE } from '@/lib/auth/session';
import {
    completeEphemeralIdempotentRequest,
    inspectEphemeralIdempotentRequest,
    reserveEphemeralIdempotentRequest,
} from '@/lib/ephemeral-idempotency';
import { studySessionRouteRateLimiter } from '@/lib/rate-limiter';
import { createServiceRoleClient, resolveRequestAuthState } from '@/lib/supabaseAdmin';

const SessionActionSchema = z.discriminatedUnion('action', [
    z.object({
        action: z.literal('start'),
        anonymousId: z.string().min(1).nullable().optional(),
        deviceType: z.enum(['mobile', 'tablet', 'desktop', 'unknown']).default('unknown'),
        userAgent: z.string().nullable().optional(),
        consentGiven: z.literal(true),
        idempotency_key: z.string().uuid(),
    }).strict(),
    z.object({
        action: z.literal('heartbeat'),
        sessionId: z.string().uuid(),
        anonymousId: z.string().min(1).nullable().optional(),
        durationSeconds: z.number().int().min(0),
        pageViews: z.number().int().min(0),
        quizAttempts: z.number().int().min(0),
        idempotency_key: z.string().uuid(),
    }).strict(),
    z.object({
        action: z.literal('end'),
        sessionId: z.string().uuid(),
        anonymousId: z.string().min(1).nullable().optional(),
        durationSeconds: z.number().int().min(0),
        pageViews: z.number().int().min(0),
        quizAttempts: z.number().int().min(0),
        idempotency_key: z.string().uuid(),
    }).strict(),
]);

const STUDY_SESSION_RATE_LIMIT_HEADERS = {
    'X-RateLimit-Limit': '30',
    'X-RateLimit-Policy': '30;w=60',
};

type SessionAction = z.infer<typeof SessionActionSchema>;

type CachedApiErrorBody = {
    code: string;
    message: string;
    requestId: string;
    retryable: boolean;
};

type SessionCacheableBody =
    | { sessionId: string }
    | { success: true }
    | CachedApiErrorBody;

const buildScopedIdempotencyKey = (
    ip: string,
    payload: SessionAction,
    userId: string | null
): string => {
    if (userId) {
        return `user:${userId}`;
    }

    if (payload.anonymousId) {
        return `anonymous:${payload.anonymousId}`;
    }

    return `ip:${ip}`;
};

const replayCachedResponse = (
    cachedBody: SessionCacheableBody,
    statusCode: number,
    requestId: string
) => NextResponse.json(cachedBody, {
    status: statusCode,
    headers: {
        'X-Request-Id': requestId,
        'X-Idempotency-Replayed': 'true',
    },
});

const cacheStudySessionResponse = (
    scope: string,
    idempotencyKey: string,
    statusCode: number,
    responseBody: SessionCacheableBody
) => {
    completeEphemeralIdempotentRequest({
        scope,
        idempotencyKey,
        statusCode,
        responseBody,
    });
};

const validateSessionOwnership = async (
    supabaseAdmin: ReturnType<typeof createServiceRoleClient>,
    sessionId: string,
    userId: string | null,
    anonymousId?: string | null
) => {
    const { data, error } = await supabaseAdmin
        .from('study_sessions')
        .select('id, user_id, anonymous_id')
        .eq('id', sessionId)
        .maybeSingle();

    if (error) {
        throw error;
    }

    if (!data) {
        return null;
    }

    if (userId && data.user_id === userId) {
        return data;
    }

    if (!userId && anonymousId && data.anonymous_id === anonymousId) {
        return data;
    }

    return false;
};

export async function POST(request: Request) {
    const requestId = createRequestId(request);
    const ip = getClientIp(request);
    let body: unknown;

    try {
        body = await request.json();
    } catch (error) {
        console.error('POST_STUDY_SESSIONS_INVALID_JSON', error);
        return errorResponse({
            status: 400,
            code: 'INVALID_JSON',
            message: 'Invalid JSON payload.',
            requestId,
            retryable: false,
        });
    }

    const validatedData = SessionActionSchema.safeParse(body);
    if (!validatedData.success) {
        console.error('POST_STUDY_SESSIONS_VALIDATION_ERROR', validatedData.error.flatten());
        return errorResponse({
            status: 400,
            code: 'INVALID_STUDY_SESSION_PAYLOAD',
            message: 'Study session payload is invalid.',
            requestId,
            retryable: false,
        });
    }

    const payload = validatedData.data;

    try {
        const { user, hadCredentials } = await resolveRequestAuthState(request);
        const idempotencyScope = buildScopedIdempotencyKey(ip, payload, user?.id ?? null);
        const reservation = inspectEphemeralIdempotentRequest({
            scope: idempotencyScope,
            idempotencyKey: payload.idempotency_key,
            payload,
        });

        if (reservation.kind === 'replay') {
            return replayCachedResponse(
                reservation.responseBody as SessionCacheableBody,
                reservation.statusCode,
                requestId
            );
        }

        if (reservation.kind === 'conflict') {
            return errorResponse({
                status: 409,
                code: reservation.code,
                message: reservation.message,
                requestId,
                retryable: reservation.code === 'REQUEST_IN_PROGRESS',
            });
        }

        const limitCheck = studySessionRouteRateLimiter.check(ip);
        if (!limitCheck.allowed) {
            return errorResponse({
                status: 429,
                code: 'STUDY_SESSION_RATE_LIMITED',
                message: 'Too many study session requests. Please slow down.',
                requestId,
                retryable: true,
                headers: {
                    ...STUDY_SESSION_RATE_LIMIT_HEADERS,
                    'Retry-After': limitCheck.retryAfter.toString(),
                },
            });
        }

        reserveEphemeralIdempotentRequest({
            scope: idempotencyScope,
            idempotencyKey: payload.idempotency_key,
            payload,
        });

        const supabaseAdmin = createServiceRoleClient();
        if (hadCredentials && !user) {
            const responseBody: CachedApiErrorBody = {
                code: 'UNAUTHORIZED',
                message: AUTH_REQUIRED_MESSAGE,
                requestId,
                retryable: false,
            };
            cacheStudySessionResponse(idempotencyScope, payload.idempotency_key, 401, responseBody);
            return errorResponse({
                status: 401,
                code: responseBody.code,
                message: responseBody.message,
                requestId,
                retryable: responseBody.retryable,
            });
        }

        if (payload.action === 'start') {
            if (!user && !payload.anonymousId) {
                const responseBody: CachedApiErrorBody = {
                    code: 'UNAUTHORIZED',
                    message: AUTH_REQUIRED_MESSAGE,
                    requestId,
                    retryable: false,
                };
                cacheStudySessionResponse(idempotencyScope, payload.idempotency_key, 401, responseBody);
                return errorResponse({
                    status: 401,
                    code: responseBody.code,
                    message: responseBody.message,
                    requestId,
                    retryable: responseBody.retryable,
                });
            }

            const response = await supabaseAdmin
                .from('study_sessions')
                .insert({
                    user_id: user?.id ?? null,
                    anonymous_id: user ? null : payload.anonymousId ?? null,
                    session_start: new Date().toISOString(),
                    device_type: payload.deviceType,
                    user_agent: payload.userAgent ?? null,
                    consent_given: true,
                    consent_timestamp: new Date().toISOString(),
                })
                .select('id')
                .single();

            if (response.error) {
                console.error('POST_STUDY_SESSIONS_START_ERROR', response.error);
                const responseBody: CachedApiErrorBody = {
                    code: 'STUDY_SESSION_START_FAILED',
                    message: 'Unable to start study session.',
                    requestId,
                    retryable: true,
                };
                cacheStudySessionResponse(idempotencyScope, payload.idempotency_key, 500, responseBody);
                return errorResponse({
                    status: 500,
                    code: responseBody.code,
                    message: responseBody.message,
                    requestId,
                    retryable: responseBody.retryable,
                });
            }

            const responseBody = {
                sessionId: response.data.id,
            } as const;
            cacheStudySessionResponse(idempotencyScope, payload.idempotency_key, 200, responseBody);
            return successResponse(
                responseBody,
                requestId
            );
        }

        const ownership = await validateSessionOwnership(
            supabaseAdmin,
            payload.sessionId,
            user?.id ?? null,
            payload.anonymousId
        );

        if (ownership === null) {
            const responseBody: CachedApiErrorBody = {
                code: 'STUDY_SESSION_NOT_FOUND',
                message: 'Study session not found.',
                requestId,
                retryable: false,
            };
            cacheStudySessionResponse(idempotencyScope, payload.idempotency_key, 404, responseBody);
            return errorResponse({
                status: 404,
                code: responseBody.code,
                message: responseBody.message,
                requestId,
                retryable: responseBody.retryable,
            });
        }

        if (ownership === false) {
            const responseBody: CachedApiErrorBody = {
                code: 'STUDY_SESSION_FORBIDDEN',
                message: 'Study session does not belong to this requester.',
                requestId,
                retryable: false,
            };
            cacheStudySessionResponse(idempotencyScope, payload.idempotency_key, 403, responseBody);
            return errorResponse({
                status: 403,
                code: responseBody.code,
                message: responseBody.message,
                requestId,
                retryable: responseBody.retryable,
            });
        }

        const updatePayload = {
            duration_seconds: payload.durationSeconds,
            page_views: payload.pageViews,
            quiz_attempts: payload.quizAttempts,
            ...(payload.action === 'end' ? { session_end: new Date().toISOString() } : {}),
        };

        const response = await supabaseAdmin
            .from('study_sessions')
            .update(updatePayload)
            .eq('id', payload.sessionId);

        if (response.error) {
            console.error('POST_STUDY_SESSIONS_UPDATE_ERROR', response.error);
            const responseBody: CachedApiErrorBody = {
                code: payload.action === 'end'
                    ? 'STUDY_SESSION_END_FAILED'
                    : 'STUDY_SESSION_UPDATE_FAILED',
                message: payload.action === 'end'
                    ? 'Unable to end study session.'
                    : 'Unable to update study session.',
                requestId,
                retryable: true,
            };
            cacheStudySessionResponse(idempotencyScope, payload.idempotency_key, 500, responseBody);
            return errorResponse({
                status: 500,
                code: responseBody.code,
                message: responseBody.message,
                requestId,
                retryable: responseBody.retryable,
            });
        }

        const responseBody = {
            success: true,
        } as const;
        cacheStudySessionResponse(idempotencyScope, payload.idempotency_key, 200, responseBody);
        return successResponse(
            responseBody,
            requestId
        );
    } catch (error) {
        return handleRouteError(error, {
            requestId,
            code: 'STUDY_SESSION_FAILED',
            message: 'Unable to persist study session.',
            timeoutCode: 'STUDY_SESSION_TIMEOUT',
            timeoutMessage: 'Study session request timed out.',
            logLabel: 'POST_STUDY_SESSIONS_FAILED',
        });
    }
}
