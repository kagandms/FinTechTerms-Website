/**
 * @jest-environment node
 */

export {};

const mockCreateSupabaseClient = jest.fn((
    _projectUrl?: string,
    _apiKey?: string,
    _options?: Record<string, unknown>
) => ({
    from: jest.fn(),
    rpc: jest.fn(),
}));
const mockCreateServerClient = jest.fn();
const mockGetPublicEnv = jest.fn();
const mockGetServerEnv = jest.fn();
const mockSafeGetSupabaseUser = jest.fn();

jest.mock('@supabase/supabase-js', () => ({
    createClient: (
        projectUrl: string,
        apiKey: string,
        options: Record<string, unknown>
    ) => mockCreateSupabaseClient(projectUrl, apiKey, options),
}));

jest.mock('@/utils/supabase/server', () => ({
    createClient: () => mockCreateServerClient(),
}));

jest.mock('@/lib/env', () => ({
    getPublicEnv: () => mockGetPublicEnv(),
    getServerEnv: () => mockGetServerEnv(),
    hasConfiguredPublicSupabaseEnv: () => true,
}));

jest.mock('@/lib/auth/session', () => ({
    hasRequestAuthCookies: () => false,
    hasRequestAuthCredentials: () => false,
    safeGetSupabaseUser: (...args: unknown[]) => mockSafeGetSupabaseUser(...args),
}));

describe('createServiceRoleClient', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockGetPublicEnv.mockReturnValue({
            supabaseUrl: 'https://project.supabase.co',
            supabaseAnonKey: 'anon-key',
        });
        mockGetServerEnv.mockReturnValue({
            supabaseUrl: 'https://project.supabase.co',
            serviceRoleKey: 'service-role-key',
        });
    });

    it('creates a service-role client only for allowlisted routes', async () => {
        const { createServiceRoleClient } = await import('@/lib/supabaseAdmin');

        createServiceRoleClient({
            route: 'POST /api/favorites',
        });

        expect(mockCreateSupabaseClient).toHaveBeenCalledTimes(1);
        expect(mockCreateSupabaseClient).toHaveBeenCalledWith(
            'https://project.supabase.co',
            'service-role-key',
            expect.any(Object)
        );
    });

    it('rejects non-allowlisted route labels', async () => {
        const { createServiceRoleClient } = await import('@/lib/supabaseAdmin');

        expect(() => createServiceRoleClient({
            route: 'POST /api/unknown' as never,
        })).toThrow('Service role client is not allowlisted for POST /api/unknown.');
    });
});
