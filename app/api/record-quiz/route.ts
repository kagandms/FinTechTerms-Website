import { NextRequest } from 'next/server';
import { z } from 'zod';
import {
    createRequestId,
    errorResponse,
    handleRouteError,
    getClientIp,
    successResponse,
} from '@/lib/api-response';
import {
    completeIdempotentRequest,
    deleteIdempotentRequest,
    failIdempotentRequest,
    inspectIdempotentRequest,
    reserveIdempotentRequest,
} from '@/lib/api-idempotency';
import { logger } from '@/lib/logger';
import {
    apiRouteRateLimiter,
    isRateLimiterUnavailable,
    quizMutationRateLimiter,
} from '@/lib/rate-limiter';
import {
    createServiceRoleClient,
    resolveAuthenticatedUser,
} from '@/lib/supabaseAdmin';
import { AUTH_REQUIRED_MESSAGE } from '@/lib/auth/session';
import { hashStudySessionToken } from '@/lib/study-session-token';
import { QuizAttemptSchema } from '@/lib/validators';

const RecordQuizRequestSchema = QuizAttemptSchema.extend({
    idempotencyKey: z.string().uuid(),
}).superRefine((value, context) => {
    const hasSessionId = typeof value.session_id === 'string';
    const hasSessionToken = typeof value.session_token === 'string';

    if (hasSessionId === hasSessionToken) {
        return;
    }

    context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'session_id and session_token must be provided together.',
        path: hasSessionId ? ['session_token'] : ['session_id'],
    });
});

const GLOBAL_RATE_LIMIT_HEADERS = {
    'X-RateLimit-Limit': '100',
    'X-RateLimit-Policy': '100;w=60, 20;w=10',
};

const WRITE_RATE_LIMIT = 20;
type QuizMutationClient = ReturnType<typeof createServiceRoleClient>;

const markQuizFailure = async (
    routeSupabase: QuizMutationClient,
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
            supabaseAdmin: routeSupabase,
            userId,
            action: 'quiz_submission',
            idempotencyKey,
            statusCode,
            responseBody,
        });
    } catch (error) {
        logger.error('QUIZ_ROUTE_IDEMPOTENCY_FAIL_ERROR', {
            route: '/api/record-quiz',
            userId,
            error: error instanceof Error ? error : undefined,
        });
    }
};

const getSessionScopedQuizError = (
    error: { code?: string | null; message?: string | null },
    sessionId: string | null | undefined
): {
    status: 404 | 403 | 409;
    code: 'STUDY_SESSION_NOT_FOUND' | 'STUDY_SESSION_FORBIDDEN' | 'STUDY_SESSION_CONFLICT';
    message: string;
} | null => {
    if (!sessionId) {
        return null;
    }

    if (error.code === 'P0002') {
        return {
            status: 404,
            code: 'STUDY_SESSION_NOT_FOUND',
            message: 'Study session not found.',
        };
    }

    if (error.code === '42501') {
        return {
            status: 403,
            code: 'STUDY_SESSION_FORBIDDEN',
            message: 'Study session does not belong to this requester.',
        };
    }

    if (
        error.code === '23505'
        && (error.message || '').toLowerCase().includes('study session')
    ) {
        return {
            status: 409,
            code: 'STUDY_SESSION_CONFLICT',
            message: 'Study session is already linked to a different quiz submission.',
        };
    }

    return null;
};

