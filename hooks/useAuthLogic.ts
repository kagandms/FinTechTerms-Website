import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useToast } from '@/contexts/ToastContext';
import { getSupabaseClient } from '@/lib/supabase';
import { AuthFormState } from '@/components/features/auth/types';
import { resetAllData } from '@/utils/storage';
import { isValidRegistrationBirthDate } from '@/lib/validations/auth';
import { getLocalizedAuthError } from '@/lib/auth/error-messages';
import { logger } from '@/lib/logger';
import { createEmptyAuthForm, getSafeRedirectPath } from '@/hooks/use-auth-logic-helpers';

export type AuthMode = 'login' | 'register' | 'forgot-password' | 'update-password';

export function useAuthLogic() {
    const supabase = getSupabaseClient();
    const {
        user, isAuthenticated, login, register, logout,
        verifyOTP, resendOTP, pendingVerificationEmail,
        cancelVerification, resetPassword, updatePassword, isPasswordRecovery
    } = useAuth();

    const { t, language } = useLanguage();
    const { showToast } = useToast();
    const searchParams = useSearchParams();
    const router = useRouter();

    // UI State
    const [showAuthModal, setShowAuthModal] = useState(false);
    const [authMode, setAuthMode] = useState<AuthMode>('login');
    const [showResetConfirm, setShowResetConfirm] = useState(false);

    // Form State
    const [authForm, setAuthForm] = useState<AuthFormState>(createEmptyAuthForm);
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);

    // OTP State
    const [otpCode, setOtpCode] = useState('');
    const [authError, setAuthError] = useState('');
    const [authLoading, setAuthLoading] = useState(false);
    const [resendCooldown, setResendCooldown] = useState(0);
    const recoveryModalTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const resendCooldownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const resetForm = useCallback(() => {
        setAuthForm(createEmptyAuthForm());
    }, []);

    // Password Recovery Detection
    useEffect(() => {
        if (typeof window !== 'undefined') {
            const hash = window.location.hash;
            const isResetUrl = searchParams.get('reset') === 'true';
            const isRecoveryType = searchParams.get('type') === 'recovery';
            const isRecoveryInHash = hash.includes('type=recovery');

            if (isPasswordRecovery || isResetUrl || isRecoveryType || isRecoveryInHash) {
                // Determine if we need to force modal open
                // Give Supabase a moment to process hash
                recoveryModalTimeoutRef.current = setTimeout(() => {
                    supabase.auth.getSession().then(({ data: { session } }) => {
                        if (session || isPasswordRecovery) {
                            setAuthMode('update-password');
                            setShowAuthModal(true);
                        }
                    });
                }, 500);
            }
        }

        return () => {
            if (recoveryModalTimeoutRef.current) {
                clearTimeout(recoveryModalTimeoutRef.current);
                recoveryModalTimeoutRef.current = null;
            }
        };
    }, [isAuthenticated, isPasswordRecovery, searchParams, supabase]);

    useEffect(() => {
        if (isAuthenticated) {
            return;
        }

        const requestedAuthMode = searchParams.get('auth');
        const requestedNextPath = getSafeRedirectPath(
            searchParams.get('next') || searchParams.get('returnTo')
        );

        if (requestedAuthMode === 'login' || requestedNextPath) {
            setAuthMode('login');
            setShowAuthModal(true);
        }
    }, [isAuthenticated, searchParams]);

    useEffect(() => () => {
        if (resendCooldownIntervalRef.current) {
            clearInterval(resendCooldownIntervalRef.current);
        }
    }, []);

    useEffect(() => {
        if (!showAuthModal) {
            return;
        }

        if (authMode === 'update-password') {
            return;
        }

        if (isAuthenticated) {
            cancelVerification();
            setAuthError('');
            setOtpCode('');
            setShowAuthModal(false);
            resetForm();
            router.refresh();
        }
    }, [authMode, cancelVerification, isAuthenticated, resetForm, router, showAuthModal]);

    // Validation Helpers
    const validatePassword = (password: string): { valid: boolean; message: string } => {
        const strongPasswordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{8,}$/;
        if (!strongPasswordRegex.test(password)) {
            return {
                valid: false,
                message: t('auth.passwordRequirements'),
            };
        }
        return { valid: true, message: '' };
    };

    // Actions
    const handleAuth = async () => {
        setAuthError('');

        // Registration Validation
        if (authMode === 'register') {
            if (!authForm.name.trim()) {
                const msg = t('auth.nameRequired');
                setAuthError(msg);
                showToast(msg, 'error');
                return;
            }

            if (!authForm.surname.trim()) {
                const msg = t('auth.surnameRequired');
                setAuthError(msg);
                showToast(msg, 'error');
                return;
            }

            if (!authForm.birthDate || !isValidRegistrationBirthDate(authForm.birthDate)) {
                const msg = t('authFlow.invalidBirthDate');
                setAuthError(msg);
                showToast(msg, 'error');
                return;
            }

            const pwdCheck = validatePassword(authForm.password);
            if (!pwdCheck.valid) {
                setAuthError(pwdCheck.message);
                showToast(pwdCheck.message, 'error');
                return;
            }

            if (!authForm.confirmPassword) {
                const msg = t('authFlow.confirmPasswordRequired');
                setAuthError(msg);
                showToast(msg, 'error');
                return;
            }

            if (authForm.password !== authForm.confirmPassword) {
                const msg = t('authFlow.passwordsMismatch');
                setAuthError(msg);
                showToast(msg, 'error');
                return;
            }
        }

        setAuthLoading(true);
        try {
            let result: { success: boolean; error?: string; needsOTPVerification?: boolean };
            if (authMode === 'login') {
                result = await login(authForm.email, authForm.password);
            } else {
                const fullName = `${authForm.name.trim()} ${authForm.surname.trim()}`;
                result = await register(authForm.email, authForm.password, fullName, authForm.birthDate);
            }

            if (result.success) {
                if (result.needsOTPVerification) {
                    setAuthError('');
                    setOtpCode('');
                    startCooldown();
                    showToast(t('authFlow.verificationSent'), 'success');
                } else {
                    setShowAuthModal(false);
                    resetForm();

                    if (authMode === 'login') {
                        const redirectTarget = getSafeRedirectPath(
                            searchParams.get('next') || searchParams.get('returnTo')
                        ) || '/profile';
                        showToast(t('authFlow.loginSuccess'), 'success');

                        try {
                            router.refresh();
                            router.push(redirectTarget);
                        } catch (navError: unknown) {
                            logger.error('AUTH_LOGIN_NAVIGATION_FAILED', {
                                route: 'useAuthLogic',
                                error: navError instanceof Error ? navError : undefined,
                                redirectTarget,
                            });
                            const navErrorMsg = getLocalizedAuthError(navError, language);
                            setAuthError(navErrorMsg);
                            showToast(navErrorMsg, 'error');
                        }
                    } else {
                        showToast(t('authFlow.registerSuccess'), 'success');
                        router.refresh();
                    }
                }
            } else {
                const msg = getLocalizedAuthError(result.error, language);
                setAuthError(msg);
                showToast(msg, 'error');
            }
        } catch (error: unknown) {
            const msg = getLocalizedAuthError(error, language);
            setAuthError(msg);
            showToast(msg, 'error');
        } finally {
            setAuthLoading(false);
        }
    };

    const handleDataReset = (refreshData: () => void) => {
        resetAllData();
        refreshData();
        setShowResetConfirm(false);
    };

    const startCooldown = () => {
        if (resendCooldownIntervalRef.current) {
            clearInterval(resendCooldownIntervalRef.current);
        }

        setResendCooldown(60);
        resendCooldownIntervalRef.current = setInterval(() => {
            setResendCooldown(prev => {
                if (prev <= 1) {
                    if (resendCooldownIntervalRef.current) {
                        clearInterval(resendCooldownIntervalRef.current);
                        resendCooldownIntervalRef.current = null;
                    }
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
    };

    return {
        // State
        user, isAuthenticated,
        showAuthModal, setShowAuthModal,
        authMode, setAuthMode,
        authForm, setAuthForm,
        showResetConfirm, setShowResetConfirm,
        otpCode, setOtpCode,
        authError, setAuthError,
        authLoading, setAuthLoading,
        resendCooldown, setResendCooldown,
        showPassword, setShowPassword,
        showConfirmPassword, setShowConfirmPassword,
        pendingVerificationEmail,

        // Actions
        handleAuth,
        handleDataReset,
        logout,
        verifyOTP,
        resendOTP,
        resetPassword,
        updatePassword,
        cancelVerification,
        validatePassword,
        startCooldown,

        // Context
        language,
        t,
        showToast,
        router
    };
}
