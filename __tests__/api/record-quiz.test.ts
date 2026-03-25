/**
 * @jest-environment node
 */

import { apiRouteRateLimiter, quizMutationRateLimiter } from '@/lib/rate-limiter';

const mockResolveAuthenticatedUser = jest.fn();
const mockCreateServiceRoleClient = jest.fn();
const mockInspectIdempotentRequest = jest.fn();
const mockReserveIdempotentRequest = jest.fn();
const mockCompleteIdempotentRequest = jest.fn();
const mockFailIdempotentRequest = jest.fn();

jest.mock('@/lib/supabaseAdmin', () => ({
    createServiceRoleClient: () => mockCreateServiceRoleClient(),
    resolveAuthenticatedUser: (...args: unknown[]) => mockResolveAuthenticatedUser(...args),
}));

jest.mock('@/lib/api-idempotency', () => ({
    inspectIdempotentRequest: (...args: unknown[]) => mockInspectIdempotentRequest(...args),
    reserveIdempotentRequest: (...args: unknown[]) => mockReserveIdempotentRequest(...args),
    completeIdempotentRequest: (...args: unknown[]) => mockCompleteIdempotentRequest(...args),
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

describe('record-quiz route', () => {
    let consoleErrorSpy: jest.SpyInstance;

    beforeEach(() => {
        jest.clearAllMocks();
        apiRouteRateLimiter.reset();
        quizMutationRateLimiter.reset();
        consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
        mockResolveAuthenticatedUser.mockResolvedValue({ id: 'user_123' });
        mockInspectIdempotentRequest.mockResolvedValue({ kind: 'proceed' });
        mockReserveIdempotentRequest.mockResolvedValue({ kind: 'proceed' });
        mockCompleteIdempotentRequest.mockResolvedValue(undefined);
        mockFailIdempotentRequest.mockResolvedValue(undefined);
    });

    afterEach(() => {
        consoleErrorSpy.mockRestore();
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
        expect(rpc).toHaveBeenCalledWith('record_study_event', expect.objectContaining({
            p_quiz_type: 'simulation',
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
            p_response_time_ms: 0,
        }));
    });

    it('does not return 200 when idempotency completion fails after the quiz write succeeds', async () => {
        const rpc = jest.fn().mockResolvedValue({
            data: { ok: true },
            error: null,
        });
        mockCreateServiceRoleClient.mockReturnValue({ rpc });
        mockCompleteIdempotentRequest.mockRejectedValueOnce(new Error('idempotency completion failed'));

        const { POST } = await import('@/app/api/record-quiz/route');
        const response = await POST(createRequest(createValidPayload()) as never);
        const body = await response.json();

        expect(response.status).toBe(500);
        expect(body).toMatchObject({
            code: 'QUIZ_PERSIST_FAILED',
            retryable: true,
        });
        expect(mockFailIdempotentRequest).toHaveBeenCalledWith(expect.objectContaining({
            action: 'quiz_submission',
            userId: 'user_123',
            idempotencyKey: '550e8400-e29b-41d4-a716-446655440000',
            statusCode: 500,
        }));
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
});
