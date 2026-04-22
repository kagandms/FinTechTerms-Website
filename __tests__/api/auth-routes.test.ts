/**
 * @jest-environment node
 */

export {};

const mockCreateAuthRouteClient = jest.fn();
const mockCreateAuthUnavailableResponse = jest.fn((requestId: string) => Response.json({
    code: 'AUTH_UNAVAILABLE',
    message: 'Authentication is temporarily unavailable.',
    requestId,
    retryable: true,
}, { status: 503 }));
const mockGetPublicEnv = jest.fn();
const mockAuthLoginCheck = jest.fn();
const mockAuthSignupCheck = jest.fn();
const mockAuthResetPasswordCheck = jest.fn();
const mockAuthResendOtpCheck = jest.fn();
const mockAuthVerifyOtpCheck = jest.fn();
const mockAuthUpdatePasswordCheck = jest.fn();

jest.mock('@/lib/auth/route-handler', () => ({
    createAuthRouteClient: () => mockCreateAuthRouteClient(),
    createAuthUnavailableResponse: (requestId: string) => mockCreateAuthUnavailableResponse(requestId),
    getAuthRouteHeaders: () => ({
        'Cache-Control': 'no-store',
    }),
}));

jest.mock('@/lib/env', () => ({
    getPublicEnv: () => mockGetPublicEnv(),
}));

jest.mock('@/lib/rate-limiter', () => ({
    authLoginRateLimiter: {
        check: (...args: unknown[]) => mockAuthLoginCheck(...args),
        reset: jest.fn(),
    },
    authSignupRateLimiter: {
        check: (...args: unknown[]) => mockAuthSignupCheck(...args),
        reset: jest.fn(),
    },
    authResetPasswordRateLimiter: {
        check: (...args: unknown[]) => mockAuthResetPasswordCheck(...args),
        reset: jest.fn(),
    },
    authResendOtpRateLimiter: {
        check: (...args: unknown[]) => mockAuthResendOtpCheck(...args),
        reset: jest.fn(),
    },
    authVerifyOtpRateLimiter: {
        check: (...args: unknown[]) => mockAuthVerifyOtpCheck(...args),
        reset: jest.fn(),
    },
    authUpdatePasswordRateLimiter: {
        check: (...args: unknown[]) => mockAuthUpdatePasswordCheck(...args),
        reset: jest.fn(),
    },
    isRateLimiterUnavailable: (result: { unavailable?: boolean }) => result.unavailable === true,
}));

const createJsonRequest = (
    path: string,
    body: Record<string, unknown>,
    headers?: Record<string, string>
) => new Request(`http://localhost:3000${path}`, {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        Origin: 'http://localhost:3000',
        'x-forwarded-for': '203.0.113.10',
        ...headers,
    },
    body: JSON.stringify(body),
});

