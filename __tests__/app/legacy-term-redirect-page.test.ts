/**
 * @jest-environment node
 */

const mockCookies = jest.fn();
const mockHeaders = jest.fn();
const mockNotFound = jest.fn(() => {
    throw new Error('NOT_FOUND');
});
const mockPermanentRedirect = jest.fn((_: string) => {
    throw new Error('REDIRECT');
});

jest.mock('next/headers', () => ({
    cookies: () => mockCookies(),
    headers: () => mockHeaders(),
}));

jest.mock('next/navigation', () => ({
    notFound: () => mockNotFound(),
    permanentRedirect: (path: string) => mockPermanentRedirect(path),
}));

describe('legacy term redirect page', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockCookies.mockResolvedValue({
            get: () => undefined,
        });
        mockHeaders.mockResolvedValue(new Headers());
    });

    it('returns notFound when the legacy term id cannot be resolved', async () => {
        const LegacyTermRedirectPage = (await import('@/app/(root)/term/[id]/page')).default;

        await expect(LegacyTermRedirectPage({
            params: Promise.resolve({ id: 'missing-term' }),
            searchParams: Promise.resolve({}),
        })).rejects.toThrow('NOT_FOUND');

        expect(mockNotFound).toHaveBeenCalledTimes(1);
        expect(mockPermanentRedirect).not.toHaveBeenCalled();
    });
});
