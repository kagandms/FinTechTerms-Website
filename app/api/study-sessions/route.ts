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
import { studySessionRouteRateLimiter } from '@/lib/rate-limiter';
import {
    createStudySessionToken,
    hashStudySessionToken,
    isStudySessionTokenMatch,
} from '@/lib/study-session-token';
import { createServiceRoleClient, resolveRequestAuthState } from '@/lib/supabaseAdmin';
import { hasConfiguredServiceRoleEnv } from '@/lib/env';

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

interface StudySessionRow {
    id: string;
    user_id: string | null;
    anonymous_id: string | null;
    session_token_hash: string | null;
}

const buildScopedIdempotencyKey = (
    ip: string,
    payload: SessionAction,
    userId: string | null
): string => {
    if (payload.action === 'start') {
        if (userId) {
            return `user:${userId}`;
        }

        if (payload.anonymousId) {
            return `anonymous:${payload.anonymousId}`;
        }

        return `ip:${ip}`;
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

const fetchStudySession = async (
    supabaseAdmin: ReturnType<typeof createServiceRoleClient>,
    sessionId: string
): Promise<StudySessionRow | null> => {
    const { data, error } = await supabaseAdmin
        .from('study_sessions')
        .select('id, user_id, anonymous_id, session_token_hash')
        .eq('id', sessionId)
        .maybeSingle();

    if (error) {
        throw error;
    }

    return data as StudySessionRow | null;
};

const validateSessionOwnership = async (
    supabaseAdmin: ReturnType<typeof createServiceRoleClient>,
    sessionId: string,
    sessionToken: string,
    userId: string | null
): Promise<StudySessionRow | false | null> => {
    const session = await fetchStudySession(supabaseAdmin, sessionId);

    if (!session) {
        return null;
    }

    if (!isStudySessionTokenMatch(session.session_token_hash, sessionToken)) {
        return false;
    }

    if (session.user_id && session.user_id !== userId) {
        return false;
    }

    return session;
};

const findExistingStartedSession = async (
    supabaseAdmin: ReturnType<typeof createServiceRoleClient>,
    payload: StartSessionAction,
    userId: string | null
): Promise<Pick<StudySessionRow, 'id'> | null> => {
    let query = supabaseAdmin
        .from('study_sessions')
        .select('id')
        .eq('idempotency_key', payload.idempotency_key);

    if (userId) {
        query = query.eq('user_id', userId);
    } else if (payload.anonymousId) {
        query = query.eq('anonymous_id', payload.anonymousId);
    } else {
        return null;
    }

    const { data, error } = await query.maybeSingle();

    if (error) {
        throw error;
    }

    return data as Pick<StudySessionRow, 'id'> | null;
};

const rotateSessionToken = async (
    supabaseAdmin: ReturnType<typeof createServiceRoleClient>,
    sessionId: string
): Promise<StartSessionResponseBody> => {
    const sessionToken = createStudySessionToken();
    const { error } = await supabaseAdmin
        .from('study_sessions')
        .update({
            session_token_hash: hashStudySessionToken(sessionToken),
        })
        .eq('id', sessionId);

    if (error) {
        throw error;
    }

    return {
        sessionId,
        sessionToken,
    };
};

const transferAnonymousSessionToUser = async (
    supabaseAdmin: ReturnType<typeof createServiceRoleClient>,
    payload: StartSessionAction,
    userId: string
): Promise<'ok' | 'not_found' | 'forbidden'> => {
    if (!payload.previous_session_id) {
        return 'ok';
    }

    if (!payload.previous_session_token) {
        return 'forbidden';
    }

    const existingSession = await fetchStudySession(
        supabaseAdmin,
        payload.previous_session_id
    );

    if (!existingSession) {
        return 'not_found';
    }

    if (!isStudySessionTokenMatch(
        existingSession.session_token_hash,
        payload.previous_session_token
    )) {
        return 'forbidden';
    }

    if (existingSession.user_id && existingSession.user_id !== userId) {
        return 'forbidden';
    }

    const { error } = await supabaseAdmin
        .from('study_sessions')
        .update({ user_id: userId })
        .eq('id', payload.previous_session_id);

    if (error) {
        throw error;
    }

    return 'ok';
};

const startStudySession = async (
    supabaseAdmin: ReturnType<typeof createServiceRoleClient>,
    payload: StartSessionAction,
    userId: string | null
): Promise<StartSessionResponseBody> => {
    const sessionToken = createStudySessionToken();
    const response = await supabaseAdmin
        .from('study_sessions')
        .insert({
            user_id: userId,
            anonymous_id: userId ? null : payload.anonymousId ?? null,
            idempotency_key: payload.idempotency_key,
            session_start: new Date().toISOString(),
            session_token_hash: hashStudySessionToken(sessionToken),
            device_type: payload.deviceType,
            user_agent: payload.userAgent ?? null,
            consent_given: true,
            consent_timestamp: new Date().toISOString(),
        })
        .select('id')
        .single();

    if (!response.error) {
        return {
            sessionId: response.data.id,
            sessionToken,
        };
    }

    if (response.error.code === '23505') {
        const existingSession = await findExistingStartedSession(
            supabaseAdmin,
            payload,
            userId
        );

        if (existingSession?.id) {
            return await rotateSessionToken(supabaseAdmin, existingSession.id);
        }
    }

    throw response.error;
};

const updateStudySession = async (
    supabaseAdmin: ReturnType<typeof createServiceRoleClient>,
    payload: SessionFollowUpAction
): Promise<void> => {
    const updatePayload = {
        duration_seconds: payload.durationSeconds,
        page_views: payload.pageViews,
        quiz_attempts: payload.quizAttempts,
        ...(payload.action === 'end' ? { session_end: new Date().toISOString() } : {}),
    };

    const { error } = await supabaseAdmin
        .from('study_sessions')
        .update(updatePayload)
        .eq('id', payload.sessionId);

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
        if (!hasConfiguredServiceRoleEnv()) {
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
        reservedScope = idempotencyScope;
        reservedIdempotencyKey = payload.idempotency_key;

        const supabaseAdmin = createServiceRoleClient();
        if (hadCredentials && !user) {
            return respondWithCachedError(
                idempotencyScope,
                payload.idempotency_key,
                401,
                buildCachedApiError(requestId, 'UNAUTHORIZED', AUTH_REQUIRED_MESSAGE, false)
            );
        }

        if (payload.action === 'start') {
            if (!user && !payload.anonymousId) {
                return respondWithCachedError(
                    idempotencyScope,
                    payload.idempotency_key,
                    401,
                    buildCachedApiError(requestId, 'UNAUTHORIZED', AUTH_REQUIRED_MESSAGE, false)
                );
            }

            if (user && payload.previous_session_id && !payload.previous_session_token) {
                return respondWithCachedError(
                    idempotencyScope,
                    payload.idempotency_key,
                    400,
                    buildCachedApiError(
                        requestId,
                        'INVALID_STUDY_SESSION_PAYLOAD',
                        'previous_session_token is required when previous_session_id is provided.',
                        false
                    )
                );
            }

            if (user) {
                const transferState = await transferAnonymousSessionToUser(
                    supabaseAdmin,
                    payload,
                    user.id
                );

                if (transferState === 'not_found') {
                    return respondWithCachedError(
                        idempotencyScope,
                        payload.idempotency_key,
                        404,
                        buildCachedApiError(
                            requestId,
                            'STUDY_SESSION_NOT_FOUND',
                            'Previous study session not found.',
                            false
                        )
                    );
                }

                if (transferState === 'forbidden') {
                    return respondWithCachedError(
                        idempotencyScope,
                        payload.idempotency_key,
                        403,
                        buildCachedApiError(
                            requestId,
                            'STUDY_SESSION_FORBIDDEN',
                            'Previous study session does not belong to this requester.',
                            false
                        )
                    );
                }
            }

            const responseBody = await startStudySession(
                supabaseAdmin,
                payload,
                user?.id ?? null
            );

            cacheStudySessionResponse(
                idempotencyScope,
                payload.idempotency_key,
                200,
                responseBody
            );

            return successResponse(responseBody, requestId);
        }

        const ownership = await validateSessionOwnership(
            supabaseAdmin,
            payload.sessionId,
            payload.sessionToken,
            user?.id ?? null
        );

        if (ownership === null) {
            return respondWithCachedError(
                idempotencyScope,
                payload.idempotency_key,
                404,
                buildCachedApiError(requestId, 'STUDY_SESSION_NOT_FOUND', 'Study session not found.', false)
            );
        }

        if (ownership === false) {
            return respondWithCachedError(
                idempotencyScope,
                payload.idempotency_key,
                403,
                buildCachedApiError(
                    requestId,
                    'STUDY_SESSION_FORBIDDEN',
                    'Study session does not belong to this requester.',
                    false
                )
            );
        }

        await updateStudySession(supabaseAdmin, payload);

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
