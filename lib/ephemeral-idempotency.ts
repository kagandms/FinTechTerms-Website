import 'server-only';

import { createHash } from 'node:crypto';
import { Redis } from '@upstash/redis';
import { logger } from '@/lib/logger';

type EphemeralReservationStatus = 'in_progress' | 'completed';

interface EphemeralReservationEntry {
    requestHash: string;
    status: EphemeralReservationStatus;
    statusCode: number | null;
    responseBody: unknown;
    isError: boolean;
    expiresAt: number;
}

interface ReservationBase {
    scope: string;
    idempotencyKey: string;
    payload: unknown;
    ttlMs?: number;
}

interface FinalizeReservation {
    scope: string;
    idempotencyKey: string;
    statusCode: number;
    responseBody: unknown;
    ttlMs?: number;
}

export type EphemeralIdempotencyCheck =
    | { kind: 'proceed' }
    | { kind: 'replay'; responseBody: unknown; statusCode: number; isError: boolean }
    | { kind: 'conflict'; code: 'IDEMPOTENCY_KEY_REUSED' | 'REQUEST_IN_PROGRESS'; message: string };

const DEFAULT_TTL_MS = 60_000;
const reservations = new Map<string, EphemeralReservationEntry>();
let redisClient: Redis | null = null;

export class IdempotencyStoreUnavailableError extends Error {
    constructor(message = 'Distributed idempotency store is unavailable.') {
        super(message);
        this.name = 'IdempotencyStoreUnavailableError';
    }
}

const hashPayload = (payload: unknown): string => createHash('sha256')
    .update(JSON.stringify(payload))
    .digest('hex');

const getScopedKey = (scope: string, idempotencyKey: string) => `${scope}:${idempotencyKey}`;
const isProductionRuntime = (): boolean => process.env.NODE_ENV === 'production';

const hasUpstashConfig = (): boolean => (
    typeof process.env.UPSTASH_REDIS_REST_URL === 'string'
    && process.env.UPSTASH_REDIS_REST_URL.trim().length > 0
    && typeof process.env.UPSTASH_REDIS_REST_TOKEN === 'string'
    && process.env.UPSTASH_REDIS_REST_TOKEN.trim().length > 0
);

const createDistributedClient = (): Redis | null => {
    if (process.env.NODE_ENV === 'test' || !hasUpstashConfig()) {
        return null;
    }

    if (!redisClient) {
        redisClient = new Redis({
            url: process.env.UPSTASH_REDIS_REST_URL!,
            token: process.env.UPSTASH_REDIS_REST_TOKEN!,
        });
    }

    return redisClient;
};

const logDistributedStoreFailure = (operation: string, error: unknown): void => {
    logger.error('STUDY_SESSION_IDEMPOTENCY_STORE_UNAVAILABLE', {
        route: 'study-session-idempotency',
        operation,
        error: error instanceof Error ? error : undefined,
        retryable: true,
    });
};

const cleanupExpiredReservations = (now: number) => {
    for (const [key, entry] of reservations.entries()) {
        if (entry.expiresAt <= now) {
            reservations.delete(key);
        }
    }
};

const isReservationEntry = (value: unknown): value is EphemeralReservationEntry => {
    if (!value || typeof value !== 'object') {
        return false;
    }

    const candidate = value as Partial<EphemeralReservationEntry>;
    return (
        typeof candidate.requestHash === 'string'
        && (candidate.status === 'in_progress' || candidate.status === 'completed')
        && (typeof candidate.statusCode === 'number' || candidate.statusCode === null)
        && typeof candidate.isError === 'boolean'
    );
};

const inspectReservationEntry = (
    existingReservation: EphemeralReservationEntry | null,
    requestHash: string
): EphemeralIdempotencyCheck => {
    if (!existingReservation) {
        return { kind: 'proceed' };
    }

    if (existingReservation.requestHash !== requestHash) {
        return {
            kind: 'conflict',
            code: 'IDEMPOTENCY_KEY_REUSED',
            message: 'This idempotency key is already bound to a different request.',
        };
    }

    if (existingReservation.status === 'completed' && existingReservation.statusCode !== null) {
        return {
            kind: 'replay',
            responseBody: existingReservation.responseBody,
            statusCode: existingReservation.statusCode,
            isError: existingReservation.isError,
        };
    }

    return {
        kind: 'conflict',
        code: 'REQUEST_IN_PROGRESS',
        message: 'An identical request is already being processed.',
    };
};

const getMemoryReservation = (scopedKey: string): EphemeralReservationEntry | null => {
    const now = Date.now();
    cleanupExpiredReservations(now);

    return reservations.get(scopedKey) ?? null;
};

const setMemoryReservation = (
    scopedKey: string,
    entry: EphemeralReservationEntry
): void => {
    reservations.set(scopedKey, entry);
};

const reserveMemoryReservation = (
    scopedKey: string,
    entry: EphemeralReservationEntry
): boolean => {
    const now = Date.now();
    cleanupExpiredReservations(now);

    if (reservations.has(scopedKey)) {
        return false;
    }

    reservations.set(scopedKey, entry);
    return true;
};

