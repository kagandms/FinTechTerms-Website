/**
 * @jest-environment node
 */

import { clearEphemeralIdempotencyReservations } from '@/lib/ephemeral-idempotency';
import { studySessionRouteRateLimiter } from '@/lib/rate-limiter';

const mockResolveRequestAuthState = jest.fn();
const mockCreateServiceRoleClient = jest.fn();
const mockHasConfiguredServiceRoleEnv = jest.fn();

jest.mock('@/lib/supabaseAdmin', () => ({
    createServiceRoleClient: () => mockCreateServiceRoleClient(),
    resolveRequestAuthState: (...args: unknown[]) => mockResolveRequestAuthState(...args),
}));

jest.mock('@/lib/env', () => ({
    hasConfiguredServiceRoleEnv: () => mockHasConfiguredServiceRoleEnv(),
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
    insertSingleResult?: { data: { id: string } | null; error: { code?: string } | null };
    existingSessionId?: string | null;
    updateResult?: { error: { code?: string } | null };
}) => {
    const insertSingle = jest.fn().mockResolvedValue(
        options?.insertSingleResult ?? {
            data: { id: 'session_1' },
            error: null,
        }
    );
    const maybeSingle = jest.fn().mockResolvedValue({
        data: options?.existingSessionId ? { id: options.existingSessionId } : null,
        error: null,
    });
    const updateEq = jest.fn().mockResolvedValue(
        options?.updateResult ?? { error: null }
    );

    const from = jest.fn(() => ({
        insert: jest.fn(() => ({
            select: jest.fn(() => ({
                single: insertSingle,
            })),
        })),
        select: jest.fn(() => ({
            eq: jest.fn(() => ({
                eq: jest.fn(() => ({
                    maybeSingle,
                })),
                maybeSingle,
            })),
            maybeSingle,
        })),
        update: jest.fn(() => ({
            eq: updateEq,
        })),
    }));

    return {
        client: { from },
        insertSingle,
        maybeSingle,
        updateEq,
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
        mockHasConfiguredServiceRoleEnv.mockReturnValue(true);
        mockResolveRequestAuthState.mockResolvedValue({
            user: null,
            hadCredentials: false,
            ghostSession: false,
        });
    });

    afterEach(() => {
        consoleErrorSpy.mockRestore();
        consoleWarnSpy.mockRestore();
    });

    it('returns the cached response for duplicate idempotency keys', async () => {
        const { client, insertSingle } = createStudySessionClient();
        mockCreateServiceRoleClient.mockReturnValue(client);

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
        expect(insertSingle).toHaveBeenCalledTimes(1);
    });

    it('returns 429 after 30 requests in the same minute from one IP', async () => {
        const { client } = createStudySessionClient();
        mockCreateServiceRoleClient.mockReturnValue(client);

        const { POST } = await import('@/app/api/study-sessions/route');

        for (let index = 0; index < 30; index += 1) {
            const response = await POST(createRequest(createStartPayload({
                idempotency_key: `550e8400-e29b-41d4-a716-4466554400${index.toString().padStart(2, '0')}`,
            })));
            expect(response.status).toBe(200);
        }

        const limitedResponse = await POST(createRequest(createStartPayload({
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
        mockCreateServiceRoleClient.mockReturnValue(client);

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

    it('reissues a session token when the durable unique index rejects a duplicate start', async () => {
        const { client, insertSingle, maybeSingle, updateEq } = createStudySessionClient({
            insertSingleResult: {
                data: null,
                error: { code: '23505' },
            },
            existingSessionId: 'session_existing',
        });
        mockCreateServiceRoleClient.mockReturnValue(client);

        const { POST } = await import('@/app/api/study-sessions/route');
        const response = await POST(createRequest(createStartPayload()));
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body).toMatchObject({
            sessionId: 'session_existing',
            sessionToken: expect.any(String),
        });
        expect(insertSingle).toHaveBeenCalledTimes(1);
        expect(maybeSingle).toHaveBeenCalledTimes(1);
        expect(updateEq).toHaveBeenCalledTimes(1);
    });

    it('retries the same idempotency key after a cached 500 error', async () => {
        const { client, insertSingle } = createStudySessionClient({
            insertSingleResult: {
                data: null,
                error: { code: 'XX000' },
            },
        });

        insertSingle
            .mockResolvedValueOnce({
                data: null,
                error: { code: 'XX000' },
            })
            .mockResolvedValueOnce({
                data: { id: 'session_retry_success' },
                error: null,
            });

        mockCreateServiceRoleClient.mockReturnValue(client);

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
        expect(insertSingle).toHaveBeenCalledTimes(2);
    });

    it('does not retry the same idempotency key after a cached 401 error', async () => {
        const { client, insertSingle } = createStudySessionClient();

        mockResolveRequestAuthState.mockResolvedValue({
            user: null,
            hadCredentials: true,
            ghostSession: false,
        });
        mockCreateServiceRoleClient.mockReturnValue(client);

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
        expect(insertSingle).not.toHaveBeenCalled();
    });

    it('requires sessionToken on follow-up study-session writes', async () => {
        const { client } = createStudySessionClient();
        mockCreateServiceRoleClient.mockReturnValue(client);

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

    it('returns a non-retryable disabled response when service-role env is unavailable', async () => {
        mockHasConfiguredServiceRoleEnv.mockReturnValue(false);

        const { POST } = await import('@/app/api/study-sessions/route');
        const response = await POST(createRequest(createStartPayload()));
        const body = await response.json();

        expect(response.status).toBe(503);
        expect(body).toMatchObject({
            code: 'STUDY_SESSION_DISABLED',
            retryable: false,
        });
        expect(mockCreateServiceRoleClient).not.toHaveBeenCalled();
    });
});
