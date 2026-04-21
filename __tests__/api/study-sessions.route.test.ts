/**
 * @jest-environment node
 */

import { clearEphemeralIdempotencyReservations } from '@/lib/ephemeral-idempotency';
import { studySessionRouteRateLimiter } from '@/lib/rate-limiter';
import { createStudySessionToken, hashStudySessionToken } from '@/lib/study-session-token';

const mockResolveRequestAuthState = jest.fn();
const mockCreateRequestScopedClient = jest.fn();
const mockHasConfiguredStudySessionEnv = jest.fn();

jest.mock('@/lib/supabaseAdmin', () => ({
    createRequestScopedClient: () => mockCreateRequestScopedClient(),
    resolveRequestAuthState: (request: Request) => mockResolveRequestAuthState(request),
}));

jest.mock('@/lib/env', () => ({
    hasConfiguredStudySessionEnv: () => mockHasConfiguredStudySessionEnv(),
    getServerEnv: () => ({
        studySessionTokenSecret: 'test-study-session-token-secret',
    }),
}));

const createRequest = (body: Record<string, unknown>, headers?: Record<string, string>) => new Request(
    'http://localhost:3000/api/study-sessions',
    {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-forwarded-for': '203.0.113.10',
            ...headers,
        },
        body: JSON.stringify(body),
    }
);

const createStartPayload = (overrides: Record<string, unknown> = {}) => ({
    action: 'start',
    anonymousId: 'anon_123',
    deviceType: 'desktop',
    userAgent: 'jest',
    consentGiven: true,
    idempotency_key: '550e8400-e29b-41d4-a716-446655440000',
    ...overrides,
});

const createStudySessionClient = (options?: {
    startResult?: { data: string | null; error: { code?: string; message?: string } | null };
    bindResult?: { error: { code?: string; message?: string } | null };
    updateResult?: { error: { code?: string; message?: string } | null };
}) => {
    const rpc = jest.fn().mockImplementation((name: string) => {
        if (name === 'start_study_session') {
            return Promise.resolve(
                options?.startResult ?? {
                    data: 'session_1',
                    error: null,
                }
            );
        }

        if (name === 'bind_study_session_token') {
            return Promise.resolve(
                options?.bindResult ?? { error: null }
            );
        }

        if (name === 'update_study_session_by_token') {
            return Promise.resolve(
                options?.updateResult ?? { error: null }
            );
        }

        return Promise.resolve({ data: null, error: null });
    });

    return {
        client: { rpc },
        rpc,
    };
};