const createInProgressEntry = (
    requestHash: string,
    ttlMs: number
): EphemeralReservationEntry => ({
    requestHash,
    status: 'in_progress',
    statusCode: null,
    responseBody: null,
    isError: false,
    expiresAt: Date.now() + ttlMs,
});

const readReservation = async (
    scopedKey: string,
    operation: string
): Promise<EphemeralReservationEntry | null> => {
    const client = createDistributedClient();
    if (!client) {
        if (isProductionRuntime()) {
            throw new IdempotencyStoreUnavailableError(
                'Distributed idempotency store is not configured.'
            );
        }

        return getMemoryReservation(scopedKey);
    }

    try {
        const storedReservation = await client.get<unknown>(scopedKey);
        if (!isReservationEntry(storedReservation)) {
            return null;
        }

        return storedReservation;
    } catch (error) {
        logDistributedStoreFailure(operation, error);
        if (isProductionRuntime()) {
            throw new IdempotencyStoreUnavailableError();
        }

        return getMemoryReservation(scopedKey);
    }
};

const reserveReservation = async (
    scopedKey: string,
    entry: EphemeralReservationEntry,
    ttlMs: number
): Promise<boolean> => {
    const client = createDistributedClient();
    if (!client) {
        if (isProductionRuntime()) {
            throw new IdempotencyStoreUnavailableError(
                'Distributed idempotency store is not configured.'
            );
        }

        return reserveMemoryReservation(scopedKey, entry);
    }

    try {
        const result = await client.set(scopedKey, entry, {
            nx: true,
            px: ttlMs,
        });

        return result === 'OK';
    } catch (error) {
        logDistributedStoreFailure('reserve', error);
        if (isProductionRuntime()) {
            throw new IdempotencyStoreUnavailableError();
        }

        return reserveMemoryReservation(scopedKey, entry);
    }
};

const writeReservation = async (
    scopedKey: string,
    entry: EphemeralReservationEntry,
    ttlMs: number
): Promise<void> => {
    const client = createDistributedClient();
    if (!client) {
        if (isProductionRuntime()) {
            throw new IdempotencyStoreUnavailableError(
                'Distributed idempotency store is not configured.'
            );
        }

        setMemoryReservation(scopedKey, {
            ...entry,
            expiresAt: Date.now() + ttlMs,
        });
        return;
    }

    try {
        await client.set(scopedKey, {
            ...entry,
            expiresAt: Date.now() + ttlMs,
        }, {
            px: ttlMs,
        });
    } catch (error) {
        logDistributedStoreFailure('complete', error);
        if (isProductionRuntime()) {
            throw new IdempotencyStoreUnavailableError();
        }

        setMemoryReservation(scopedKey, {
            ...entry,
            expiresAt: Date.now() + ttlMs,
        });
    }
};

const deleteReservation = async (
    scopedKey: string
): Promise<void> => {
    const client = createDistributedClient();
    if (!client) {
        reservations.delete(scopedKey);
        return;
    }

    try {
        await client.del(scopedKey);
    } catch (error) {
        logDistributedStoreFailure('delete', error);
        if (isProductionRuntime()) {
            throw new IdempotencyStoreUnavailableError();
        }

        reservations.delete(scopedKey);
    }
};

export const inspectEphemeralIdempotentRequest = async ({
    scope,
    idempotencyKey,
    payload,
}: ReservationBase): Promise<EphemeralIdempotencyCheck> => {
    const requestHash = hashPayload(payload);
    const scopedKey = getScopedKey(scope, idempotencyKey);
    const existingReservation = await readReservation(scopedKey, 'inspect');

    return inspectReservationEntry(existingReservation, requestHash);
};

export const reserveEphemeralIdempotentRequest = async ({
    scope,
    idempotencyKey,
    payload,
    ttlMs = DEFAULT_TTL_MS,
}: ReservationBase): Promise<EphemeralIdempotencyCheck> => {
    const requestHash = hashPayload(payload);
    const scopedKey = getScopedKey(scope, idempotencyKey);
    const entry = createInProgressEntry(requestHash, ttlMs);
    const claimed = await reserveReservation(scopedKey, entry, ttlMs);

    if (claimed) {
        return { kind: 'proceed' };
    }

    const existingReservation = await readReservation(scopedKey, 'reserve-conflict');
    return inspectReservationEntry(existingReservation, requestHash);
};

export const completeEphemeralIdempotentRequest = async ({
    scope,
    idempotencyKey,
    statusCode,
    responseBody,
    ttlMs = DEFAULT_TTL_MS,
}: FinalizeReservation): Promise<void> => {
    const scopedKey = getScopedKey(scope, idempotencyKey);
    const existingReservation = await readReservation(scopedKey, 'complete-read');

    if (!existingReservation) {
        return;
    }

    await writeReservation(scopedKey, {
        ...existingReservation,
        status: 'completed',
        statusCode,
        responseBody,
        isError: statusCode >= 500,
        expiresAt: Date.now() + ttlMs,
    }, ttlMs);
};

export const deleteEphemeralIdempotentRequest = async (
    scope: string,
    idempotencyKey: string
): Promise<void> => {
    await deleteReservation(getScopedKey(scope, idempotencyKey));
};

export const clearEphemeralIdempotencyReservations = (): void => {
    reservations.clear();
};
