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
    deleteEphemeralIdempotentRequest,
    inspectEphemeralIdempotentRequest,
    reserveEphemeralIdempotentRequest,
} from '@/lib/ephemeral-idempotency';
import { logger } from '@/lib/logger';
import {
    isRateLimiterUnavailable,
    studySessionRouteRateLimiter,
} from '@/lib/rate-limiter';
import {
    createStudySessionToken,
    hashStudySessionToken,
} from '@/lib/study-session-token';
import { createServiceRoleClient, resolveRequestAuthState } from '@/lib/supabaseAdmin';
import { hasConfiguredStudySessionEnv } from '@/lib/env';

const StartSessionSchema = z.object({
    action: z.literal('start'),
    anonymousId: z.string().min(1).nullable().optional(),
    deviceType: z.enum(['mobile', 'tablet', 'desktop', 'unknown']).default('unknown'),
    userAgent: z.string().nullable().optional(),
    consentGiven: z.literal(true),
    previous_session_id: z.string().uuid().nullable().optional(),
    previous_session_token: z.string().min(32).nullable().optional(),
    idempotency_key: z.string().uuid(),
}).strict();

const SessionProgressSchema = z.object({
    sessionId: z.string().uuid(),
    sessionToken: z.string().min(32),
    durationSeconds: z.number().int().min(0),
    pageViews: z.number().int().min(0),
    quizAttempts: z.number().int().min(0),
    idempotency_key: z.string().uuid(),
});

const SessionActionSchema = z.discriminatedUnion('action', [
    StartSessionSchema,
    SessionProgressSchema.extend({
        action: z.literal('heartbeat'),
    }).strict(),
    SessionProgressSchema.extend({
        action: z.literal('end'),
    }).strict(),
]);

const STUDY_SESSION_RATE_LIMIT_HEADERS = {
    'X-RateLimit-Limit': '30',
    'X-RateLimit-Policy': '30;w=60',
};

type SessionAction = z.infer<typeof SessionActionSchema>;
type StartSessionAction = z.infer<typeof StartSessionSchema>;
type SessionFollowUpAction = Extract<SessionAction, { action: 'heartbeat' | 'end' }>;
type StudySessionMutationClient = ReturnType<typeof createServiceRoleClient>;

type CachedApiErrorBody = {
    code: string;
    message: string;
    requestId: string;
    retryable: boolean;
};

type StartSessionResponseBody = {
    sessionId: string;
    sessionToken: string;
};

type SessionCacheableBody =
    | StartSessionResponseBody
    | { success: true }
    | CachedApiErrorBody;

