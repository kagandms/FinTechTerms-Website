import { z } from 'zod';
import {
    createRequestId,
    errorResponse,
    getClientIp,
    handleRouteError,
    successResponse,
} from '@/lib/api-response';
import { AUTH_REQUIRED_MESSAGE } from '@/lib/auth/session';
import { logger } from '@/lib/logger';
import { isAcceptedBirthDate } from '@/lib/profile-birth-date';
import { createRequestScopedClient, resolveAuthenticatedUser } from '@/lib/supabaseAdmin';
import {
    isRateLimiterUnavailable,
    profileMutationRateLimiter,
} from '@/lib/rate-limiter';

const ProfileUpdateSchema = z.object({
    fullName: z.string().trim().min(2).max(120),
    birthDate: z.union([
        z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        z.null(),
    ]),
}).superRefine((value, context) => {
    if (value.birthDate === null || isAcceptedBirthDate(value.birthDate)) {
        return;
    }

    context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Birth date must be a valid calendar date for a user aged 13 to 120.',
        path: ['birthDate'],
    });
});

const PROFILE_RATE_LIMIT_HEADERS = {
    'X-RateLimit-Limit': '10',
    'X-RateLimit-Policy': '10;w=600',
};

const getMetadataSyncTimestamp = (): string => new Date().toISOString();

export async function POST(request: Request) {
    const requestId = createRequestId(request);
    const ip = getClientIp(request);

    try {
        let body: unknown;

        try {
            body = await request.json();
        } catch (error) {
            logger.warn('PROFILE_ROUTE_INVALID_JSON', {
                requestId,
                route: '/api/profile',
                error: error instanceof Error ? error : undefined,
            });
            return errorResponse({
                status: 400,
                code: 'INVALID_JSON',
                message: 'Invalid JSON payload.',
                requestId,
                retryable: false,
            });
        }

        const parsedBody = ProfileUpdateSchema.safeParse(body);
        if (!parsedBody.success) {
            logger.warn('PROFILE_ROUTE_VALIDATION_ERROR', {
                requestId,
                route: '/api/profile',
                validation: parsedBody.error.flatten(),
            });
            return errorResponse({
                status: 400,
                code: 'VALIDATION_ERROR',
                message: 'Profile payload is invalid.',
                requestId,
                retryable: false,
            });
        }

        const user = await resolveAuthenticatedUser(request);
        if (!user) {
            return errorResponse({
                status: 401,
                code: 'UNAUTHORIZED',
                message: AUTH_REQUIRED_MESSAGE,
                requestId,
                retryable: false,
            });
        }

        const limitCheck = await profileMutationRateLimiter.check(user.id);
        if (isRateLimiterUnavailable(limitCheck)) {
            return errorResponse({
                status: 503,
                code: 'RATE_LIMITER_UNAVAILABLE',
                message: 'Profile updates are temporarily unavailable.',
                requestId,
                retryable: true,
                headers: PROFILE_RATE_LIMIT_HEADERS,
            });
        }

        if (!limitCheck.allowed) {
            logger.warn('PROFILE_ROUTE_RATE_LIMITED', {
                requestId,
                route: '/api/profile',
                userId: user.id,
                ip,
            });
            return errorResponse({
                status: 429,
                code: 'RATE_LIMITED',
                message: 'Too many profile updates. Please try again later.',
                requestId,
                retryable: true,
                headers: {
                    ...PROFILE_RATE_LIMIT_HEADERS,
                    'Retry-After': String(limitCheck.retryAfter),
                },
            });
        }

        const supabase = await createRequestScopedClient(request);
        if (!supabase) {
            return errorResponse({
                status: 503,
                code: 'PROFILE_UPDATE_UNAVAILABLE',
                message: 'Unable to update profile right now.',
                requestId,
                retryable: true,
            });
        }

        const { fullName, birthDate } = parsedBody.data;
        const normalizedBirthDate = birthDate ?? null;
        const metadataSyncTimestamp = getMetadataSyncTimestamp();

        const { error: profileError } = await supabase
            .from('profiles')
            .upsert({
                id: user.id,
                full_name: fullName,
                birth_date: normalizedBirthDate,
                metadata_sync_pending: true,
                metadata_sync_error: null,
                metadata_sync_attempted_at: metadataSyncTimestamp,
            }, {
                onConflict: 'id',
            });

        if (profileError) {
            throw profileError;
        }

        const { error: metadataError } = await supabase.auth.updateUser({
            data: {
                name: fullName,
                full_name: fullName,
                birth_date: normalizedBirthDate,
            },
        });

        if (metadataError) {
            const { error: syncFlagError } = await supabase
                .from('profiles')
                .update({
                    metadata_sync_pending: true,
                    metadata_sync_error: metadataError.message ?? 'metadata sync failed',
                })
                .eq('id', user.id);

            logger.warn('PROFILE_ROUTE_METADATA_SYNC_WARNING', {
                requestId,
                route: '/api/profile',
                userId: user.id,
                error: metadataError,
                syncFlagError: syncFlagError instanceof Error ? syncFlagError : undefined,
            });
            return successResponse({
                status: 'partial_metadata_sync',
                message: 'Profile details were saved, but the secondary auth sync did not complete.',
            }, requestId);
        }

        const { error: syncFinalizeError } = await supabase
            .from('profiles')
            .update({
                metadata_sync_pending: false,
                metadata_sync_error: null,
                metadata_synced_at: metadataSyncTimestamp,
            })
            .eq('id', user.id);

        if (syncFinalizeError) {
            logger.warn('PROFILE_ROUTE_METADATA_SYNC_FINALIZE_WARNING', {
                requestId,
                route: '/api/profile',
                userId: user.id,
                error: syncFinalizeError instanceof Error ? syncFinalizeError : undefined,
            });
        }

        return successResponse({
            status: 'ok',
            message: 'Successfully saved',
        }, requestId);
    } catch (error) {
        return handleRouteError(error, {
            requestId,
            code: 'PROFILE_UPDATE_FAILED',
            message: 'Unable to update profile right now.',
            timeoutCode: 'PROFILE_UPDATE_TIMEOUT',
            timeoutMessage: 'Profile update timed out.',
            logLabel: 'PROFILE_ROUTE_FAILED',
        });
    }
}
