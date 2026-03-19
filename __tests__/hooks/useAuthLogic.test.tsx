/**
 * @jest-environment jsdom
 */

import { act, renderHook } from '@testing-library/react';

import { useAuthLogic } from '@/hooks/useAuthLogic';

const mockUseAuth = jest.fn();
const mockUseLanguage = jest.fn();
const mockUseToast = jest.fn();
const mockUseSearchParams = jest.fn();
const mockUseRouter = jest.fn();
const mockGetSession = jest.fn();

const mockShowToast = jest.fn();
const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockRefresh = jest.fn();

jest.mock('@/contexts/AuthContext', () => ({
    useAuth: () => mockUseAuth(),
}));

jest.mock('@/contexts/LanguageContext', () => ({
    useLanguage: () => mockUseLanguage(),
}));

jest.mock('@/contexts/ToastContext', () => ({
    useToast: () => mockUseToast(),
}));

jest.mock('next/navigation', () => ({
    useSearchParams: () => mockUseSearchParams(),
    useRouter: () => mockUseRouter(),
}));

jest.mock('@/lib/supabase', () => ({
    getSupabaseClient: () => ({
        auth: {
            getSession: (...args: unknown[]) => mockGetSession(...args),
        },
    }),
}));

describe('useAuthLogic', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockGetSession.mockResolvedValue({ data: { session: null } });
        mockUseToast.mockReturnValue({ showToast: mockShowToast });
        mockUseLanguage.mockReturnValue({
            t: (key: string) => key,
            language: 'en',
        });
        mockUseRouter.mockReturnValue({
            push: mockPush,
            replace: mockReplace,
            refresh: mockRefresh,
        });
        mockUseSearchParams.mockReturnValue(new URLSearchParams());
    });

    it('blocks registration when passwords do not match', async () => {
        const register = jest.fn().mockResolvedValue({ success: true });
        mockUseAuth.mockReturnValue({
            user: null,
            isAuthenticated: false,
            login: jest.fn(),
            register,
            logout: jest.fn(),
            verifyOTP: jest.fn(),
            resendOTP: jest.fn(),
            pendingVerificationEmail: null,
            cancelVerification: jest.fn(),
            resetPassword: jest.fn(),
            updatePassword: jest.fn(),
            isPasswordRecovery: false,
        });

        const { result } = renderHook(() => useAuthLogic());

        act(() => {
            result.current.setAuthMode('register');
            result.current.setAuthForm({
                email: 'alex@example.com',
                password: 'StrongPass1!',
                confirmPassword: 'StrongPass1?',
                name: 'Alex',
                surname: 'Stone',
                birthDate: '2000-01-01',
            });
        });

        await act(async () => {
            await result.current.handleAuth();
        });

        expect(register).not.toHaveBeenCalled();
        expect(mockShowToast).toHaveBeenCalledWith('Passwords do not match.', 'error');
    });

    it('uses the protected-route next parameter after login', async () => {
        const login = jest.fn().mockResolvedValue({ success: true });
        mockUseAuth.mockReturnValue({
            user: null,
            isAuthenticated: false,
            login,
            register: jest.fn(),
            logout: jest.fn(),
            verifyOTP: jest.fn(),
            resendOTP: jest.fn(),
            pendingVerificationEmail: null,
            cancelVerification: jest.fn(),
            resetPassword: jest.fn(),
            updatePassword: jest.fn(),
            isPasswordRecovery: false,
        });
        mockUseSearchParams.mockReturnValue(new URLSearchParams('auth=login&next=%2Ffavorites'));

        const { result } = renderHook(() => useAuthLogic());

        act(() => {
            result.current.setAuthForm({
                email: 'alex@example.com',
                password: 'StrongPass1!',
                confirmPassword: '',
                name: '',
                surname: '',
                birthDate: '',
            });
        });

        await act(async () => {
            await result.current.handleAuth();
        });

        expect(login).toHaveBeenCalledWith('alex@example.com', 'StrongPass1!');
        expect(mockPush).toHaveBeenCalledWith('/favorites');
    });
});