describe('study-sessions route', () => {
    let consoleErrorSpy: jest.SpyInstance;
    let consoleWarnSpy: jest.SpyInstance;

    beforeEach(() => {
        jest.clearAllMocks();
        clearEphemeralIdempotencyReservations();
        studySessionRouteRateLimiter.reset();
        consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
        consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
        mockHasConfiguredStudySessionEnv.mockReturnValue(true);
        mockResolveRequestAuthState.mockResolvedValue({
            user: null,
            hadCredentials: false,
            ghostSession: false,
        });
        mockCreateRequestScopedClient.mockResolvedValue({ rpc: jest.fn() });
    });

    afterEach(() => {
        consoleErrorSpy.mockRestore();
        consoleWarnSpy.mockRestore();
    });

    it('returns the cached response for duplicate idempotency keys', async () => {
        const { client, rpc } = createStudySessionClient({
            startResult: {
                data: 'session_1',
                error: null,
            },
        });
        mockCreateRequestScopedClient.mockResolvedValue(client);

        const { POST } = await import('@/app/api/study-sessions/route');

        const firstResponse = await POST(createRequest(createStartPayload()));
        const firstBody = await firstResponse.json();
        const secondResponse = await POST(createRequest(createStartPayload()));
        const secondBody = await secondResponse.json();

        expect(firstResponse.status).toBe(200);
        expect(firstBody).toMatchObject({
            sessionId: 'session_1',
            sessionToken: expect.any(String),
        });

        expect(secondResponse.status).toBe(200);
        expect(secondBody).toEqual(firstBody);
        expect(rpc).toHaveBeenCalledWith('start_study_session', expect.objectContaining({
            p_anonymous_id: 'anon_123',
        }));
        expect(rpc).toHaveBeenCalledWith('bind_study_session_token', expect.objectContaining({
            p_anonymous_id: 'anon_123',
        }));
    });

    it('returns 503 when the study-session runtime env is incomplete', async () => {
        mockHasConfiguredStudySessionEnv.mockReturnValue(false);

        const { POST } = await import('@/app/api/study-sessions/route');
        const response = await POST(createRequest(createStartPayload()));
        const body = await response.json();

        expect(response.status).toBe(503);
        expect(body).toMatchObject({
            code: 'STUDY_SESSION_DISABLED',
            retryable: false,
        });
        expect(mockCreateRequestScopedClient).not.toHaveBeenCalled();
    });

    it('does not leak an in-progress reservation when the request-scoped client is unavailable', async () => {
        const { client } = createStudySessionClient({
            startResult: {
                data: 'session_after_retry',
                error: null,
            },
        });
        mockCreateRequestScopedClient
            .mockResolvedValueOnce(null)
            .mockResolvedValue(client);

        const payload = createStartPayload({
            idempotency_key: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        });
        const { POST } = await import('@/app/api/study-sessions/route');

        const firstResponse = await POST(createRequest(payload));
        const firstBody = await firstResponse.json();
        const secondResponse = await POST(createRequest(payload));
        const secondBody = await secondResponse.json();

        expect(firstResponse.status).toBe(503);
        expect(firstBody).toMatchObject({
            code: 'STUDY_SESSION_FAILED',
            retryable: true,
        });

        expect(secondResponse.status).toBe(200);
        expect(secondBody).toMatchObject({
            sessionId: 'session_after_retry',
            sessionToken: expect.any(String),
        });
    });

    it('returns 503 when the study-session rate limiter is unavailable', async () => {
        jest.spyOn(studySessionRouteRateLimiter, 'check').mockResolvedValueOnce({
            allowed: false,
            remaining: 0,
            retryAfter: 60,
            unavailable: true,
        });

        const { POST } = await import('@/app/api/study-sessions/route');
        const response = await POST(createRequest(createStartPayload()));
        const body = await response.json();

        expect(response.status).toBe(503);
        expect(body).toMatchObject({
            code: 'RATE_LIMITER_UNAVAILABLE',
            retryable: true,
        });
        expect(mockCreateRequestScopedClient).not.toHaveBeenCalled();
    });

    it('returns 429 after 30 anonymous start requests from one IP even when anonymousId changes', async () => {
        const { client } = createStudySessionClient();
        mockCreateRequestScopedClient.mockResolvedValue(client);

        const { POST } = await import('@/app/api/study-sessions/route');

        for (let index = 0; index < 30; index += 1) {
            const response = await POST(createRequest(createStartPayload({
                anonymousId: `anon_${index}`,
                idempotency_key: `550e8400-e29b-41d4-a716-4466554400${index.toString().padStart(2, '0')}`,
            })));
            expect(response.status).toBe(200);
        }

        const limitedResponse = await POST(createRequest(createStartPayload({
            anonymousId: 'anon_overflow',
            idempotency_key: '550e8400-e29b-41d4-a716-446655440099',
        })));
        const limitedBody = await limitedResponse.json();

        expect(limitedResponse.status).toBe(429);
        expect(limitedResponse.headers.get('Retry-After')).toBeTruthy();
        expect(limitedBody).toMatchObject({
            code: 'STUDY_SESSION_RATE_LIMITED',
            message: 'Too many study session requests. Please slow down.',
            retryable: true,
        });
    });

    it('rejects unknown fields because the schema is strict', async () => {
        const { client } = createStudySessionClient();
        mockCreateRequestScopedClient.mockResolvedValue(client);

        const { POST } = await import('@/app/api/study-sessions/route');
        const response = await POST(createRequest({
            ...createStartPayload(),
            unexpected: 'field',
        }));
        const body = await response.json();

        expect(response.status).toBe(400);
        expect(body).toMatchObject({
            code: 'INVALID_STUDY_SESSION_PAYLOAD',
            retryable: false,
        });
    });

    it('replays the deterministic session token for duplicate durable starts', async () => {
        const { client, rpc } = createStudySessionClient({
            startResult: {
                data: 'session_existing',
                error: null,
            },
        });
        mockCreateRequestScopedClient.mockResolvedValue(client);

        const { POST } = await import('@/app/api/study-sessions/route');
        const payload = createStartPayload();
        const response = await POST(createRequest(payload));
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body).toMatchObject({
            sessionId: 'session_existing',
            sessionToken: createStudySessionToken(
                'session_existing',
                payload.idempotency_key
            ),
        });
        expect(rpc).toHaveBeenCalledWith('start_study_session', expect.any(Object));
        expect(rpc).toHaveBeenCalledWith('bind_study_session_token', expect.any(Object));
    });

    it('retries the same idempotency key after a cached 500 error', async () => {
        const { client, rpc } = createStudySessionClient();
        rpc
            .mockResolvedValueOnce({
                data: null,
                error: { code: 'XX000' },
            })
            .mockResolvedValueOnce({
                data: 'session_retry_success',
                error: null,
            })
            .mockResolvedValue({
                error: null,
            });
        mockCreateRequestScopedClient.mockResolvedValue(client);

        const payload = createStartPayload({
            idempotency_key: '11111111-1111-4111-8111-111111111111',
        });
        const { POST } = await import('@/app/api/study-sessions/route');

        const firstResponse = await POST(createRequest(payload));
        const firstBody = await firstResponse.json();
        const secondResponse = await POST(createRequest(payload));
        const secondBody = await secondResponse.json();

        expect(firstResponse.status).toBe(500);
        expect(firstBody).toMatchObject({
            code: 'STUDY_SESSION_FAILED',
            retryable: true,
        });

        expect(secondResponse.status).toBe(200);
        expect(secondBody).toMatchObject({
            sessionId: 'session_retry_success',
            sessionToken: expect.any(String),
        });
        expect(rpc).toHaveBeenCalledWith('start_study_session', expect.any(Object));
    });

    it('does not retry the same idempotency key after a cached 401 error', async () => {
        const { client, rpc } = createStudySessionClient();

        mockResolveRequestAuthState.mockResolvedValue({
            user: null,
            hadCredentials: true,
            ghostSession: false,
        });
        mockCreateRequestScopedClient.mockResolvedValue(client);

        const payload = createStartPayload({
            idempotency_key: '22222222-2222-4222-8222-222222222222',
        });
        const { POST } = await import('@/app/api/study-sessions/route');

        const firstResponse = await POST(createRequest(payload));
        const firstBody = await firstResponse.json();
        const secondResponse = await POST(createRequest(payload));
        const secondBody = await secondResponse.json();

        expect(firstResponse.status).toBe(401);
        expect(firstBody).toMatchObject({
            code: 'UNAUTHORIZED',
            retryable: false,
        });

        expect(secondResponse.status).toBe(401);
        expect(secondBody).toMatchObject({
            code: 'UNAUTHORIZED',
            retryable: false,
        });
        expect(rpc).not.toHaveBeenCalledWith('start_study_session', expect.anything());
    });

    it('requires sessionToken on follow-up study-session writes', async () => {
        const { client } = createStudySessionClient();
        mockCreateRequestScopedClient.mockResolvedValue(client);

        const { POST } = await import('@/app/api/study-sessions/route');
        const response = await POST(createRequest({
            action: 'heartbeat',
            sessionId: '550e8400-e29b-41d4-a716-446655440001',
            durationSeconds: 12,
            pageViews: 2,
            quizAttempts: 1,
            idempotency_key: '550e8400-e29b-41d4-a716-446655440002',
        }));
        const body = await response.json();

        expect(response.status).toBe(400);
        expect(body).toMatchObject({
            code: 'INVALID_STUDY_SESSION_PAYLOAD',
            retryable: false,
        });
    });

    it('allows ghost-session heartbeat writes when a valid session token is present', async () => {
        const { client, rpc } = createStudySessionClient();
        mockResolveRequestAuthState.mockResolvedValue({
            user: null,
            hadCredentials: true,
            ghostSession: true,
        });
        mockCreateRequestScopedClient.mockResolvedValue(client);

        const { POST } = await import('@/app/api/study-sessions/route');
        const response = await POST(createRequest({
            action: 'heartbeat',
            sessionId: '550e8400-e29b-41d4-a716-446655440001',
            sessionToken: 'a'.repeat(32),
            durationSeconds: 12,
            pageViews: 4,
            quizAttempts: 2,
            idempotency_key: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        }));
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body).toMatchObject({ success: true });
        expect(rpc).toHaveBeenCalledWith('update_study_session_by_token', {
            p_session_id: '550e8400-e29b-41d4-a716-446655440001',
            p_session_token_hash: hashStudySessionToken('a'.repeat(32)),
            p_duration_seconds: 12,
            p_page_views: 4,
            p_quiz_attempts: 2,
            p_end_session: false,
            p_ended_at: null,
        });
    });

    it('uses token-hash validated monotonic RPC updates for heartbeat writes', async () => {
        const { client, rpc } = createStudySessionClient();
        mockCreateRequestScopedClient.mockResolvedValue(client);

        const { POST } = await import('@/app/api/study-sessions/route');
        const response = await POST(createRequest({
            action: 'heartbeat',
            sessionId: '550e8400-e29b-41d4-a716-446655440001',
            sessionToken: 'a'.repeat(32),
            durationSeconds: 12,
            pageViews: 4,
            quizAttempts: 2,
            idempotency_key: '33333333-3333-4333-8333-333333333333',
        }));
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body).toMatchObject({ success: true });
        expect(rpc).toHaveBeenCalledWith('update_study_session_by_token', {
            p_session_id: '550e8400-e29b-41d4-a716-446655440001',
            p_session_token_hash: hashStudySessionToken('a'.repeat(32)),
            p_duration_seconds: 12,
            p_page_views: 4,
            p_quiz_attempts: 2,
            p_end_session: false,
            p_ended_at: null,
        });
    });

    it('maps token/ownership violations to a 403 follow-up response', async () => {
        const { client } = createStudySessionClient({
            updateResult: {
                error: { code: '42501', message: 'Study session does not belong to this requester.' },
            },
        });
        mockCreateRequestScopedClient.mockResolvedValue(client);

        const { POST } = await import('@/app/api/study-sessions/route');
        const response = await POST(createRequest({
            action: 'heartbeat',
            sessionId: '550e8400-e29b-41d4-a716-446655440001',
            sessionToken: 'a'.repeat(32),
            durationSeconds: 12,
            pageViews: 4,
            quizAttempts: 2,
            idempotency_key: '55555555-5555-4555-8555-555555555555',
        }));
        const body = await response.json();

        expect(response.status).toBe(403);
        expect(body).toMatchObject({
            code: 'STUDY_SESSION_FORBIDDEN',
            retryable: false,
        });
    });

    it('returns a retryable 500 when the atomic metrics RPC fails', async () => {
        const { client } = createStudySessionClient({
            updateResult: {
                error: { message: 'metrics update failed' },
            },
        });
        mockCreateRequestScopedClient.mockResolvedValue(client);

        const { POST } = await import('@/app/api/study-sessions/route');
        const response = await POST(createRequest({
            action: 'heartbeat',
            sessionId: '550e8400-e29b-41d4-a716-446655440001',
            sessionToken: 'a'.repeat(32),
            durationSeconds: 12,
            pageViews: 4,
            quizAttempts: 2,
            idempotency_key: '44444444-4444-4444-8444-444444444444',
        }));
        const body = await response.json();

        expect(response.status).toBe(500);
        expect(body).toMatchObject({
            code: 'STUDY_SESSION_FAILED',
            retryable: true,
        });
    });

    it('uses a request-scoped client for public study-session writes', async () => {
        const { client } = createStudySessionClient();
        mockCreateRequestScopedClient.mockResolvedValue(client);

        const { POST } = await import('@/app/api/study-sessions/route');
        const response = await POST(createRequest(createStartPayload()));

        expect(response.status).toBe(200);
        expect(mockCreateRequestScopedClient).toHaveBeenCalledTimes(1);
    });
});
