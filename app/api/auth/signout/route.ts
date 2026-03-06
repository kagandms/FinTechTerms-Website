import { cookies } from 'next/headers';
import { createClient } from '@/utils/supabase/server';
import {
    createRequestId,
    errorResponse,
    handleRouteError,
    successResponse,
} from '@/lib/api-response';

export async function POST(request: Request) {
    const requestId = createRequestId(request);

    try {
        const supabase = await createClient();
        const { error: signOutError } = await supabase.auth.signOut({ scope: 'local' });

        if (signOutError) {
            console.error('SIGN_OUT_ERROR', signOutError);
            return errorResponse({
                status: 500,
                code: 'SIGNOUT_FAILED',
                message: 'Unable to sign out.',
                requestId,
                retryable: true,
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
