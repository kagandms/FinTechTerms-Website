/**
 * Supabase Error Handler Utility
 * Skill: code-refactoring-refactor-clean
 *
 * M52: Centralizes repetitive Supabase error handling into a single helper.
 * Replaces scattered try-catch + ad-hoc error logging + return patterns.
 */

import { PostgrestError } from '@supabase/supabase-js';
import { logger } from '@/lib/logger';

export interface SupabaseResult<T> {
    data: T | null;
    error: string | null;
}

/**
 * Wraps a Supabase query and returns a standardized result.
 * Eliminates repeated try-catch blocks throughout the codebase.
 *
 * @example
 * const { data, error } = await handleSupabaseQuery(
 *   () => supabase.from('terms').select('*'),
 *   'Failed to fetch terms'
 * );
 */
export async function handleSupabaseQuery<T>(
    queryFn: () => Promise<{ data: T | null; error: PostgrestError | null }>,
    context: string = 'Supabase query'
): Promise<SupabaseResult<T>> {
    try {
        const { data, error } = await queryFn();

        if (error) {
            logger.error('SUPABASE_QUERY_FAILED', {
                route: 'handleSupabaseQuery',
                context,
                error: new Error(error.message),
            });
            return { data: null, error: error.message };
        }

        return { data, error: null };
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        logger.error('SUPABASE_QUERY_EXCEPTION', {
            route: 'handleSupabaseQuery',
            context,
            error: err instanceof Error ? err : undefined,
        });
        return { data: null, error: message };
    }
}

/**
 * Standard API error response format (M43).
 * Use this in API routes for consistent error responses.
 */
export function createApiError(code: string, message: string, status: number) {
    return {
        error: { code, message, status },
    };
}

/**
 * Common API error codes
 */
export const API_ERRORS = {
    RATE_LIMITED: (retryAfter: number = 60) =>
        createApiError('RATE_LIMITED', `Too many requests. Try again in ${retryAfter} seconds.`, 429),
    UNAUTHORIZED: () =>
        createApiError('UNAUTHORIZED', 'Authentication required.', 401),
    FORBIDDEN: () =>
        createApiError('FORBIDDEN', 'You do not have permission to perform this action.', 403),
    NOT_FOUND: (resource: string = 'Resource') =>
        createApiError('NOT_FOUND', `${resource} not found.`, 404),
    VALIDATION_ERROR: (details: string) =>
        createApiError('VALIDATION_ERROR', details, 400),
    INTERNAL_ERROR: () =>
        createApiError('INTERNAL_ERROR', 'An unexpected error occurred.', 500),
} as const;
