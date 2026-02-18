import { AuthMode } from '@/hooks/useAuthLogic';

export interface AuthFormState {
    email: string;
    password: string;
    confirmPassword?: string;
    name: string;
    surname: string;
    birthYear: string;
}

export interface CommonAuthProps {
    t: (key: string) => string;
    language: string;
    authLoading: boolean;
    authError: string;
    setAuthError: (err: string) => void;
}

export interface AuthFormProps extends CommonAuthProps {
    authMode: AuthMode;
    setAuthMode: (mode: AuthMode) => void;
    authForm: AuthFormState;
    setAuthForm: (form: AuthFormState) => void;
    handleAuth: () => void;
    resetPassword: (email: string) => Promise<any>;
    showPassword: boolean;
    setShowPassword: (show: boolean) => void;
}

export interface OTPVerificationProps extends CommonAuthProps {
    pendingVerificationEmail: string | null;
    otpCode: string;
    setOtpCode: (code: string) => void;
    verifyOTP: (email: string, code: string) => Promise<any>;
    resendOTP: (email: string) => Promise<any>;
    resendCooldown: number;
    startCooldown: () => void;
    onClose: () => void;
}

export interface UpdatePasswordProps extends CommonAuthProps {
    authForm: AuthFormState;
    setAuthForm: (form: AuthFormState) => void;
    updatePassword: (password: string) => Promise<any>;
    validatePassword: (password: string) => { valid: boolean; message: string };
    showPassword: boolean;
    setShowPassword: (show: boolean) => void;
    logout: () => void;
    onSuccess: () => void;
    showToast: (msg: string, type: 'success' | 'error') => void;
}
