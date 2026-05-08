/**
 * @jest-environment node
 */

const redisStore = new Map<string, unknown>();
const mockRedisGet = jest.fn(async (key: string) => redisStore.get(key) ?? null);
const mockRedisSet = jest.fn(async (
    key: string,
    value: unknown,
    options?: { nx?: boolean; px?: number }
) => {
    if (options?.nx && redisStore.has(key)) {
        return null;
    }

    redisStore.set(key, value);
    return 'OK';
});
const mockRedisDel = jest.fn(async (key: string) => {
    redisStore.delete(key);
    return 1;
});

jest.mock('@upstash/redis', () => ({
    Redis: jest.fn().mockImplementation(() => ({
        get: mockRedisGet,
        set: mockRedisSet,
        del: mockRedisDel,
    })),
}));

jest.mock('@/lib/logger', () => ({
    logger: {
        error: jest.fn(),
    },
}));

describe('distributed study-session idempotency', () => {
    const originalEnv = process.env;

    beforeEach(() => {
        jest.resetModules();
        jest.clearAllMocks();
        redisStore.clear();
        process.env = {
            ...originalEnv,
            NODE_ENV: 'production',
            UPSTASH_REDIS_REST_URL: 'https://redis.example.upstash.io',
            UPSTASH_REDIS_REST_TOKEN: 'upstash-token',
        };
    });

    afterEach(() => {
        process.env = originalEnv;
    });

    it('claims a distributed reservation with SET NX and replays the completed response', async () => {
        const {
            completeEphemeralIdempotentRequest,
            inspectEphemeralIdempotentRequest,
            reserveEphemeralIdempotentRequest,
        } = await import('@/lib/ephemeral-idempotency');
        const reservationPayload = {
            action: 'start',
            anonymousId: 'anon-1',
        };

        const reservation = await reserveEphemeralIdempotentRequest({
            scope: 'study-session:user-1',
            idempotencyKey: 'key-1',
            payload: reservationPayload,
        });

        await completeEphemeralIdempotentRequest({
            scope: 'study-session:user-1',
            idempotencyKey: 'key-1',
            statusCode: 200,
            responseBody: {
                sessionId: 'session-1',
                sessionToken: 'token-1',
            },
        });
        const replay = await inspectEphemeralIdempotentRequest({
            scope: 'study-session:user-1',
            idempotencyKey: 'key-1',
            payload: reservationPayload,
        });

        expect(reservation).toEqual({ kind: 'proceed' });
        expect(mockRedisSet).toHaveBeenCalledWith(
            'study-session:user-1:key-1',
            expect.objectContaining({
                status: 'in_progress',
                statusCode: null,
            }),
            {
                nx: true,
                px: 60000,
            }
        );
        expect(replay).toMatchObject({
            kind: 'replay',
            statusCode: 200,
            isError: false,
            responseBody: {
                sessionId: 'session-1',
                sessionToken: 'token-1',
            },
        });
    });

    it('fails closed in production when the distributed store is not configured', async () => {
        delete process.env.UPSTASH_REDIS_REST_URL;
        delete process.env.UPSTASH_REDIS_REST_TOKEN;

        const {
            IdempotencyStoreUnavailableError,
            inspectEphemeralIdempotentRequest,
        } = await import('@/lib/ephemeral-idempotency');

        await expect(inspectEphemeralIdempotentRequest({
            scope: 'study-session:user-1',
            idempotencyKey: 'key-1',
            payload: { action: 'start' },
        })).rejects.toThrow(IdempotencyStoreUnavailableError);
    });
});
