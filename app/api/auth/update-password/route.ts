import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import {
    createRequestId,
    errorResponse,
    handleRouteError,
    successResponse,
} from '@/lib/api-response';
import {
    createAuthRouteClient,
    createAuthUnavailableResponse,
    getAuthRouteHeaders,
} from '@/lib/auth/route-handler';
import { getPublicEnv } from '@/lib/env';
import { supportsPasswordSignIn } from '@/lib/auth/user';

const UpdatePasswordSchema = z.object({
    password: z.string().min(8),
    currentPassword: z.string().min(1).optional(),
});

export async function POST(request: Request) {
    const requestId = createRequestId(request);

    try {
        const body = await request.json();
        const parsed = UpdatePasswordSchema.safeParse(body);

        if (!parsed.success) {
            return errorResponse({
                status: 400,
                code: 'VALIDATION_ERROR',
                message: 'Update-password payload is invalid.',
                requestId,
                retryable: false,
                headers: getAuthRouteHeaders(),
            });
        }

        const authContext = await createAuthRouteClient();
        if (!authContext) {
            return createAuthUnavailableResponse(requestId);
        }
        const { supabase, applyCookies } = authContext;

        const { data: userState, error: userError } = await supabase.auth.getUser();
        if (userError || !userState.user) {
            return errorResponse({
                status: 401,
                code: 'UNAUTHORIZED',
                message: 'Authentication required',
                requestId,
                retryable: false,
                headers: getAuthRouteHeaders(),
            });
        }

        if (!supportsPasswordSignIn(userState.user)) {
            return errorResponse({
                status: 409,
                code: 'PASSWORD_MANAGED_BY_PROVIDER',
                message: 'This account does not use a Supabase email-password credential.',
                requestId,
                retryable: false,
                headers: getAuthRouteHeaders(),
            });
        }

        if (parsed.data.currentPassword) {
            const env = getPublicEnv();
            const verificationClient = createSupabaseClient(
                env.supabaseUrl!,
                env.supabaseAnonKey!,
                {
                    auth: {
                        persistSession: false,
                        autoRefreshToken: false,
                        detectSessionInUrl: false,
                    },
                }
            );
            const { error: signInError } = await verificationClient.auth.signInWithPassword({
                email: userState.user.email ?? '',
                password: parsed.data.currentPassword,
            });

            if (signInError) {
                return errorResponse({
                    status: 400,
                    code: 'CURRENT_PASSWORD_INVALID',
                    message: 'Current password incorrect',
                    requestId,
                    retryable: false,
                    headers: getAuthRouteHeaders(),
                });
            }
        }

        const { error } = await supabase.auth.updateUser({
            password: parsed.data.password,
        });

        if (error) {
            return errorResponse({
                status: 400,
                code: 'UPDATE_PASSWORD_FAILED',
                message: error.message,
                requestId,
                retryable: false,
                headers: getAuthRouteHeaders(),
            });
        }

        return applyCookies(successResponse({ success: true }, requestId, {
            headers: getAuthRouteHeaders(),
        }));
    } catch (error) {
        return handleRouteError(error, {
            requestId,
            code: 'UPDATE_PASSWORD_FAILED',
            message: 'Unable to update the password.',
            retryable: true,
            status: 503,
            headers: getAuthRouteHeaders(),
            logLabel: 'AUTH_UPDATE_PASSWORD_ROUTE_FAILED',
        });
    }
}
