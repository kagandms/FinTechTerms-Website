import React from 'react';
import { X } from 'lucide-react';
import { AuthMode } from '@/hooks/useAuthLogic';
import { AuthFormState } from './types';
import { OTPVerification } from './OTPVerification';
import { UpdatePasswordForm } from './UpdatePasswordForm';
import { AuthForm } from './AuthForm';

// Re-defining props with strict types (no 'any')
// We use the imported interfaces but AuthModal orchestrates them
interface AuthModalProps {
    isOpen: boolean;
    onClose: () => void;
    authMode: AuthMode;
    setAuthMode: (mode: AuthMode) => void;
    authForm: AuthFormState;
    setAuthForm: (form: AuthFormState) => void;
    handleAuth: () => void;
    authLoading: boolean;
    authError: string;
    setAuthError: (err: string) => void;

    // OTP Props
    pendingVerificationEmail: string | null;
    otpCode: string;
    setOtpCode: (code: string) => void;
    verifyOTP: (email: string, code: string) => Promise<any>;
    resendOTP: (email: string) => Promise<any>;
    resendCooldown: number;
    startCooldown: () => void;
    cancelVerification: () => void;

    // Password Props
    updatePassword: (password: string) => Promise<any>;
    resetPassword: (email: string) => Promise<any>;
    validatePassword: (password: string) => { valid: boolean; message: string };
    showPassword: boolean;
    setShowPassword: (show: boolean) => void;
    showConfirmPassword: boolean;
    setShowConfirmPassword: (show: boolean) => void;

    // Tools
    t: (key: string) => string;
    language: string;
    showToast: (msg: string, type: 'success' | 'error') => void;
    logout: () => void;
    router: any; // Kept as any because AppRouterInstance is tricky to import without next/navigation dependency here or generic, but simpler to keep for now as it's passed from hook
}

export const AuthModal: React.FC<AuthModalProps> = (props) => {
    if (!props.isOpen && !props.pendingVerificationEmail) return null;

    const {
        t, language, authMode, authForm, setAuthForm, authError, setAuthError, authLoading
    } = props;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 animate-fade-in backdrop-blur-sm">
            <div className="relative bg-white dark:bg-gray-800 rounded-2xl p-6 max-w-sm w-full shadow-2xl max-h-[90vh] overflow-y-auto transform transition-all scale-100">
                <button
                    onClick={props.onClose}
                    className="absolute top-4 right-4 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors z-10"
                >
                    <X className="w-5 h-5" />
                </button>

                {props.pendingVerificationEmail ? (
                    <OTPVerification
                        {...props}
                    />
                ) : authMode === 'update-password' ? (
                    <UpdatePasswordForm
                        authForm={authForm}
                        setAuthForm={setAuthForm}
                        updatePassword={props.updatePassword}
                        validatePassword={props.validatePassword}
                        showPassword={props.showPassword}
                        setShowPassword={props.setShowPassword}
                        authError={authError}
                        setAuthError={setAuthError}
                        showToast={props.showToast}
                        logout={props.logout}
                        language={language}
                        t={t}
                        authLoading={authLoading}
                        onSuccess={() => {
                            props.router.replace('/profile');
                            props.setAuthMode('login');
                        }}
                    />
                ) : (
                    <AuthForm
                        authMode={authMode}
                        setAuthMode={props.setAuthMode}
                        authForm={authForm}
                        setAuthForm={setAuthForm}
                        authLoading={authLoading}
                        handleAuth={props.handleAuth}
                        authError={authError}
                        setAuthError={setAuthError}
                        showPassword={props.showPassword}
                        setShowPassword={props.setShowPassword}
                        resetPassword={props.resetPassword}
                        t={t}
                        language={language}
                    />
                )}
            </div>
        </div>
    );
};

