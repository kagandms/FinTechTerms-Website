import {
    getSupabaseUserDisplayName,
    getSupabaseUserNameSeed,
    getSupabaseUserProviders,
    mapSupabaseUser,
    supportsPasswordSignIn,
} from '@/lib/auth/user';

describe('auth user helpers', () => {
    it('extracts and deduplicates auth providers', () => {
        const providers = getSupabaseUserProviders({
            app_metadata: {
                provider: 'email',
                providers: ['email', 'google', 'email'],
            },
        } as never);

        expect(providers).toEqual(['email', 'google']);
        expect(supportsPasswordSignIn({
            email: null,
            app_metadata: {
                provider: 'email',
                providers: ['email'],
            },
        } as never)).toBe(false);
    });

    it('prefers metadata names and falls back safely when email is absent', () => {
        expect(getSupabaseUserNameSeed({
            user_metadata: {
                full_name: 'FinTech User',
            },
            email: null,
        } as never)).toBe('FinTech User');

        expect(getSupabaseUserDisplayName({
            id: 'f2d0d1ab-1234-5678-9999-abcdef123456',
            user_metadata: {},
            email: null,
        } as never)).toBe('User f2d0d1');
    });

    it('maps Supabase users without requiring an email address', () => {
        const mappedUser = mapSupabaseUser({
            id: 'user-123',
            email: null,
            created_at: '2026-03-07T00:00:00.000Z',
            user_metadata: {
                preferred_username: 'community_user',
            },
            app_metadata: {
                provider: 'google',
                providers: ['google'],
            },
        } as never);

        expect(mappedUser.id).toBe('user-123');
        expect(mappedUser.email).toBeNull();
        expect(mappedUser.name).toBe('community_user');
        expect(mappedUser.primaryProvider).toBe('google');
        expect(mappedUser.providers).toEqual(['google']);
    });

    it('treats email-password accounts as password-capable and user-facing', () => {
        expect(supportsPasswordSignIn({
            email: 'ada@example.com',
            app_metadata: {
                provider: 'email',
                providers: ['email'],
            },
        } as never)).toBe(true);

        const mappedUser = mapSupabaseUser({
            id: 'user-456',
            email: 'ada@example.com',
            created_at: '2026-03-08T00:00:00.000Z',
            user_metadata: {
                full_name: 'Ada Lovelace',
            },
            app_metadata: {
                provider: 'email',
                providers: ['email'],
            },
        } as never);

        expect(mappedUser.email).toBe('ada@example.com');
        expect(mappedUser.name).toBe('Ada Lovelace');
    });
});
