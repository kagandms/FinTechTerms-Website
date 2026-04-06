/**
 * @jest-environment node
 */

export {};

const mockRpc = jest.fn();

jest.mock('@supabase/supabase-js', () => ({
    createClient: () => ({
        rpc: (...args: unknown[]) => mockRpc(...args),
    }),
}));

jest.mock('@/lib/env', () => ({
    getPublicEnv: () => ({
        supabaseUrl: 'https://project.supabase.co',
        supabaseAnonKey: 'anon-key',
    }),
    hasConfiguredPublicSupabaseEnv: () => true,
}));

jest.mock('@/lib/api-response', () => ({
    createTimeoutFetch: () => fetch,
}));

describe('public term count catalog helper', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        jest.resetModules();
    });

    it('loads the public term count from the shared DB rpc', async () => {
        mockRpc.mockResolvedValue({
            data: 42,
            error: null,
        });

        const { getPublicTermCount } = await import('@/lib/public-term-catalog');

        await expect(getPublicTermCount()).resolves.toBe(42);
        expect(mockRpc).toHaveBeenCalledWith('get_public_term_count');
    });
});
