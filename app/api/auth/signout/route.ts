import { cookies } from 'next/headers';
import { createClient } from '@/utils/supabase/server';
import {
    createRequestId,
    errorResponse,
    handleRouteError,
    successResponse,
} from '@/lib/api-response';
import { isAuthSessionError } from '@/lib/auth/session';

export async function POST(request: Request) {
    const requestId = createRequestId(request);

    try {
        try {
            const supabase = await createClient();
            const { error: signOutError } = await supabase.auth.signOut({ scope: 'local' });

            if (signOutError && !isAuthSessionError(signOutError)) {
                console.error('SIGN_OUT_ERROR', signOutError);
                return errorResponse({
                    status: 500,
                    code: 'SIGNOUT_FAILED',
                    message: 'Unable to sign out.',
                    requestId,
                    retryable: true,
                });
            }

            if (signOutError) {
                console.warn('SIGN_OUT_GHOST_SESSION_RECOVERED', signOutError);
            }
        } catch (error) {
            if (!isAuthSessionError(error)) {
                throw error;
            }

            console.warn('SIGN_OUT_GHOST_SESSION_EXCEPTION_RECOVERED', error);
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
