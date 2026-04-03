/**
 * @jest-environment node
 */

import { createHash as createNodeHash } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';

interface InMemoryIdempotencyRow {
    id: string;
    user_id: string;
    action: string;
    idempotency_key: string;
    request_hash: string;
    status: 'in_progress' | 'completed' | 'failed';
    response_code: number | null;
    response_body: unknown;
    updated_at: string;
}

const createHash = (payload: unknown): string => createNodeHash('sha256')
    .update(JSON.stringify(payload))
    .digest('hex');

const createIdempotencyClient = (rowRef: { current: InMemoryIdempotencyRow | null }): SupabaseClient => {
    const buildSelectQuery = (selection: string) => {
        const filters: Record<string, unknown> = {};

        const query = {
            eq(field: string, value: unknown) {
                filters[field] = value;
                return query;
            },
            async maybeSingle() {
                const row = rowRef.current;
                const matches = row && Object.entries(filters).every(([field, value]) => (
                    (row as unknown as Record<string, unknown>)[field] === value
                ));

                if (!matches) {
                    return { data: null, error: null };
                }

                if (selection.trim() === 'id') {
                    return {
                        data: { id: row.id },
                        error: null,
                    };
                }

                return {
                    data: row,
                    error: null,
                };
            },
        };

        return query;
    };

    const buildUpdateQuery = (payload: Record<string, unknown>) => {
        const filters: Record<string, unknown> = {};

        const query = {
            eq(field: string, value: unknown) {
                filters[field] = value;
                return query;
            },
            select(selection: string) {
                return {
                    maybeSingle: async () => {
                        const row = rowRef.current;
                        const matches = row && Object.entries(filters).every(([field, value]) => (
                            (row as unknown as Record<string, unknown>)[field] === value
                        ));

                        if (!matches || !row) {
                            return { data: null, error: null };
                        }

                        rowRef.current = {
                            ...row,
                            ...payload,
                            updated_at: '2026-04-03T12:02:30.000Z',
                        } as InMemoryIdempotencyRow;

                        if (selection.trim() === 'id') {
                            return {
                                data: { id: rowRef.current.id },
                                error: null,
                            };
                        }

                        return {
                            data: rowRef.current,
                            error: null,
                        };
                    },
                };
            },
        };

        return query;
    };

    return {
        from: () => ({
            select: (selection: string) => buildSelectQuery(selection),
            update: (payload: Record<string, unknown>) => buildUpdateQuery(payload),
            insert: async () => ({ error: null }),
        }),
    } as unknown as SupabaseClient;
};

describe('api idempotency', () => {
    it('returns conflict for a fresh in-progress reservation', async () => {
        const payload = { termId: 'term-1' };
        const rowRef = {
            current: {
                id: 'row-1',
                user_id: 'user-1',
                action: 'favorite_mutation',
                idempotency_key: 'key-1',
                request_hash: createHash(payload),
                status: 'in_progress' as const,
                response_code: null,
                response_body: null,
                updated_at: new Date(Date.now() - 60_000).toISOString(),
            },
        };

        const { inspectIdempotentRequest } = await import('@/lib/api-idempotency');
        const result = await inspectIdempotentRequest({
            supabaseAdmin: createIdempotencyClient(rowRef),
            userId: 'user-1',
            action: 'favorite_mutation',
            idempotencyKey: 'key-1',
            payload,
        });

        expect(result).toEqual({
            kind: 'conflict',
            code: 'REQUEST_IN_PROGRESS',
            message: 'An identical request is already being processed.',
        });
    });

    it('treats stale in-progress reservations as claimable', async () => {
        const payload = { termId: 'term-1' };
        const rowRef = {
            current: {
                id: 'row-1',
                user_id: 'user-1',
                action: 'favorite_mutation',
                idempotency_key: 'key-1',
                request_hash: createHash(payload),
                status: 'in_progress' as const,
                response_code: null,
                response_body: null,
                updated_at: new Date(Date.now() - 121_000).toISOString(),
            },
        };

        const { inspectIdempotentRequest, reserveIdempotentRequest } = await import('@/lib/api-idempotency');
        const inspection = await inspectIdempotentRequest({
            supabaseAdmin: createIdempotencyClient(rowRef),
            userId: 'user-1',
            action: 'favorite_mutation',
            idempotencyKey: 'key-1',
            payload,
        });
        const reservation = await reserveIdempotentRequest({
            supabaseAdmin: createIdempotencyClient(rowRef),
            userId: 'user-1',
            action: 'favorite_mutation',
            idempotencyKey: 'key-1',
            payload,
        });

        expect(inspection).toEqual({ kind: 'proceed' });
        expect(reservation).toEqual({ kind: 'proceed' });
        expect(rowRef.current).toMatchObject({
            status: 'in_progress',
            response_code: null,
            response_body: null,
            updated_at: '2026-04-03T12:02:30.000Z',
        });
    });

    it('replays completed reservations', async () => {
        const payload = { termId: 'term-1' };
        const rowRef = {
            current: {
                id: 'row-1',
                user_id: 'user-1',
                action: 'favorite_mutation',
                idempotency_key: 'key-1',
                request_hash: createHash(payload),
                status: 'completed' as const,
                response_code: 200,
                response_body: { success: true },
                updated_at: '2026-04-03T12:01:30.000Z',
            },
        };

        const { inspectIdempotentRequest } = await import('@/lib/api-idempotency');
        const result = await inspectIdempotentRequest({
            supabaseAdmin: createIdempotencyClient(rowRef),
            userId: 'user-1',
            action: 'favorite_mutation',
            idempotencyKey: 'key-1',
            payload,
        });

        expect(result).toEqual({
            kind: 'replay',
            statusCode: 200,
            responseBody: { success: true },
        });
    });

    it('rejects different payloads bound to the same key', async () => {
        const rowRef = {
            current: {
                id: 'row-1',
                user_id: 'user-1',
                action: 'favorite_mutation',
                idempotency_key: 'key-1',
                request_hash: createHash({ termId: 'term-1' }),
                status: 'failed' as const,
                response_code: 500,
                response_body: null,
                updated_at: '2026-04-03T12:01:30.000Z',
            },
        };

        const { inspectIdempotentRequest } = await import('@/lib/api-idempotency');
        const result = await inspectIdempotentRequest({
            supabaseAdmin: createIdempotencyClient(rowRef),
            userId: 'user-1',
            action: 'favorite_mutation',
            idempotencyKey: 'key-1',
            payload: { termId: 'term-2' },
        });

        expect(result).toEqual({
            kind: 'conflict',
            code: 'IDEMPOTENCY_KEY_REUSED',
            message: 'This idempotency key is already bound to a different request.',
        });
    });
});
