import React, { useCallback, useRef } from 'react';
import { X } from 'lucide-react';
import { AuthMode } from '@/hooks/useAuthLogic';
import { AuthActionResult, AuthFormState } from './types';
import { Language } from '@/types';
import { OTPVerification } from './OTPVerification';
import { UpdatePasswordForm } from './UpdatePasswordForm';
import { AuthForm } from './AuthForm';
import { useAccessibleDialog } from '@/hooks/use-accessible-dialog';

interface AuthModalRouter {
    push: (href: string) => void;
    replace: (href: string) => void;
    refresh: () => void;
}

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
    handleGoogleAuth: () => void;
    authLoading: boolean;
    authError: string;
    setAuthError: (err: string) => void;

    // OTP Props
    pendingVerificationEmail: string | null;
    otpCode: string;
    setOtpCode: (code: string) => void;
    verifyOTP: (email: string, code: string) => Promise<AuthActionResult>;
    resendOTP: (email: string) => Promise<AuthActionResult>;
    resendCooldown: number;
    startCooldown: () => void;
    cancelVerification: () => void;

    // Password Props
    updatePassword: (password: string) => Promise<AuthActionResult>;
    resetPassword: (email: string) => Promise<AuthActionResult>;
    validatePassword: (password: string) => { valid: boolean; message: string };
    showPassword: boolean;
    setShowPassword: (show: boolean) => void;
    showConfirmPassword: boolean;
    setShowConfirmPassword: (show: boolean) => void;

    // Tools
    t: (key: string) => string;
    language: Language;
    showToast: (msg: string, type: 'success' | 'error' | 'warning' | 'info') => void;
    logout: () => Promise<AuthActionResult>;
    router: AuthModalRouter;
}

export const AuthModal: React.FC<AuthModalProps> = (props) => {
    const {
        t, language, authMode, authForm, setAuthForm, authError, setAuthError, authLoading,
        pendingVerificationEmail, cancelVerification, onClose, showToast, router
    } = props;
    const closeButtonRef = useRef<HTMLButtonElement>(null);

    /**
     * Unified close handler — clears both modal visibility AND
     * any pending OTP verification state so the modal truly closes.
     */
    const handleModalClose = useCallback(() => {
        // Always clear OTP verification state first
        if (pendingVerificationEmail) {
            cancelVerification();
        }
        setAuthError('');
        onClose();
    }, [pendingVerificationEmail, cancelVerification, setAuthError, onClose]);

    /**
     * Called when OTP verification succeeds — close modal and redirect to dashboard.
     */
    const handleOTPSuccess = useCallback(() => {
        // Explicitly clear modal visibility and any pending state
        if (pendingVerificationEmail) {
            cancelVerification();
        }
        setAuthError('');
        onClose();
        router.refresh();

        showToast(
            t('authFlow.otpSuccess'),
            'success'
        );
    }, [cancelVerification, onClose, pendingVerificationEmail, router, setAuthError, showToast, t]);
    const {
        dialogRef,
        titleId,
    } = useAccessibleDialog({
        isOpen: props.isOpen,
        onClose: handleModalClose,
        initialFocusRef: closeButtonRef,
    });

    if (!props.isOpen) return null;

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 animate-fade-in backdrop-blur-sm"
            data-testid="auth-modal"
            onClick={handleModalClose}
        >
            <div
                ref={dialogRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                tabIndex={-1}
                className="relative bg-white dark:bg-gray-800 rounded-2xl p-6 max-w-sm w-full shadow-2xl max-h-[90vh] overflow-y-auto transform transition-all scale-100"
                onClick={(event) => event.stopPropagation()}
            >
                {/* Close (X) Button — always visible, always works */}
                <button
                    ref={closeButtonRef}
                    type="button"
                    onClick={handleModalClose}
                    className="absolute top-4 right-4 p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors z-10"
                    aria-label={t('shell.close')}
                >
                    <X className="w-5 h-5" />
                </button>
                <h2 id={titleId} className="sr-only">
                    {pendingVerificationEmail
                        ? t('auth.checkEmail')
                        : authMode === 'update-password'
                        ? t('auth.resetPassword')
                        : t(authMode === 'login' ? 'auth.login' : 'auth.register')}
                </h2>

                {props.pendingVerificationEmail ? (
                    <OTPVerification
                        {...props}
                        onClose={handleOTPSuccess}
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
                        handleGoogleAuth={props.handleGoogleAuth}
                        authError={authError}
                        setAuthError={setAuthError}
                        showPassword={props.showPassword}
                        setShowPassword={props.setShowPassword}
                        resetPassword={props.resetPassword}
                        showConfirmPassword={props.showConfirmPassword}
                        setShowConfirmPassword={props.setShowConfirmPassword}
                        t={t}
                        language={language}
                        showToast={props.showToast}
                    />
                )}
            </div>
        </div>
    );
};
