/**
 * @jest-environment node
 */

export {};

const mockListUsers = jest.fn();
const mockFrom = jest.fn();

jest.mock('@/lib/supabaseAdmin', () => ({
    createServiceRoleClient: () => ({
        auth: {
            admin: {
                listUsers: (options: unknown) => mockListUsers(options),
            },
        },
        from: (table: string) => mockFrom(table),
    }),
}));

const createRequest = (body: Record<string, unknown>, seedSecret?: string) => new Request(
    'http://localhost:3000/api/test/e2e/seed-study-state',
    {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            ...(seedSecret ? { 'x-e2e-seed-secret': seedSecret } : {}),
        },
        body: JSON.stringify(body),
    }
);

const createDefaultTableMock = () => (table: string) => {
    if (table === 'terms') {
        return {
            select: () => ({
                in: (column: string, values: string[]) => Promise.resolve({
                    data: values.map((id) => ({ [column]: id })),
                    error: null,
                }),
            }),
        };
    }

    if (table === 'user_progress') {
        return {
            upsert: () => Promise.resolve({ error: null }),
        };
    }

    if (table === 'user_favorites') {
        return {
            delete: () => ({
                eq: () => Promise.resolve({ error: null }),
            }),
            upsert: () => Promise.resolve({ error: null }),
        };
    }

    if (table === 'user_term_srs') {
        return {
            delete: () => ({
                eq: () => Promise.resolve({ error: null }),
            }),
            upsert: () => Promise.resolve({ error: null }),
        };
    }

    if (table === 'quiz_attempts') {
        return {
            delete: () => ({
                eq: () => Promise.resolve({ error: null }),
            }),
        };
    }

    throw new Error(`Unexpected table mock: ${table}`);
};

const installSupabaseTableMock = () => {
    mockFrom.mockImplementation((table: string) => {
        return createDefaultTableMock()(table);
    });
};

describe('e2e seed study state route', () => {
    const originalEnv = process.env;

    beforeEach(() => {
        jest.resetModules();
        jest.clearAllMocks();
        process.env = {
            ...originalEnv,
            NODE_ENV: 'test',
            E2E_SEED_SECRET: 'seed-secret',
        };
        installSupabaseTableMock();
    });

    afterAll(() => {
        process.env = originalEnv;
    });

    it('returns 404 when the route is disabled', async () => {
        delete process.env.E2E_SEED_SECRET;

        const { POST } = await import('@/app/api/test/e2e/seed-study-state/route');
        const response = await POST(createRequest({
            userEmail: 'qa@example.com',
            favoriteTermIds: ['term_001'],
            dueTermIds: ['term_001'],
        }));
        const body = await response.json();

        expect(response.status).toBe(404);
        expect(body).toMatchObject({
            code: 'E2E_SEED_DISABLED',
            retryable: false,
        });
    });

    it('returns 403 for an invalid seed secret', async () => {
        const { POST } = await import('@/app/api/test/e2e/seed-study-state/route');
        const response = await POST(createRequest({
            userEmail: 'qa@example.com',
            favoriteTermIds: ['term_001'],
            dueTermIds: ['term_001'],
        }, 'wrong-secret'));
        const body = await response.json();

        expect(response.status).toBe(403);
        expect(body).toMatchObject({
            code: 'FORBIDDEN',
            retryable: false,
        });
    });

    it('returns 404 when the requested user email is unknown', async () => {
        mockListUsers.mockResolvedValue({
            data: {
                users: [],
            },
            error: null,
        });

        const { POST } = await import('@/app/api/test/e2e/seed-study-state/route');
        const response = await POST(createRequest({
            userEmail: 'missing@example.com',
            favoriteTermIds: ['term_001'],
            dueTermIds: ['term_001'],
        }, 'seed-secret'));
        const body = await response.json();

        expect(response.status).toBe(404);
        expect(body).toMatchObject({
            code: 'E2E_USER_NOT_FOUND',
            retryable: false,
        });
    });

    it('returns 404 when one of the requested term ids does not exist', async () => {
        mockListUsers.mockResolvedValue({
            data: {
                users: [{
                    id: 'user-1',
                    email: 'qa@example.com',
                }],
            },
            error: null,
        });
        const defaultTableMock = createDefaultTableMock();
        mockFrom.mockImplementation((table: string) => {
            if (table === 'terms') {
                return {
                    select: () => ({
                        in: () => Promise.resolve({
                            data: [{ id: 'term_001' }],
                            error: null,
                        }),
                    }),
                };
            }

            return defaultTableMock(table);
        });

        const { POST } = await import('@/app/api/test/e2e/seed-study-state/route');
        const response = await POST(createRequest({
            userEmail: 'qa@example.com',
            favoriteTermIds: ['term_001'],
            dueTermIds: ['term_001', 'missing-term'],
        }, 'seed-secret'));
        const body = await response.json();

        expect(response.status).toBe(404);
        expect(body).toMatchObject({
            code: 'E2E_SEED_TERM_NOT_FOUND',
            retryable: false,
        });
    });

    it('seeds deterministic favorites and due terms for a known user', async () => {
        mockListUsers.mockResolvedValue({
            data: {
                users: [{
                    id: 'user-1',
                    email: 'qa@example.com',
                }],
            },
            error: null,
        });

        const { POST } = await import('@/app/api/test/e2e/seed-study-state/route');
        const response = await POST(createRequest({
            userEmail: 'qa@example.com',
            favoriteTermIds: ['term_001'],
            dueTermIds: ['term_001', 'term_003'],
            clearExistingFavorites: true,
            clearExistingQuizHistory: true,
        }, 'seed-secret'));
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body).toEqual({
            ok: true,
            userId: 'user-1',
            seededFavorites: ['term_001', 'term_003'],
            seededDueTerms: ['term_001', 'term_003'],
        });
    });
});
