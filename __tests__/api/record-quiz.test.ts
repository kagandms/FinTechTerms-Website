/**
 * @jest-environment node
 */

import { apiRouteRateLimiter, quizMutationRateLimiter } from '@/lib/rate-limiter';
import { hashStudySessionToken } from '@/lib/study-session-token';

const mockCreateServiceRoleClient = jest.fn();
const mockResolveRequestMemberEntitlements = jest.fn();
const mockInspectIdempotentRequest = jest.fn();
const mockReserveIdempotentRequest = jest.fn();
const mockCompleteIdempotentRequest = jest.fn();
const mockDeleteIdempotentRequest = jest.fn();
const mockFailIdempotentRequest = jest.fn();

jest.mock('@/lib/supabaseAdmin', () => ({
    createServiceRoleClient: () => mockCreateServiceRoleClient(),
}));

jest.mock('@/lib/server-member-entitlements', () => ({
    resolveRequestMemberEntitlements: (...args: unknown[]) => mockResolveRequestMemberEntitlements(...args),
}));

jest.mock('@/lib/api-idempotency', () => ({
    inspectIdempotentRequest: (...args: unknown[]) => mockInspectIdempotentRequest(...args),
    reserveIdempotentRequest: (...args: unknown[]) => mockReserveIdempotentRequest(...args),
    completeIdempotentRequest: (...args: unknown[]) => mockCompleteIdempotentRequest(...args),
    deleteIdempotentRequest: (...args: unknown[]) => mockDeleteIdempotentRequest(...args),
    failIdempotentRequest: (...args: unknown[]) => mockFailIdempotentRequest(...args),
}));

const createRequest = (body: Record<string, unknown>) => new Request(
    'http://localhost:3000/api/record-quiz',
    {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-forwarded-for': '203.0.113.10',
        },
        body: JSON.stringify(body),
    }
);

const createValidPayload = (overrides: Record<string, unknown> = {}) => ({
    term_id: 'term_123',
    is_correct: true,
    response_time_ms: 1200,
    idempotencyKey: '550e8400-e29b-41d4-a716-446655440000',
    ...overrides,
});

const createMemberState = (overrides: Record<string, unknown> = {}) => ({
    user: { id: 'user_123' },
    entitlements: {
        canUseReviewMode: true,
    },
    unavailable: null,
    ...overrides,
});

