import { AuthMode } from '@/hooks/useAuthLogic';
import { Language } from '@/types';

export interface AuthFormState {
    email: string;
    password: string;
    confirmPassword: string;
    name: string;
    surname: string;
    birthDate: string;
}

export type AuthToastType = 'success' | 'error' | 'warning' | 'info';

export interface AuthActionResult {
    success: boolean;
    error?: string;
}

export interface CommonAuthProps {
    t: (key: string) => string;
    language: Language;
    authLoading: boolean;
    authError: string;
    setAuthError: (err: string) => void;
}

export interface AuthFormProps extends CommonAuthProps {
    authMode: AuthMode;
    loginRedirectTarget: string;
    setAuthMode: (mode: AuthMode) => void;
    authForm: AuthFormState;
    setAuthForm: (form: AuthFormState) => void;
    handleAuth: () => void;
    handleGoogleAuth: () => void;
    resetPassword: (email: string) => Promise<AuthActionResult>;
    showPassword: boolean;
    setShowPassword: (show: boolean) => void;
    showConfirmPassword: boolean;
    setShowConfirmPassword: (show: boolean) => void;
    showToast: (msg: string, type: AuthToastType) => void;
}

export interface OTPVerificationProps extends CommonAuthProps {
    pendingVerificationEmail: string | null;
    otpCode: string;
    setOtpCode: (code: string) => void;
    verifyOTP: (email: string, code: string) => Promise<AuthActionResult>;
    resendOTP: (email: string) => Promise<AuthActionResult>;
    resendCooldown: number;
    startCooldown: () => void;
    onClose: () => void;
    showToast: (msg: string, type: AuthToastType) => void;
}

export interface UpdatePasswordProps extends CommonAuthProps {
    authForm: AuthFormState;
    setAuthForm: (form: AuthFormState) => void;
    updatePassword: (password: string) => Promise<AuthActionResult>;
    validatePassword: (password: string) => { valid: boolean; message: string };
    showPassword: boolean;
    setShowPassword: (show: boolean) => void;
    logout: () => Promise<AuthActionResult>;
    onSuccess: () => void;
    showToast: (msg: string, type: AuthToastType) => void;
}
