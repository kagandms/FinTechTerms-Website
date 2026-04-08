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

const SignupSchema = z.object({
    email: z.string().email(),
    password: z.string().min(8),
    name: z.string().trim().min(2),
    birthDate: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export async function POST(request: Request) {
    const requestId = createRequestId(request);

    try {
        const body = await request.json();
        const parsed = SignupSchema.safeParse(body);

        if (!parsed.success) {
            return errorResponse({
                status: 400,
                code: 'VALIDATION_ERROR',
                message: 'Sign-up payload is invalid.',
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

        const { data, error } = await supabase.auth.signUp({
            email: parsed.data.email,
            password: parsed.data.password,
            options: {
                data: {
                    name: parsed.data.name,
                    birth_date: parsed.data.birthDate,
                },
                emailRedirectTo: undefined,
            },
        });

        if (error) {
            return errorResponse({
                status: 400,
                code: 'SIGNUP_FAILED',
                message: error.message,
                requestId,
                retryable: false,
                headers: getAuthRouteHeaders(),
            });
        }

        if (data.user && !data.session && data.user.identities && data.user.identities.length === 0) {
            return errorResponse({
                status: 409,
                code: 'EMAIL_ALREADY_REGISTERED',
                message: 'This email is already registered. Please log in instead.',
                requestId,
                retryable: false,
                headers: getAuthRouteHeaders(),
            });
        }

        return applyCookies(successResponse({
            success: true,
            needsOTPVerification: Boolean(data.user && !data.session),
        }, requestId, {
            headers: getAuthRouteHeaders(),
        }));
    } catch (error) {
        return handleRouteError(error, {
            requestId,
            code: 'AUTH_SIGNUP_FAILED',
            message: 'Unable to create the account.',
            retryable: true,
            status: 503,
            headers: getAuthRouteHeaders(),
            logLabel: 'AUTH_SIGNUP_ROUTE_FAILED',
        });
    }
}