describe('auth routes hardening', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockGetPublicEnv.mockReturnValue({
            siteUrl: 'http://localhost:3000',
        });
        mockAuthLoginCheck.mockResolvedValue({
            allowed: true,
            remaining: 9,
            retryAfter: 0,
            unavailable: false,
        });
        mockAuthSignupCheck.mockResolvedValue({
            allowed: true,
            remaining: 4,
            retryAfter: 0,
            unavailable: false,
        });
        mockAuthResetPasswordCheck.mockResolvedValue({
            allowed: true,
            remaining: 4,
            retryAfter: 0,
            unavailable: false,
        });
        mockAuthResendOtpCheck.mockResolvedValue({
            allowed: true,
            remaining: 4,
            retryAfter: 0,
            unavailable: false,
        });
        mockAuthVerifyOtpCheck.mockResolvedValue({
            allowed: true,
            remaining: 9,
            retryAfter: 0,
            unavailable: false,
        });
        mockAuthUpdatePasswordCheck.mockResolvedValue({
            allowed: true,
            remaining: 4,
            retryAfter: 0,
            unavailable: false,
        });
    });

    it('rejects cross-origin login requests before auth execution', async () => {
        const { POST } = await import('@/app/api/auth/login/route');
        const response = await POST(createJsonRequest('/api/auth/login', {
            email: 'user@example.com',
            password: 'Secret123!',
        }, {
            Origin: 'https://evil.example',
        }));
        const body = await response.json();

        expect(response.status).toBe(403);
        expect(body).toMatchObject({
            code: 'INVALID_ORIGIN',
            retryable: false,
        });
        expect(mockCreateAuthRouteClient).not.toHaveBeenCalled();
    });

    it('rate limits login requests before calling Supabase auth', async () => {
        mockAuthLoginCheck.mockResolvedValueOnce({
            allowed: false,
            remaining: 0,
            retryAfter: 120,
            unavailable: false,
        });

        const { POST } = await import('@/app/api/auth/login/route');
        const response = await POST(createJsonRequest('/api/auth/login', {
            email: 'user@example.com',
            password: 'Secret123!',
        }));
        const body = await response.json();

        expect(response.status).toBe(429);
        expect(body).toMatchObject({
            code: 'RATE_LIMITED',
            message: 'RATE_LIMITED',
            retryable: true,
        });
        expect(mockCreateAuthRouteClient).not.toHaveBeenCalled();
    });

    it('keeps login failures account-neutral', async () => {
        mockCreateAuthRouteClient.mockResolvedValue({
            supabase: {
                auth: {
                    signInWithPassword: jest.fn().mockResolvedValue({
                        data: { user: null },
                        error: { message: 'Email not confirmed' },
                    }),
                },
            },
            applyCookies: <T extends Response>(response: T) => response,
        });

        const { POST } = await import('@/app/api/auth/login/route');
        const response = await POST(createJsonRequest('/api/auth/login', {
            email: 'user@example.com',
            password: 'Secret123!',
        }));
        const body = await response.json();

        expect(response.status).toBe(401);
        expect(body).toMatchObject({
            code: 'INVALID_CREDENTIALS',
            message: 'INVALID_CREDENTIALS',
            retryable: false,
        });
    });

    it('keeps reset-password responses account-neutral for provider lookup errors', async () => {
        mockCreateAuthRouteClient.mockResolvedValue({
            supabase: {
                auth: {
                    resetPasswordForEmail: jest.fn().mockResolvedValue({
                        error: { message: 'User not found' },
                    }),
                },
            },
            applyCookies: <T extends Response>(response: T) => response,
        });

        const { POST } = await import('@/app/api/auth/reset-password/route');
        const response = await POST(createJsonRequest('/api/auth/reset-password', {
            email: 'missing@example.com',
        }));
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body).toEqual({ success: true });
    });

    it('keeps resend-otp responses account-neutral for provider lookup errors', async () => {
        mockCreateAuthRouteClient.mockResolvedValue({
            supabase: {
                auth: {
                    resend: jest.fn().mockResolvedValue({
                        error: { message: 'User not found' },
                    }),
                },
            },
            applyCookies: <T extends Response>(response: T) => response,
        });

        const { POST } = await import('@/app/api/auth/resend-otp/route');
        const response = await POST(createJsonRequest('/api/auth/resend-otp', {
            email: 'missing@example.com',
        }));
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body).toEqual({ success: true });
    });

    it('rejects signup birth dates that do not satisfy member eligibility rules', async () => {
        const { POST } = await import('@/app/api/auth/signup/route');
        const response = await POST(createJsonRequest('/api/auth/signup', {
            email: 'new@example.com',
            password: 'Secret123!',
            name: 'Alex Stone',
            birthDate: '2014-04-06',
        }));
        const body = await response.json();

        expect(response.status).toBe(400);
        expect(body).toMatchObject({
            code: 'VALIDATION_ERROR',
            retryable: false,
        });
    });

    it('reports existing email when the provider suppresses identities', async () => {
        mockCreateAuthRouteClient.mockResolvedValue({
            supabase: {
                auth: {
                    signUp: jest.fn().mockResolvedValue({
                        data: {
                            user: {
                                id: 'user-1',
                                identities: [],
                            },
                            session: null,
                        },
                        error: null,
                    }),
                },
            },
            applyCookies: <T extends Response>(response: T) => response,
        });

        const { POST } = await import('@/app/api/auth/signup/route');
        const response = await POST(createJsonRequest('/api/auth/signup', {
            email: 'existing@example.com',
            password: 'Secret123!',
            name: 'Alex Stone',
            birthDate: '2000-01-01',
        }));
        const body = await response.json();

        expect(response.status).toBe(409);
        expect(body).toEqual({
            code: 'EMAIL_ALREADY_REGISTERED',
            message: 'EMAIL_ALREADY_REGISTERED',
            requestId: expect.any(String),
            retryable: false,
        });
    });

    it('returns stable signup error codes without exposing provider details', async () => {
        mockCreateAuthRouteClient.mockResolvedValue({
            supabase: {
                auth: {
                    signUp: jest.fn().mockResolvedValue({
                        data: {
                            user: null,
                            session: null,
                        },
                        error: new Error('Database error saving new user'),
                    }),
                },
            },
            applyCookies: <T extends Response>(response: T) => response,
        });

        const { POST } = await import('@/app/api/auth/signup/route');
        const response = await POST(createJsonRequest('/api/auth/signup', {
            email: 'new@example.com',
            password: 'Secret123!',
            name: 'Alex Stone',
            birthDate: '2000-01-01',
        }));
        const body = await response.json();

        expect(response.status).toBe(503);
        expect(body).toMatchObject({
            code: 'AUTH_SERVICE_ERROR',
            message: 'AUTH_SERVICE_ERROR',
            retryable: true,
        });
        expect(JSON.stringify(body)).not.toContain('Database error saving new user');
    });

    it('rate limits update-password requests after authentication', async () => {
        mockCreateAuthRouteClient.mockResolvedValue({
            supabase: {
                auth: {
                    getUser: jest.fn().mockResolvedValue({
                        data: {
                            user: {
                                id: 'user-1',
                                email: 'user@example.com',
                                app_metadata: {
                                    provider: 'email',
                                    providers: ['email'],
                                },
                            },
                        },
                        error: null,
                    }),
                },
            },
            applyCookies: <T extends Response>(response: T) => response,
        });
        mockAuthUpdatePasswordCheck.mockResolvedValueOnce({
            allowed: false,
            remaining: 0,
            retryAfter: 60,
            unavailable: false,
        });

        const { POST } = await import('@/app/api/auth/update-password/route');
        const response = await POST(createJsonRequest('/api/auth/update-password', {
            currentPassword: 'OldPassword1!',
            password: 'NewPassword1!',
        }));
        const body = await response.json();

        expect(response.status).toBe(429);
        expect(body).toMatchObject({
            code: 'RATE_LIMITED',
            message: 'RATE_LIMITED',
            retryable: true,
        });
    });
});
