import 'server-only';

import { createHash } from 'node:crypto';

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

const hashPayload = (payload: unknown): string => createHash('sha256')
    .update(JSON.stringify(payload))
    .digest('hex');

const getScopedKey = (scope: string, idempotencyKey: string) => `${scope}:${idempotencyKey}`;

const cleanupExpiredReservations = (now: number) => {
    for (const [key, entry] of reservations.entries()) {
        if (entry.expiresAt <= now) {
            reservations.delete(key);
        }
    }
};

export const inspectEphemeralIdempotentRequest = ({
    scope,
    idempotencyKey,
    payload,
}: ReservationBase): EphemeralIdempotencyCheck => {
    const now = Date.now();
    cleanupExpiredReservations(now);

    const scopedKey = getScopedKey(scope, idempotencyKey);
    const existingReservation = reservations.get(scopedKey);

    if (!existingReservation) {
        return { kind: 'proceed' };
    }

    const requestHash = hashPayload(payload);
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

export const reserveEphemeralIdempotentRequest = ({
    scope,
    idempotencyKey,
    payload,
    ttlMs = DEFAULT_TTL_MS,
}: ReservationBase): void => {
    const now = Date.now();
    cleanupExpiredReservations(now);

    reservations.set(getScopedKey(scope, idempotencyKey), {
        requestHash: hashPayload(payload),
        status: 'in_progress',
        statusCode: null,
        responseBody: null,
        isError: false,
        expiresAt: now + ttlMs,
    });
};

export const completeEphemeralIdempotentRequest = ({
    scope,
    idempotencyKey,
    statusCode,
    responseBody,
    ttlMs = DEFAULT_TTL_MS,
}: FinalizeReservation): void => {
    const scopedKey = getScopedKey(scope, idempotencyKey);
    const existingReservation = reservations.get(scopedKey);

    if (!existingReservation) {
        return;
    }

    reservations.set(scopedKey, {
        ...existingReservation,
        status: 'completed',
        statusCode,
        responseBody,
        isError: statusCode >= 500,
        expiresAt: Date.now() + ttlMs,
    });
};

export const deleteEphemeralIdempotentRequest = (
    scope: string,
    idempotencyKey: string
): void => {
    reservations.delete(getScopedKey(scope, idempotencyKey));
};

export const clearEphemeralIdempotencyReservations = (): void => {
    reservations.clear();
};
