import type { User } from '@supabase/supabase-js';

export const AUTH_REQUIRED_MESSAGE = 'Authentication required';

const AUTH_COOKIE_PATTERN = /(?:^|;\s*)sb-[^=]+=/i;
const AUTH_SESSION_ERROR_PATTERNS = [
    'auth session missing',
    'authsessionmissingerror',
    'invalid refresh token',
    'refresh token not found',
    'jwt expired',
    'session not found',
    'session from session_id claim in jwt does not exist',
    'user from sub claim in jwt does not exist',
    'invalid claim: missing sub claim',
];

interface SupabaseUserResult {
    data: {
        user: User | null;
    };
    error: {
        message?: string | null;
        name?: string | null;
    } | null;
}

interface SupabaseAuthClientLike {
    auth: {
        getUser: () => Promise<SupabaseUserResult>;
    };
}

export interface SafeSupabaseUserState {
    user: User | null;
    authError: boolean;
    ghostSession: boolean;
    message: string | null;
}

const normalizeAuthErrorMessage = (error: unknown): string => {
    if (typeof error === 'string') {
        return error.trim();
    }

    if (error && typeof error === 'object') {
        const maybeMessage = 'message' in error ? error.message : null;
        if (typeof maybeMessage === 'string') {
            return maybeMessage.trim();
        }
    }

    return '';
};

export const isAuthSessionError = (error: unknown): boolean => {
    const normalizedMessage = normalizeAuthErrorMessage(error).toLowerCase();
    const normalizedName = (
        error
        && typeof error === 'object'
        && 'name' in error
        && typeof error.name === 'string'
    )
        ? error.name.toLowerCase()
        : '';

    return AUTH_SESSION_ERROR_PATTERNS.some((pattern) => (
        normalizedMessage.includes(pattern) || normalizedName.includes(pattern)
    ));
};

export const hasRequestAuthCookies = (request: Pick<Request, 'headers'>): boolean => (
    AUTH_COOKIE_PATTERN.test(request.headers.get('cookie') || '')
);

export const hasRequestAuthCredentials = (request: Pick<Request, 'headers'>): boolean => {
    const authorization = request.headers.get('authorization');
    return Boolean(authorization?.startsWith('Bearer ')) || hasRequestAuthCookies(request);
};

export const safeGetSupabaseUser = async (
    client: SupabaseAuthClientLike
): Promise<SafeSupabaseUserState> => {
    try {
        const { data, error } = await client.auth.getUser();

        if (error) {
            return {
                user: null,
                authError: true,
                ghostSession: isAuthSessionError(error),
                message: normalizeAuthErrorMessage(error) || AUTH_REQUIRED_MESSAGE,
            };
        }

        if (!data.user) {
            return {
                user: null,
                authError: true,
                ghostSession: false,
                message: AUTH_REQUIRED_MESSAGE,
            };
        }

        return {
            user: data.user,
            authError: false,
            ghostSession: false,
            message: null,
        };
    } catch (error) {
        return {
            user: null,
            authError: true,
            ghostSession: isAuthSessionError(error),
            message: normalizeAuthErrorMessage(error) || AUTH_REQUIRED_MESSAGE,
        };
    }
};
