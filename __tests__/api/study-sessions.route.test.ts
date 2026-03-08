/**
 * @jest-environment node
 */

import { clearEphemeralIdempotencyReservations } from '@/lib/ephemeral-idempotency';
import { studySessionRouteRateLimiter } from '@/lib/rate-limiter';

const mockResolveRequestAuthState = jest.fn();
const mockCreateServiceRoleClient = jest.fn();

jest.mock('@/lib/supabaseAdmin', () => ({
    createServiceRoleClient: () => mockCreateServiceRoleClient(),
    resolveRequestAuthState: (...args: unknown[]) => mockResolveRequestAuthState(...args),
}));

type MockInsertChain = {
    select: jest.Mock<MockSingleChain, [string]>;
};

type MockSingleChain = {
    single: jest.Mock<Promise<{ data: { id: string }; error: null }>, []>;
};

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

describe('study-sessions route', () => {
    let consoleErrorSpy: jest.SpyInstance;

    beforeEach(() => {
        jest.clearAllMocks();
        clearEphemeralIdempotencyReservations();
        studySessionRouteRateLimiter.reset();
        consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
        mockResolveRequestAuthState.mockResolvedValue({
            user: null,
            hadCredentials: false,
            ghostSession: false,
        });
    });

    afterEach(() => {
        consoleErrorSpy.mockRestore();
    });

    it('returns the cached response for duplicate idempotency keys', async () => {
        const insertSingle = jest.fn().mockResolvedValue({
            data: { id: 'session_1' },
            error: null,
        });
        const insertSelect = jest.fn<MockSingleChain, [string]>(() => ({
            single: insertSingle,
        }));
        const insert = jest.fn<MockInsertChain, [Record<string, unknown>]>(() => ({
            select: insertSelect,
        }));

        mockCreateServiceRoleClient.mockReturnValue({
            from: jest.fn(() => ({
                insert,
            })),
        });

        const { POST } = await import('@/app/api/study-sessions/route');

        const firstResponse = await POST(createRequest(createStartPayload()));
        const secondResponse = await POST(createRequest(createStartPayload()));

        expect(firstResponse.status).toBe(200);
        expect(await firstResponse.json()).toEqual({ sessionId: 'session_1' });

        expect(secondResponse.status).toBe(200);
        expect(await secondResponse.json()).toEqual({ sessionId: 'session_1' });
        expect(insert).toHaveBeenCalledTimes(1);
    });

    it('returns 429 after 30 requests in the same minute from one IP', async () => {
        const insertSingle = jest.fn().mockResolvedValue({
            data: { id: 'session_1' },
            error: null,
        });
        const insertSelect = jest.fn<MockSingleChain, [string]>(() => ({
            single: insertSingle,
        }));
        const insert = jest.fn<MockInsertChain, [Record<string, unknown>]>(() => ({
            select: insertSelect,
        }));

        mockCreateServiceRoleClient.mockReturnValue({
            from: jest.fn(() => ({
                insert,
            })),
        });

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
        mockCreateServiceRoleClient.mockReturnValue({
            from: jest.fn(),
        });

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
});
