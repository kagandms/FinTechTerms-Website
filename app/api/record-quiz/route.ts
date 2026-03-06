import { NextRequest } from 'next/server';
import { z } from 'zod';
import {
    createRequestId,
    errorResponse,
    handleRouteError,
    successResponse,
    getClientIp,
} from '@/lib/api-response';
import { completeIdempotentRequest, failIdempotentRequest, reserveIdempotentRequest } from '@/lib/api-idempotency';
import { apiRouteRateLimiter, quizMutationRateLimiter } from '@/lib/rate-limiter';
import { createServiceRoleClient, resolveAuthenticatedUser } from '@/lib/supabaseAdmin';
import { QuizAttemptSchema } from '@/lib/validators';

const RecordQuizRequestSchema = QuizAttemptSchema.extend({
    idempotencyKey: z.string().uuid(),
});

const GLOBAL_RATE_LIMIT_HEADERS = {
    'X-RateLimit-Limit': '100',
    'X-RateLimit-Policy': '100;w=60, 20;w=10',
};

const WRITE_RATE_LIMIT = 20;

const markQuizFailure = async (
    routeSupabase: ReturnType<typeof createServiceRoleClient>,
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
        console.error('QUIZ_ROUTE_IDEMPOTENCY_FAIL_ERROR', error);
    }
};

export async function POST(request: NextRequest) {
    const requestId = createRequestId(request);
    const ip = getClientIp(request);
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

    const user = await resolveAuthenticatedUser(request);
    if (!user) {
        return errorResponse({
            status: 401,
            code: 'UNAUTHORIZED',
            message: 'Authentication required.',
            requestId,
            retryable: false,
            headers,
        });
    }

    const writeLimitCheck = quizMutationRateLimiter.check(`${user.id}:${ip}`);
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

    let body: unknown;
    try {
        body = await request.json();
    } catch (error) {
        console.error('QUIZ_ROUTE_INVALID_JSON', error);
        return errorResponse({
            status: 400,
            code: 'INVALID_JSON',
                message: 'Invalid JSON payload.',
                requestId,
                retryable: false,
                headers: guardedHeaders,
            });
    }

    const validatedData = RecordQuizRequestSchema.safeParse(body);
    if (!validatedData.success) {
        console.error('QUIZ_ROUTE_VALIDATION_ERROR', validatedData.error.flatten());
        return errorResponse({
            status: 400,
            code: 'VALIDATION_ERROR',
            message: 'Quiz attempt payload is invalid.',
            requestId,
            retryable: false,
            headers: guardedHeaders,
        });
    }

    const routeSupabase = createServiceRoleClient();
    const {
        term_id,
        is_correct,
        response_time_ms,
        quiz_type,
        idempotencyKey,
    } = validatedData.data;

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
            });

        if (error) {
            console.error('QUIZ_ROUTE_DB_ERROR', error);

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
            console.error('QUIZ_ROUTE_IDEMPOTENCY_COMPLETE_ERROR', error);
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
