import {
    AUTH_REQUIRED_MESSAGE,
    hasRequestAuthCredentials,
    hasRequestAuthCookies,
    isAuthSessionError,
    safeGetSupabaseUser,
} from '@/lib/auth/session';

describe('auth session helpers', () => {
    it('detects Supabase auth cookies and bearer credentials', () => {
        const cookieRequest = {
            headers: {
                get: (name: string) => (
                    name.toLowerCase() === 'cookie'
                        ? 'sb-project-auth-token=abc123; theme=dark'
                        : null
                ),
            },
        } as Request;
        const bearerRequest = {
            headers: {
                get: (name: string) => (
                    name.toLowerCase() === 'authorization'
                        ? 'Bearer token'
                        : null
                ),
            },
        } as Request;

        expect(hasRequestAuthCookies(cookieRequest)).toBe(true);
        expect(hasRequestAuthCredentials(cookieRequest)).toBe(true);
        expect(hasRequestAuthCredentials(bearerRequest)).toBe(true);
    });

    it('recognizes ghost-session style auth errors', () => {
        expect(isAuthSessionError(new Error('Auth session missing!'))).toBe(true);
        expect(isAuthSessionError({ message: 'Invalid Refresh Token: Already Used' })).toBe(true);
        expect(isAuthSessionError(new Error('Some other error'))).toBe(false);
    });

    it('returns the resolved user when Supabase auth succeeds', async () => {
        const user = { id: 'user-1', email: 'test@example.com' };
        const result = await safeGetSupabaseUser({
            auth: {
                getUser: async () => ({
                    data: { user: user as never },
                    error: null,
                }),
            },
        });

        expect(result.user).toEqual(user);
        expect(result.authError).toBe(false);
        expect(result.ghostSession).toBe(false);
        expect(result.message).toBeNull();
    });

    it('marks auth-session errors as ghost sessions', async () => {
        const result = await safeGetSupabaseUser({
            auth: {
                getUser: async () => ({
                    data: { user: null },
                    error: { message: 'Auth session missing!' },
                }),
            },
        });

        expect(result.user).toBeNull();
        expect(result.authError).toBe(true);
        expect(result.ghostSession).toBe(true);
        expect(result.message).toBe('Auth session missing!');
    });

    it('returns unauthorized when no user exists and no explicit auth error is provided', async () => {
        const result = await safeGetSupabaseUser({
            auth: {
                getUser: async () => ({
                    data: { user: null },
                    error: null,
                }),
            },
        });

        expect(result.user).toBeNull();
        expect(result.authError).toBe(true);
        expect(result.ghostSession).toBe(false);
        expect(result.message).toBe(AUTH_REQUIRED_MESSAGE);
    });
});
