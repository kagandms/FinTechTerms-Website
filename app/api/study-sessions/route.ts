import { z } from 'zod';
import {
    createRequestId,
    errorResponse,
    handleRouteError,
    successResponse,
} from '@/lib/api-response';
import { createServiceRoleClient, resolveAuthenticatedUser } from '@/lib/supabaseAdmin';

const SessionActionSchema = z.discriminatedUnion('action', [
    z.object({
        action: z.literal('start'),
        anonymousId: z.string().min(1).nullable().optional(),
        deviceType: z.enum(['mobile', 'tablet', 'desktop', 'unknown']).default('unknown'),
        userAgent: z.string().nullable().optional(),
        consentGiven: z.literal(true),
    }),
    z.object({
        action: z.literal('heartbeat'),
        sessionId: z.string().uuid(),
        anonymousId: z.string().min(1).nullable().optional(),
        durationSeconds: z.number().int().min(0),
        pageViews: z.number().int().min(0),
        quizAttempts: z.number().int().min(0),
    }),
    z.object({
        action: z.literal('end'),
        sessionId: z.string().uuid(),
        anonymousId: z.string().min(1).nullable().optional(),
        durationSeconds: z.number().int().min(0),
        pageViews: z.number().int().min(0),
        quizAttempts: z.number().int().min(0),
    }),
]);

type SessionAction = z.infer<typeof SessionActionSchema>;

const validateSessionOwnership = async (
    supabaseAdmin: ReturnType<typeof createServiceRoleClient>,
    sessionId: string,
    userId: string | null,
    anonymousId?: string | null
) => {
    const { data, error } = await supabaseAdmin
        .from('study_sessions')
        .select('id, user_id, anonymous_id')
        .eq('id', sessionId)
        .maybeSingle();

    if (error) {
        throw error;
    }

    if (!data) {
        return null;
    }

    if (userId && data.user_id === userId) {
        return data;
    }

    if (!userId && anonymousId && data.anonymous_id === anonymousId) {
        return data;
    }

    return false;
};

export async function POST(request: Request) {
    const requestId = createRequestId(request);
    let body: unknown;

    try {
        body = await request.json();
    } catch (error) {
        console.error('POST_STUDY_SESSIONS_INVALID_JSON', error);
        return errorResponse({
            status: 400,
            code: 'INVALID_JSON',
            message: 'Invalid JSON payload.',
            requestId,
            retryable: false,
        });
    }

    const validatedData = SessionActionSchema.safeParse(body);
    if (!validatedData.success) {
        console.error('POST_STUDY_SESSIONS_VALIDATION_ERROR', validatedData.error.flatten());
        return errorResponse({
            status: 400,
            code: 'INVALID_STUDY_SESSION_PAYLOAD',
            message: 'Study session payload is invalid.',
            requestId,
            retryable: false,
        });
    }

    try {
        const user = await resolveAuthenticatedUser(request);
        const supabaseAdmin = createServiceRoleClient();
        const payload = validatedData.data;

        if (payload.action === 'start') {
            const response = await supabaseAdmin
                .from('study_sessions')
                .insert({
                    user_id: user?.id ?? null,
                    anonymous_id: user ? null : payload.anonymousId ?? null,
                    session_start: new Date().toISOString(),
                    device_type: payload.deviceType,
                    user_agent: payload.userAgent ?? null,
                    consent_given: true,
                    consent_timestamp: new Date().toISOString(),
                })
                .select('id')
                .single();

            if (response.error) {
                console.error('POST_STUDY_SESSIONS_START_ERROR', response.error);
                return errorResponse({
                    status: 500,
                    code: 'STUDY_SESSION_START_FAILED',
                    message: 'Unable to start study session.',
                    requestId,
                    retryable: true,
                });
            }

            return successResponse(
                {
                    sessionId: response.data.id,
                },
                requestId
            );
        }

        const ownership = await validateSessionOwnership(
            supabaseAdmin,
            payload.sessionId,
            user?.id ?? null,
            payload.anonymousId
        );

        if (ownership === null) {
            return errorResponse({
                status: 404,
                code: 'STUDY_SESSION_NOT_FOUND',
                message: 'Study session not found.',
                requestId,
                retryable: false,
            });
        }

        if (ownership === false) {
            return errorResponse({
                status: 403,
                code: 'STUDY_SESSION_FORBIDDEN',
                message: 'Study session does not belong to this requester.',
                requestId,
                retryable: false,
            });
        }

        const updatePayload = {
            duration_seconds: payload.durationSeconds,
            page_views: payload.pageViews,
            quiz_attempts: payload.quizAttempts,
            ...(payload.action === 'end' ? { session_end: new Date().toISOString() } : {}),
        };

        const response = await supabaseAdmin
            .from('study_sessions')
            .update(updatePayload)
            .eq('id', payload.sessionId);

        if (response.error) {
            console.error('POST_STUDY_SESSIONS_UPDATE_ERROR', response.error);
            return errorResponse({
                status: 500,
                code: payload.action === 'end'
                    ? 'STUDY_SESSION_END_FAILED'
                    : 'STUDY_SESSION_UPDATE_FAILED',
                message: payload.action === 'end'
                    ? 'Unable to end study session.'
                    : 'Unable to update study session.',
                requestId,
                retryable: true,
            });
        }

        return successResponse(
            {
                success: true,
            },
            requestId
        );
    } catch (error) {
        return handleRouteError(error, {
            requestId,
            code: 'STUDY_SESSION_FAILED',
            message: 'Unable to persist study session.',
            timeoutCode: 'STUDY_SESSION_TIMEOUT',
            timeoutMessage: 'Study session request timed out.',
            logLabel: 'POST_STUDY_SESSIONS_FAILED',
        });
    }
}