export async function POST(request: NextRequest) {
    const requestId = createRequestId(request);
    const ip = getClientIp(request);
    let mutationClient: QuizMutationClient | null = null;
    let body: unknown;
    try {
        body = await request.json();
    } catch (error) {
        logger.error('QUIZ_ROUTE_INVALID_JSON', {
            requestId,
            route: '/api/record-quiz',
            error: error instanceof Error ? error : undefined,
            retryable: false,
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

    const validatedData = RecordQuizRequestSchema.safeParse(body);
    if (!validatedData.success) {
        logger.error('QUIZ_ROUTE_VALIDATION_ERROR', {
            requestId,
            route: '/api/record-quiz',
            retryable: false,
            issues: validatedData.error.flatten(),
        });
        return errorResponse({
            status: 400,
            code: 'VALIDATION_ERROR',
            message: 'Quiz attempt payload is invalid.',
            requestId,
            retryable: false,
            headers: GLOBAL_RATE_LIMIT_HEADERS,
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
            headers: GLOBAL_RATE_LIMIT_HEADERS,
        });
    }

    try {
        mutationClient = createServiceRoleClient();
    } catch (error) {
        logger.error('QUIZ_ROUTE_SERVICE_ROLE_CLIENT_UNAVAILABLE', {
            requestId,
            route: '/api/record-quiz',
            error: error instanceof Error ? error : undefined,
            retryable: true,
        });
        return errorResponse({
            status: 503,
            code: 'QUIZ_PERSIST_FAILED',
            message: 'Unable to record quiz attempt.',
            requestId,
            retryable: true,
            headers: GLOBAL_RATE_LIMIT_HEADERS,
        });
    }
    const routeSupabase = mutationClient;
    const {
        term_id,
        is_correct,
        response_time_ms,
        quiz_type,
        occurred_at,
        session_id,
        session_token,
        idempotencyKey,
    } = validatedData.data;

    const inspection = await inspectIdempotentRequest({
        supabaseAdmin: routeSupabase,
        userId: user.id,
        action: 'quiz_submission',
        idempotencyKey,
        payload: {
            term_id,
            is_correct,
            response_time_ms,
            quiz_type,
            occurred_at: occurred_at ?? null,
            session_id: session_id ?? null,
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

    const limitCheck = await apiRouteRateLimiter.check(`record-quiz:${ip}`);

    if (isRateLimiterUnavailable(limitCheck)) {
        return errorResponse({
            status: 503,
            code: 'RATE_LIMITER_UNAVAILABLE',
            message: 'Rate limiting is temporarily unavailable.',
            requestId,
            retryable: true,
            headers: GLOBAL_RATE_LIMIT_HEADERS,
        });
    }

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

    const writeLimitCheck = await quizMutationRateLimiter.check(user.id);

    if (isRateLimiterUnavailable(writeLimitCheck)) {
        return errorResponse({
            status: 503,
            code: 'RATE_LIMITER_UNAVAILABLE',
            message: 'Rate limiting is temporarily unavailable.',
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
            code: 'QUIZ_WRITE_RATE_LIMITED',
            message: 'Too many quiz submissions. Please slow down.',
            requestId,
            retryable: true,
            headers: {
                ...guardedHeaders,
                'Retry-After': writeLimitCheck.retryAfter.toString(),
            },
        });
    }

    try {
        const reservation = await reserveIdempotentRequest({
            supabaseAdmin: routeSupabase,
            userId: user.id,
            action: 'quiz_submission',
            idempotencyKey,
            payload: {
                term_id,
                is_correct,
                response_time_ms,
                quiz_type,
                occurred_at: occurred_at ?? null,
                session_id: session_id ?? null,
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

        const { data, error } = await routeSupabase
            .rpc('record_study_event', {
                p_user_id: user.id,
                p_term_id: term_id,
                p_is_correct: is_correct,
                p_response_time_ms: response_time_ms,
                p_quiz_type: quiz_type,
                p_idempotency_key: idempotencyKey,
                p_session_id: session_id ?? null,
                p_session_token_hash: session_token ? hashStudySessionToken(session_token) : null,
                p_occurred_at: occurred_at ?? null,
            });

        if (error) {
            logger.error('QUIZ_ROUTE_DB_ERROR', {
                requestId,
                route: '/api/record-quiz',
                userId: user.id,
                error,
                retryable: true,
            });

            if ((error.message || '').toLowerCase().includes('favorited')) {
                await markQuizFailure(routeSupabase, user.id, idempotencyKey, 409, {
                    code: 'TERM_NOT_FAVORITED',
                    message: 'Term must be in favorites before review.',
                });
                return errorResponse({
                    status: 409,
                    code: 'TERM_NOT_FAVORITED',
                    message: 'Term must be in favorites before review.',
                    requestId,
                    retryable: false,
                    headers: guardedHeaders,
                });
            }

            const sessionScopedError = getSessionScopedQuizError(error, session_id ?? null);
            if (sessionScopedError) {
                await markQuizFailure(routeSupabase, user.id, idempotencyKey, sessionScopedError.status, {
                    code: sessionScopedError.code,
                    message: sessionScopedError.message,
                });
                return errorResponse({
                    status: sessionScopedError.status,
                    code: sessionScopedError.code,
                    message: sessionScopedError.message,
                    requestId,
                    retryable: false,
                    headers: guardedHeaders,
                });
            }

            await markQuizFailure(routeSupabase, user.id, idempotencyKey, 500, {
                code: 'QUIZ_PERSIST_FAILED',
                message: 'Unable to record quiz attempt.',
            });
            return errorResponse({
                status: 500,
                code: 'QUIZ_PERSIST_FAILED',
                message: 'Unable to record quiz attempt.',
                requestId,
                retryable: true,
                headers: guardedHeaders,
            });
        }

        const responseBody = {
            success: true,
            state: data,
            message: 'Recorded successfully',
        };

        try {
            await completeIdempotentRequest({
                supabaseAdmin: routeSupabase,
                userId: user.id,
                action: 'quiz_submission',
                idempotencyKey,
                statusCode: 200,
                responseBody,
            });
        } catch (error) {
            logger.error('QUIZ_ROUTE_IDEMPOTENCY_COMPLETE_ERROR', {
                requestId,
                route: '/api/record-quiz',
                userId: user.id,
                error: error instanceof Error ? error : undefined,
            });
            try {
                await deleteIdempotentRequest({
                    supabaseAdmin: routeSupabase,
                    userId: user.id,
                    action: 'quiz_submission',
                    idempotencyKey,
                });
            } catch (cleanupError) {
                logger.error('QUIZ_ROUTE_IDEMPOTENCY_DELETE_ERROR', {
                    requestId,
                    route: '/api/record-quiz',
                    userId: user.id,
                    error: cleanupError instanceof Error ? cleanupError : undefined,
                });
            }
        }

        return successResponse(
            responseBody,
            requestId,
            { headers: guardedHeaders }
        );
    } catch (error) {
        if (error instanceof z.ZodError) {
            await markQuizFailure(routeSupabase, user.id, idempotencyKey, 400, {
                code: 'VALIDATION_ERROR',
                message: 'Quiz attempt payload is invalid.',
            });
            return errorResponse({
                status: 400,
                code: 'VALIDATION_ERROR',
                message: 'Quiz attempt payload is invalid.',
                requestId,
                retryable: false,
                headers: guardedHeaders,
            });
        }

        await markQuizFailure(routeSupabase, user.id, idempotencyKey, 500, {
            code: 'QUIZ_PERSIST_FAILED',
            message: 'Unable to record quiz attempt.',
        });
        return handleRouteError(error, {
            requestId,
            code: 'QUIZ_PERSIST_FAILED',
            message: 'Unable to record quiz attempt.',
            timeoutCode: 'QUIZ_UPSTREAM_TIMEOUT',
            timeoutMessage: 'Quiz persistence request timed out.',
            headers: guardedHeaders,
            logLabel: 'QUIZ_ROUTE_FAILED',
        });
    }
}

export async function GET(request: NextRequest) {
    const requestId = createRequestId(request);

    return successResponse(
        {
            status: 'active',
            service: 'FinTechTerms Quiz API',
            rate_limit: '100/min + 20 writes/10s',
            documentation: 'POST /api/record-quiz with an authenticated session',
        },
        requestId,
        { headers: GLOBAL_RATE_LIMIT_HEADERS }
    );
}
