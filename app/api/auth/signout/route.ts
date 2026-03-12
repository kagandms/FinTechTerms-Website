import { cookies } from 'next/headers';
import { createOptionalClient } from '@/utils/supabase/server';
import {
    createRequestId,
    errorResponse,
    handleRouteError,
    successResponse,
} from '@/lib/api-response';
import { isAuthSessionError } from '@/lib/auth/session';
import { logger } from '@/lib/logger';

export async function POST(request: Request) {
    const requestId = createRequestId(request);

    try {
        try {
            const supabase = await createOptionalClient();
            const { error: signOutError } = supabase
                ? await supabase.auth.signOut({ scope: 'local' })
                : { error: null };

            if (signOutError && !isAuthSessionError(signOutError)) {
                logger.error('SIGN_OUT_ERROR', {
                    requestId,
                    route: '/api/auth/signout',
                    error: signOutError,
                    retryable: true,
                });
                return errorResponse({
                    status: 500,
                    code: 'SIGNOUT_FAILED',
                    message: 'Unable to sign out.',
                    requestId,
                    retryable: true,
                });
            }

            if (signOutError) {
                logger.warn('SIGN_OUT_GHOST_SESSION_RECOVERED', {
                    requestId,
                    route: '/api/auth/signout',
                    error: signOutError,
                });
            }
        } catch (error) {
            if (!isAuthSessionError(error)) {
                throw error;
            }

            logger.warn('SIGN_OUT_GHOST_SESSION_EXCEPTION_RECOVERED', {
                requestId,
                route: '/api/auth/signout',
                error: error instanceof Error ? error : undefined,
            });
        }

        const cookieStore = await cookies();
        const allCookies = cookieStore.getAll();

        allCookies.forEach((cookie) => {
            if (cookie.name.startsWith('sb-')) {
                cookieStore.delete(cookie.name);
            }
        });

        return successResponse(
            { success: true, message: 'Signed out successfully' },
            requestId
        );
    } catch (error) {
        return handleRouteError(error, {
            requestId,
            code: 'SIGNOUT_FAILED',
            message: 'Unable to sign out.',
            timeoutCode: 'SIGNOUT_TIMEOUT',
            timeoutMessage: 'Sign-out request timed out.',
            logLabel: 'SIGNOUT_ROUTE_FAILED',
        });
    }
}