describe('record-quiz route', () => {
    let consoleErrorSpy: jest.SpyInstance;
    let consoleWarnSpy: jest.SpyInstance;

    beforeEach(() => {
        jest.clearAllMocks();
        apiRouteRateLimiter.reset();
        quizMutationRateLimiter.reset();
        consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
        consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
        mockResolveRequestMemberEntitlements.mockResolvedValue(createMemberState());
        mockCreateServiceRoleClient.mockReturnValue({ rpc: jest.fn() });
        mockInspectIdempotentRequest.mockResolvedValue({ kind: 'proceed' });
        mockReserveIdempotentRequest.mockResolvedValue({ kind: 'proceed' });
        mockCompleteIdempotentRequest.mockResolvedValue(undefined);
        mockDeleteIdempotentRequest.mockResolvedValue(undefined);
        mockFailIdempotentRequest.mockResolvedValue(undefined);
    });

    afterEach(() => {
        consoleErrorSpy.mockRestore();
        consoleWarnSpy.mockRestore();
        jest.useRealTimers();
    });

    it('rejects invalid payloads via the real route handler', async () => {
        const { POST } = await import('@/app/api/record-quiz/route');
        const response = await POST(createRequest({
            ...createValidPayload(),
            idempotencyKey: undefined,
        }) as never);
        const body = await response.json();

        expect(response.status).toBe(400);
        expect(body).toMatchObject({
            code: 'VALIDATION_ERROR',
            message: 'Quiz attempt payload is invalid.',
            retryable: false,
        });
        expect(mockReserveIdempotentRequest).not.toHaveBeenCalled();
    });

    it('rejects partial study-session context when only session_id is provided', async () => {
        const { POST } = await import('@/app/api/record-quiz/route');
        const response = await POST(createRequest(createValidPayload({
            session_id: '550e8400-e29b-41d4-a716-446655440001',
        })) as never);
        const body = await response.json();

        expect(response.status).toBe(400);
        expect(body).toMatchObject({
            code: 'VALIDATION_ERROR',
            retryable: false,
        });
    });

    it('rejects invalid occurred_at values', async () => {
        const { POST } = await import('@/app/api/record-quiz/route');
        const response = await POST(createRequest(createValidPayload({
            occurred_at: 'not-a-timestamp',
        })) as never);
        const body = await response.json();

        expect(response.status).toBe(400);
        expect(body).toMatchObject({
            code: 'VALIDATION_ERROR',
            retryable: false,
        });
    });

    it('replays cached responses before touching route or write rate limiters', async () => {
        const routeLimitSpy = jest.spyOn(apiRouteRateLimiter, 'check');
        const writeLimitSpy = jest.spyOn(quizMutationRateLimiter, 'check');
        mockInspectIdempotentRequest.mockResolvedValue({
            kind: 'replay',
            statusCode: 200,
            responseBody: {
                success: true,
                state: { cached: true },
                message: 'Recorded successfully',
            },
        });

        const { POST } = await import('@/app/api/record-quiz/route');
        const response = await POST(createRequest(createValidPayload()) as never);
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body).toEqual({
            success: true,
            state: { cached: true },
            message: 'Recorded successfully',
        });
        expect(routeLimitSpy).not.toHaveBeenCalled();
        expect(writeLimitSpy).not.toHaveBeenCalled();
        expect(mockReserveIdempotentRequest).not.toHaveBeenCalled();

        routeLimitSpy.mockRestore();
        writeLimitSpy.mockRestore();
    });

    it('returns cached idempotent responses without calling the database RPC again', async () => {
        const rpc = jest.fn();
        mockCreateServiceRoleClient.mockReturnValue({ rpc });
        mockReserveIdempotentRequest.mockResolvedValue({
            kind: 'replay',
            statusCode: 200,
            responseBody: {
                success: true,
                state: { cached: true },
                message: 'Recorded successfully',
            },
        });

        const { POST } = await import('@/app/api/record-quiz/route');
        const response = await POST(createRequest(createValidPayload()) as never);
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body).toEqual({
            success: true,
            state: { cached: true },
            message: 'Recorded successfully',
        });
        expect(rpc).not.toHaveBeenCalled();
        expect(mockCompleteIdempotentRequest).not.toHaveBeenCalled();
    });

    it('defaults quiz_type to simulation and persists through the RPC payload', async () => {
        const rpc = jest.fn().mockResolvedValue({
            data: { ok: true },
            error: null,
        });
        mockCreateServiceRoleClient.mockReturnValue({ rpc });

        const { POST } = await import('@/app/api/record-quiz/route');
        const response = await POST(createRequest(createValidPayload()) as never);
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body).toEqual({
            success: true,
            state: { ok: true },
            message: 'Recorded successfully',
        });
        expect(mockReserveIdempotentRequest).toHaveBeenCalledWith(expect.objectContaining({
            payload: expect.objectContaining({
                quiz_type: 'simulation',
            }),
        }));
        expect(mockCreateServiceRoleClient).toHaveBeenCalledTimes(1);
        expect(rpc).toHaveBeenCalledWith('record_study_event', expect.objectContaining({
            p_user_id: 'user_123',
            p_quiz_type: 'simulation',
            p_occurred_at: null,
        }));
        expect(mockCompleteIdempotentRequest).toHaveBeenCalledWith(expect.objectContaining({
            responseBody: body,
            statusCode: 200,
        }));
    });

    it('accepts zero-millisecond response times from the quiz client', async () => {
        const rpc = jest.fn().mockResolvedValue({
            data: { ok: true },
            error: null,
        });
        mockCreateServiceRoleClient.mockReturnValue({ rpc });

        const { POST } = await import('@/app/api/record-quiz/route');
        const response = await POST(createRequest(createValidPayload({
            response_time_ms: 0,
        })) as never);
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body).toEqual({
            success: true,
            state: { ok: true },
            message: 'Recorded successfully',
        });
        expect(rpc).toHaveBeenCalledWith('record_study_event', expect.objectContaining({
            p_user_id: 'user_123',
            p_response_time_ms: 0,
        }));
    });

    it('still returns 200 when idempotency completion fails after the quiz write succeeds', async () => {
        const rpc = jest.fn().mockResolvedValue({
            data: { ok: true },
            error: null,
        });
        mockCreateServiceRoleClient.mockReturnValue({ rpc });
        mockCompleteIdempotentRequest.mockRejectedValueOnce(new Error('idempotency completion failed'));

        const { POST } = await import('@/app/api/record-quiz/route');
        const response = await POST(createRequest(createValidPayload()) as never);
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body).toEqual({
            success: true,
            state: { ok: true },
            message: 'Recorded successfully',
        });
        expect(mockDeleteIdempotentRequest).toHaveBeenCalledWith(expect.objectContaining({
            action: 'quiz_submission',
            userId: 'user_123',
            idempotencyKey: '550e8400-e29b-41d4-a716-446655440000',
        }));
        expect(mockFailIdempotentRequest).not.toHaveBeenCalled();
    });

    it('uses the service-role client for trusted quiz writes', async () => {
        const rpc = jest.fn().mockResolvedValue({
            data: { ok: true },
            error: null,
        });
        mockCreateServiceRoleClient.mockReturnValue({ rpc });

        const { POST } = await import('@/app/api/record-quiz/route');
        const response = await POST(createRequest(createValidPayload()) as never);

        expect(response.status).toBe(200);
        expect(mockCreateServiceRoleClient).toHaveBeenCalledTimes(1);
        expect(rpc).toHaveBeenCalledWith('record_study_event', expect.objectContaining({
            p_user_id: 'user_123',
        }));
    });

    it('passes the active study-session context through to the quiz RPC', async () => {
        jest.useFakeTimers().setSystemTime(new Date('2026-03-11T10:00:00.000Z'));
        const rpc = jest.fn().mockResolvedValue({
            data: { ok: true },
            error: null,
        });
        mockCreateServiceRoleClient.mockReturnValue({ rpc });

        const { POST } = await import('@/app/api/record-quiz/route');
        const response = await POST(createRequest(createValidPayload({
            occurred_at: '2026-03-11T09:30:00.000Z',
            session_id: '550e8400-e29b-41d4-a716-446655440001',
            session_token: 'a'.repeat(32),
        })) as never);

        expect(response.status).toBe(200);
        expect(mockReserveIdempotentRequest).toHaveBeenCalledWith(expect.objectContaining({
            payload: expect.objectContaining({
                occurred_at: '2026-03-11T09:30:00.000Z',
                session_id: '550e8400-e29b-41d4-a716-446655440001',
            }),
        }));
        expect(rpc).toHaveBeenCalledWith('record_study_event', expect.objectContaining({
            p_user_id: 'user_123',
            p_occurred_at: '2026-03-11T09:30:00.000Z',
            p_session_id: '550e8400-e29b-41d4-a716-446655440001',
            p_session_token_hash: hashStudySessionToken('a'.repeat(32)),
        }));
    });

    it('drops out-of-window occurred_at values and falls back to server time', async () => {
        jest.useFakeTimers().setSystemTime(new Date('2026-03-11T10:00:00.000Z'));
        const rpc = jest.fn().mockResolvedValue({
            data: { ok: true },
            error: null,
        });
        mockCreateServiceRoleClient.mockReturnValue({ rpc });

        const { POST } = await import('@/app/api/record-quiz/route');
        const response = await POST(createRequest(createValidPayload({
            occurred_at: '2026-03-10T00:00:00.000Z',
        })) as never);

        expect(response.status).toBe(200);
        expect(mockInspectIdempotentRequest).toHaveBeenCalledWith(expect.objectContaining({
            payload: expect.objectContaining({
                occurred_at: null,
            }),
        }));
        expect(mockReserveIdempotentRequest).toHaveBeenCalledWith(expect.objectContaining({
            payload: expect.objectContaining({
                occurred_at: null,
            }),
        }));
        expect(rpc).toHaveBeenCalledWith('record_study_event', expect.objectContaining({
            p_occurred_at: null,
        }));
        expect(consoleWarnSpy).toHaveBeenCalledWith(
            'QUIZ_ROUTE_OCCURRED_AT_OUT_OF_WINDOW',
            expect.objectContaining({
                requestId: expect.any(String),
                route: '/api/record-quiz',
                userId: 'user_123',
                driftDirection: 'past',
            })
        );
    });

    it('returns 404 when the linked study session does not exist', async () => {
        const rpc = jest.fn().mockResolvedValue({
            data: null,
            error: {
                code: 'P0002',
                message: 'Study session not found.',
            },
        });
        mockCreateServiceRoleClient.mockReturnValue({ rpc });

        const { POST } = await import('@/app/api/record-quiz/route');
        const response = await POST(createRequest(createValidPayload({
            session_id: '550e8400-e29b-41d4-a716-446655440001',
            session_token: 'a'.repeat(32),
        })) as never);
        const body = await response.json();

        expect(response.status).toBe(404);
        expect(body).toMatchObject({
            code: 'STUDY_SESSION_NOT_FOUND',
            message: 'Study session not found.',
            retryable: false,
        });
        expect(mockFailIdempotentRequest).toHaveBeenCalledWith(expect.objectContaining({
            statusCode: 404,
            responseBody: {
                code: 'STUDY_SESSION_NOT_FOUND',
                message: 'Study session not found.',
            },
        }));
    });

    it('returns 403 when the linked study session belongs to a different requester', async () => {
        const rpc = jest.fn().mockResolvedValue({
            data: null,
            error: {
                code: '42501',
                message: 'Study session does not belong to this requester.',
            },
        });
        mockCreateServiceRoleClient.mockReturnValue({ rpc });

        const { POST } = await import('@/app/api/record-quiz/route');
        const response = await POST(createRequest(createValidPayload({
            session_id: '550e8400-e29b-41d4-a716-446655440001',
            session_token: 'a'.repeat(32),
        })) as never);
        const body = await response.json();

        expect(response.status).toBe(403);
        expect(body).toMatchObject({
            code: 'STUDY_SESSION_FORBIDDEN',
            message: 'Study session does not belong to this requester.',
            retryable: false,
        });
    });

    it('returns 409 when the idempotency key is already linked to a different study session', async () => {
        const rpc = jest.fn().mockResolvedValue({
            data: null,
            error: {
                code: '23505',
                message: 'Idempotency key already linked to a different study session.',
            },
        });
        mockCreateServiceRoleClient.mockReturnValue({ rpc });

        const { POST } = await import('@/app/api/record-quiz/route');
        const response = await POST(createRequest(createValidPayload({
            session_id: '550e8400-e29b-41d4-a716-446655440001',
            session_token: 'a'.repeat(32),
        })) as never);
        const body = await response.json();

        expect(response.status).toBe(409);
        expect(body).toMatchObject({
            code: 'STUDY_SESSION_CONFLICT',
            message: 'Study session is already linked to a different quiz submission.',
            retryable: false,
        });
    });

    it('returns 503 when the route rate limiter is unavailable', async () => {
        jest.spyOn(apiRouteRateLimiter, 'check').mockResolvedValueOnce({
            allowed: false,
            remaining: 0,
            retryAfter: 60,
            unavailable: true,
        });

        const { POST } = await import('@/app/api/record-quiz/route');
        const response = await POST(createRequest(createValidPayload()) as never);
        const body = await response.json();

        expect(response.status).toBe(503);
        expect(body).toMatchObject({
            code: 'RATE_LIMITER_UNAVAILABLE',
            retryable: true,
        });
        expect(mockReserveIdempotentRequest).not.toHaveBeenCalled();
    });

    it('returns 503 when the service-role client is unavailable', async () => {
        mockCreateServiceRoleClient.mockImplementationOnce(() => {
            throw new Error('service role unavailable');
        });

        const { POST } = await import('@/app/api/record-quiz/route');
        const response = await POST(createRequest(createValidPayload()) as never);
        const body = await response.json();

        expect(response.status).toBe(503);
        expect(body).toMatchObject({
            code: 'QUIZ_PERSIST_FAILED',
            retryable: true,
        });
    });

    it('returns 503 when member entitlements are unavailable', async () => {
        mockResolveRequestMemberEntitlements.mockResolvedValueOnce(createMemberState({
            unavailable: {
                status: 503,
                code: 'MEMBER_STATE_UNAVAILABLE',
                message: 'Member state is temporarily unavailable. Please try again.',
            },
        }));

        const { POST } = await import('@/app/api/record-quiz/route');
        const response = await POST(createRequest(createValidPayload()) as never);
        const body = await response.json();

        expect(response.status).toBe(503);
        expect(body).toMatchObject({
            code: 'MEMBER_STATE_UNAVAILABLE',
            retryable: true,
        });
        expect(mockCreateServiceRoleClient).not.toHaveBeenCalled();
    });

    it('returns 403 when the member account is not allowed to use review mode', async () => {
        mockResolveRequestMemberEntitlements.mockResolvedValueOnce(createMemberState({
            entitlements: {
                canUseReviewMode: false,
            },
        }));

        const { POST } = await import('@/app/api/record-quiz/route');
        const response = await POST(createRequest(createValidPayload()) as never);
        const body = await response.json();

        expect(response.status).toBe(403);
        expect(body).toMatchObject({
            code: 'MEMBER_REQUIRED',
            message: 'Complete your member setup to unlock review mode.',
            retryable: false,
        });
        expect(mockCreateServiceRoleClient).not.toHaveBeenCalled();
    });
});
