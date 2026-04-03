import 'server-only';

import { createHash } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';

type IdempotencyClient = SupabaseClient;

type IdempotencyStatus = 'in_progress' | 'completed' | 'failed';

interface IdempotencyRow {
    id: string;
    request_hash: string;
    status: IdempotencyStatus;
    response_code: number | null;
    response_body: unknown;
    updated_at: string;
}

interface ReservationBase {
    action: string;
    idempotencyKey: string;
    payload: unknown;
    supabaseAdmin: IdempotencyClient;
    userId: string;
}

export type IdempotencyReservation =
    | { kind: 'proceed' }
    | { kind: 'replay'; responseBody: unknown; statusCode: number }
    | { kind: 'conflict'; code: 'IDEMPOTENCY_KEY_REUSED' | 'REQUEST_IN_PROGRESS'; message: string };

interface FinalizeReservation extends Omit<ReservationBase, 'payload'> {
    responseBody: unknown;
    statusCode: number;
}

const IN_PROGRESS: IdempotencyStatus = 'in_progress';
const COMPLETED: IdempotencyStatus = 'completed';
const FAILED: IdempotencyStatus = 'failed';
const STALE_AFTER_MS = 120_000;

const hashPayload = (payload: unknown): string => createHash('sha256')
    .update(JSON.stringify(payload))
    .digest('hex');

const isStaleReservation = (updatedAt: string): boolean => {
    const updatedAtMs = Date.parse(updatedAt);

    if (!Number.isFinite(updatedAtMs)) {
        return false;
    }

    return Date.now() - updatedAtMs >= STALE_AFTER_MS;
};

const getExistingReservation = async (
    supabaseAdmin: IdempotencyClient,
    userId: string,
    action: string,
    idempotencyKey: string
): Promise<IdempotencyRow | null> => {
    const { data, error } = await supabaseAdmin
        .from('api_idempotency_keys')
        .select('id, request_hash, status, response_code, response_body, updated_at')
        .eq('user_id', userId)
        .eq('action', action)
        .eq('idempotency_key', idempotencyKey)
        .maybeSingle();

    if (error) {
        throw error;
    }

    return (data ?? null) as IdempotencyRow | null;
};

const inspectExistingReservation = (
    existingReservation: IdempotencyRow,
    requestHash: string
): IdempotencyReservation => {
    if (existingReservation.request_hash !== requestHash) {
        return {
            kind: 'conflict',
            code: 'IDEMPOTENCY_KEY_REUSED',
            message: 'This idempotency key is already bound to a different request.',
        };
    }

    if (existingReservation.status === COMPLETED && existingReservation.response_code !== null) {
        return {
            kind: 'replay',
            responseBody: existingReservation.response_body,
            statusCode: existingReservation.response_code,
        };
    }

    if (
        existingReservation.status === IN_PROGRESS
        && !isStaleReservation(existingReservation.updated_at)
    ) {
        return {
            kind: 'conflict',
            code: 'REQUEST_IN_PROGRESS',
            message: 'An identical request is already being processed.',
        };
    }

    return { kind: 'proceed' };
};

const interpretExistingReservation = async (
    supabaseAdmin: IdempotencyClient,
    existingReservation: IdempotencyRow,
    requestHash: string,
    action: string,
    userId: string,
    idempotencyKey: string
): Promise<IdempotencyReservation> => {
    const inspection = inspectExistingReservation(existingReservation, requestHash);

    if (inspection.kind !== 'proceed') {
        return inspection;
    }

    const { data, error } = await supabaseAdmin
        .from('api_idempotency_keys')
        .update({
            request_hash: requestHash,
            status: IN_PROGRESS,
            response_code: null,
            response_body: null,
            completed_at: null,
        })
        .eq('id', existingReservation.id)
        .eq('updated_at', existingReservation.updated_at)
        .select('id')
        .maybeSingle();

    if (error) {
        throw error;
    }

    if (data?.id) {
        return { kind: 'proceed' };
    }

    const latestReservation = await getExistingReservation(
        supabaseAdmin,
        userId,
        action,
        idempotencyKey
    );

    if (!latestReservation) {
        throw new Error('Idempotency reservation disappeared during stale-claim recovery.');
    }

    return await interpretExistingReservation(
        supabaseAdmin,
        latestReservation,
        requestHash,
        action,
        userId,
        idempotencyKey
    );
};