const buildScopedIdempotencyKey = (
    ip: string,
    payload: SessionAction,
    userId: string | null
): string => {
    if (payload.action === 'start') {
        if (userId) {
            return `user:${userId}`;
        }

        // Never trust caller-supplied anonymous identifiers for abuse control.
        return `anonymous-ip:${ip}`;
    }

    if (userId) {
        return `user:${userId}:session:${payload.sessionId}`;
    }

    return `session:${payload.sessionId}`;
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

const buildCachedApiError = (
    requestId: string,
    code: string,
    message: string,
    retryable: boolean
): CachedApiErrorBody => ({
    code,
    message,
    requestId,
    retryable,
});

const respondWithCachedError = (
    scope: string,
    idempotencyKey: string,
    statusCode: number,
    responseBody: CachedApiErrorBody
) => {
    cacheStudySessionResponse(scope, idempotencyKey, statusCode, responseBody);

    return errorResponse({
        status: statusCode,
        code: responseBody.code,
        message: responseBody.message,
        requestId: responseBody.requestId,
        retryable: responseBody.retryable,
    });
};

const getSessionNotFoundMessage = (payload: SessionAction): string => (
    payload.action === 'start' && payload.previous_session_id
        ? 'Previous study session not found.'
        : 'Study session not found.'
);

const getSessionForbiddenMessage = (payload: SessionAction): string => (
    payload.action === 'start' && payload.previous_session_id
        ? 'Previous study session does not belong to this requester.'
        : 'Study session does not belong to this requester.'
);

const createSessionErrorResponse = (
    payload: SessionAction,
    requestId: string,
    scope: string,
    idempotencyKey: string,
    error: { code?: string | null; message?: string | null }
) => {
    if (error.code === 'P0002') {
        return respondWithCachedError(
            scope,
            idempotencyKey,
            404,
            buildCachedApiError(
                requestId,
                'STUDY_SESSION_NOT_FOUND',
                getSessionNotFoundMessage(payload),
                false
            )
        );
    }

    if (error.code === '42501') {
        return respondWithCachedError(
            scope,
            idempotencyKey,
            403,
            buildCachedApiError(
                requestId,
                'STUDY_SESSION_FORBIDDEN',
                getSessionForbiddenMessage(payload),
                false
            )
        );
    }

    return null;
};

const coerceSessionId = (value: unknown): string | null => (
    typeof value === 'string' && value.length > 0
        ? value
        : null
);

const buildStartSessionResponse = async (
    supabase: StudySessionMutationClient,
    payload: StartSessionAction,
    requesterUserId: string | null,
    sessionId: string
): Promise<StartSessionResponseBody> => {
    const sessionToken = createStudySessionToken(sessionId, payload.idempotency_key);
    const { error } = await supabase.rpc('bind_study_session_token_server', {
        p_requester_user_id: requesterUserId,
        p_requester_anonymous_id: payload.anonymousId ?? null,
        p_session_id: sessionId,
        p_idempotency_key: payload.idempotency_key,
        p_session_token_hash: hashStudySessionToken(sessionToken),
    });

    if (error) {
        throw error;
    }

    return {
        sessionId,
        sessionToken,
    };
};

const startStudySession = async (
    supabase: StudySessionMutationClient,
    payload: StartSessionAction,
    requesterUserId: string | null
): Promise<StartSessionResponseBody> => {
    const previousSessionTokenHash = payload.previous_session_token
        ? hashStudySessionToken(payload.previous_session_token)
        : null;
    const { data, error } = await supabase.rpc('start_study_session_server', {
        p_requester_user_id: requesterUserId,
        p_requester_anonymous_id: payload.anonymousId ?? null,
        p_device_type: payload.deviceType,
        p_user_agent: payload.userAgent ?? null,
        p_consent_given: true,
        p_idempotency_key: payload.idempotency_key,
        p_previous_session_id: payload.previous_session_id ?? null,
        p_previous_session_token_hash: previousSessionTokenHash,
    });

    if (error) {
        throw error;
    }

    const sessionId = coerceSessionId(data);
    if (!sessionId) {
        throw new Error('Study session start RPC returned an invalid session id.');
    }

    return buildStartSessionResponse(supabase, payload, requesterUserId, sessionId);
};

const updateStudySession = async (
    supabase: StudySessionMutationClient,
    payload: SessionFollowUpAction,
    requesterUserId: string | null
): Promise<void> => {
    const { error } = await supabase.rpc('update_study_session_by_token_server', {
        p_requester_user_id: requesterUserId,
        p_session_id: payload.sessionId,
        p_session_token_hash: hashStudySessionToken(payload.sessionToken),
        p_duration_seconds: payload.durationSeconds,
        p_page_views: payload.pageViews,
        p_quiz_attempts: payload.quizAttempts,
        p_end_session: payload.action === 'end',
        p_ended_at: payload.action === 'end'
            ? new Date().toISOString()
            : null,
    });

    if (error) {
        throw error;
    }
};

export async function POST(request: Request) {
    const requestId = createRequestId(request);
    const ip = getClientIp(request);
    let body: unknown;
    let reservedScope: string | null = null;
    let reservedIdempotencyKey: string | null = null;

    try {
        body = await request.json();
    } catch (error) {
        logger.error('POST_STUDY_SESSIONS_INVALID_JSON', {
            requestId,
            route: '/api/study-sessions',
            error: error instanceof Error ? error : undefined,
            retryable: false,
        });
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
        logger.error('POST_STUDY_SESSIONS_VALIDATION_ERROR', {
            requestId,
            route: '/api/study-sessions',
            retryable: false,
            issues: validatedData.error.flatten(),
        });
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
        if (!hasConfiguredStudySessionEnv()) {
            return errorResponse({
                status: 503,
                code: 'STUDY_SESSION_DISABLED',
                message: 'Study session analytics are temporarily unavailable.',
                requestId,
                retryable: false,
            });
        }

        const { user, hadCredentials } = await resolveRequestAuthState(request);
        const idempotencyScope = buildScopedIdempotencyKey(ip, payload, user?.id ?? null);

        const reservation = inspectEphemeralIdempotentRequest({
            scope: idempotencyScope,
            idempotencyKey: payload.idempotency_key,
            payload,
        });

        if (reservation.kind === 'replay') {
            if (reservation.isError) {
                deleteEphemeralIdempotentRequest(idempotencyScope, payload.idempotency_key);
            } else {
                return replayCachedResponse(
                    reservation.responseBody as SessionCacheableBody,
                    reservation.statusCode,
                    requestId
                );
            }
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

        const rateLimitKey = user?.id
            ? `user:${user.id}`
            : payload.action === 'start'
                ? `anonymous-ip:${ip}`
                : `session:${payload.sessionId}`;
        const limitCheck = await studySessionRouteRateLimiter.check(rateLimitKey);
        if (isRateLimiterUnavailable(limitCheck)) {
            return errorResponse({
                status: 503,
                code: 'RATE_LIMITER_UNAVAILABLE',
                message: 'Rate limiting is temporarily unavailable.',
                requestId,
                retryable: true,
                headers: STUDY_SESSION_RATE_LIMIT_HEADERS,
            });
        }

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

        let supabase: StudySessionMutationClient;
        try {
            supabase = createServiceRoleClient();
        } catch (error) {
            logger.error('POST_STUDY_SESSIONS_SERVICE_ROLE_CLIENT_UNAVAILABLE', {
                requestId,
                route: '/api/study-sessions',
                error: error instanceof Error ? error : undefined,
                retryable: true,
            });
            return errorResponse({
                status: 503,
                code: 'STUDY_SESSION_FAILED',
                message: 'Unable to persist study session.',
                requestId,
                retryable: true,
            });
        }

        if (hadCredentials && !user) {
            return errorResponse({
                status: 401,
                code: 'UNAUTHORIZED',
                message: AUTH_REQUIRED_MESSAGE,
                requestId,
                retryable: false,
            });
        }

        if (payload.action === 'start') {
            if (!user && !payload.anonymousId) {
                return errorResponse({
                    status: 401,
                    code: 'UNAUTHORIZED',
                    message: AUTH_REQUIRED_MESSAGE,
                    requestId,
                    retryable: false,
                });
            }

            if (user && payload.previous_session_id && !payload.previous_session_token) {
                return errorResponse({
                    status: 400,
                    code: 'INVALID_STUDY_SESSION_PAYLOAD',
                    message: 'previous_session_token is required when previous_session_id is provided.',
                    requestId,
                    retryable: false,
                });
            }
        }

        reserveEphemeralIdempotentRequest({
            scope: idempotencyScope,
            idempotencyKey: payload.idempotency_key,
            payload,
        });
        reservedScope = idempotencyScope;
        reservedIdempotencyKey = payload.idempotency_key;

        if (payload.action === 'start') {
            try {
                const responseBody = await startStudySession(supabase, payload, user?.id ?? null);

                cacheStudySessionResponse(
                    idempotencyScope,
                    payload.idempotency_key,
                    200,
                    responseBody
                );

                return successResponse(responseBody, requestId);
            } catch (error) {
                const rpcResponse = (
                    error
                    && typeof error === 'object'
                    && 'code' in error
                )
                    ? createSessionErrorResponse(
                        payload,
                        requestId,
                        idempotencyScope,
                        payload.idempotency_key,
                        error as { code?: string | null; message?: string | null }
                    )
                    : null;

                if (rpcResponse) {
                    return rpcResponse;
                }

                throw error;
            }
        }

        try {
            await updateStudySession(supabase, payload, user?.id ?? null);
        } catch (error) {
            const rpcResponse = (
                error
                && typeof error === 'object'
                && 'code' in error
            )
                ? createSessionErrorResponse(
                    payload,
                    requestId,
                    idempotencyScope,
                    payload.idempotency_key,
                    error as { code?: string | null; message?: string | null }
                )
                : null;

            if (rpcResponse) {
                return rpcResponse;
            }

            throw error;
        }

        const responseBody = { success: true } as const;
        cacheStudySessionResponse(idempotencyScope, payload.idempotency_key, 200, responseBody);
        return successResponse(responseBody, requestId);
    } catch (error) {
        if (reservedScope && reservedIdempotencyKey) {
            deleteEphemeralIdempotentRequest(reservedScope, reservedIdempotencyKey);
        }

        logger.error('POST_STUDY_SESSIONS_FAILED', {
            requestId,
            route: '/api/study-sessions',
            error: error instanceof Error ? error : undefined,
            retryable: true,
        });
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