export const inspectIdempotentRequest = async ({
    action,
    idempotencyKey,
    payload,
    supabaseAdmin,
    userId,
}: ReservationBase): Promise<IdempotencyReservation> => {
    const requestHash = hashPayload(payload);
    const existingReservation = await getExistingReservation(
        supabaseAdmin,
        userId,
        action,
        idempotencyKey
    );

    if (!existingReservation) {
        return { kind: 'proceed' };
    }

    return inspectExistingReservation(existingReservation, requestHash);
};

export const reserveIdempotentRequest = async ({
    action,
    idempotencyKey,
    payload,
    supabaseAdmin,
    userId,
}: ReservationBase): Promise<IdempotencyReservation> => {
    const requestHash = hashPayload(payload);
    const existingReservation = await getExistingReservation(
        supabaseAdmin,
        userId,
        action,
        idempotencyKey
    );

    if (existingReservation) {
        return interpretExistingReservation(
            supabaseAdmin,
            existingReservation,
            requestHash,
            action,
            userId,
            idempotencyKey
        );
    }

    const { error } = await supabaseAdmin
        .from('api_idempotency_keys')
        .insert({
            user_id: userId,
            action,
            idempotency_key: idempotencyKey,
            request_hash: requestHash,
            status: IN_PROGRESS,
        });

    if (!error) {
        return { kind: 'proceed' };
    }

    if (error.code !== '23505') {
        throw error;
    }

    const concurrentReservation = await getExistingReservation(
        supabaseAdmin,
        userId,
        action,
        idempotencyKey
    );

    if (!concurrentReservation) {
        throw error;
    }

    return interpretExistingReservation(
        supabaseAdmin,
        concurrentReservation,
        requestHash,
        action,
        userId,
        idempotencyKey
    );
};

export const completeIdempotentRequest = async ({
    action,
    idempotencyKey,
    responseBody,
    statusCode,
    supabaseAdmin,
    userId,
}: FinalizeReservation): Promise<void> => {
    const { error } = await supabaseAdmin
        .from('api_idempotency_keys')
        .update({
            status: COMPLETED,
            response_code: statusCode,
            response_body: responseBody,
            completed_at: new Date().toISOString(),
        })
        .eq('user_id', userId)
        .eq('action', action)
        .eq('idempotency_key', idempotencyKey);

    if (error) {
        throw error;
    }
};

export const failIdempotentRequest = async ({
    action,
    idempotencyKey,
    responseBody,
    statusCode,
    supabaseAdmin,
    userId,
}: FinalizeReservation): Promise<void> => {
    const { error } = await supabaseAdmin
        .from('api_idempotency_keys')
        .update({
            status: FAILED,
            response_code: statusCode,
            response_body: responseBody,
            completed_at: new Date().toISOString(),
        })
        .eq('user_id', userId)
        .eq('action', action)
        .eq('idempotency_key', idempotencyKey);

    if (error) {
        throw error;
    }
};

export const deleteIdempotentRequest = async ({
    action,
    idempotencyKey,
    supabaseAdmin,
    userId,
}: Omit<FinalizeReservation, 'responseBody' | 'statusCode'>): Promise<void> => {
    const { error } = await supabaseAdmin
        .from('api_idempotency_keys')
        .delete()
        .eq('user_id', userId)
        .eq('action', action)
        .eq('idempotency_key', idempotencyKey);

    if (error) {
        throw error;
    }
};
