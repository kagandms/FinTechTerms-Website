import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useToast } from '@/contexts/ToastContext';
import { supabase } from '@/lib/supabase';
import { AuthFormState } from '@/components/features/auth/types';
import { resetAllData } from '@/utils/storage';

export type AuthMode = 'login' | 'register' | 'forgot-password' | 'update-password';

export function useAuthLogic() {
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
    const [authForm, setAuthForm] = useState<AuthFormState>({
        email: '',
        password: '',
        confirmPassword: '',
        name: '',
        surname: '',
        birthYear: ''
    });
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);

    // OTP State
    const [otpCode, setOtpCode] = useState('');
    const [authError, setAuthError] = useState('');
    const [authLoading, setAuthLoading] = useState(false);
    const [resendCooldown, setResendCooldown] = useState(0);

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
                setTimeout(() => {
                    supabase.auth.getSession().then(({ data: { session } }) => {
                        if (session || isPasswordRecovery) {
                            setAuthMode('update-password');
                            setShowAuthModal(true);
                        }
                    });
                }, 500);
            }
        }
    }, [isPasswordRecovery, searchParams, isAuthenticated]);

    // Validation Helpers
    const validatePassword = (password: string): { valid: boolean; message: string } => {
        const strongPasswordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{8,}$/;
        if (!strongPasswordRegex.test(password)) {
            return {
                valid: false,
                message: t('auth.passwordRequirements') || (language === 'tr'
                    ? 'Şifre en az 8 karakter olmalı ve 1 büyük harf, 1 küçük harf, 1 rakam, 1 sembol içermelidir.'
                    : 'Password must contain at least 8 chars, 1 uppercase, 1 lowercase, 1 number, 1 symbol.')
            };
        }
        return { valid: true, message: '' };
    };

    const validateAge = (birthYear: string): boolean => {
        const year = parseInt(birthYear);
        const currentYear = new Date().getFullYear();
        const age = currentYear - year;
        return age >= 13 && age <= 120;
    };

    // Actions
    const handleAuth = async () => {
        setAuthError('');

        // Registration Validation
        if (authMode === 'register') {
            if (!authForm.name.trim()) return setAuthError(t('auth.nameRequired') || 'Name required');
            if (!authForm.surname.trim()) return setAuthError(t('auth.surnameRequired') || 'Surname required');
            if (!authForm.birthYear || !validateAge(authForm.birthYear)) {
                return setAuthError(language === 'tr'
                    ? 'Geçerli bir doğum yılı girin (13+)'
                    : 'Enter valid birth year (13+)');
            }
            const pwdCheck = validatePassword(authForm.password);
            if (!pwdCheck.valid) return setAuthError(pwdCheck.message);
        }

        setAuthLoading(true);
        try {
            let result;
            if (authMode === 'login') {
                result = await login(authForm.email, authForm.password);
            } else {
                const fullName = `${authForm.name.trim()} ${authForm.surname.trim()}`;
                result = await register(authForm.email, authForm.password, fullName);
            }

            if (result.success) {
                if (result.needsOTPVerification) {
                    setAuthError('');
                    setOtpCode('');
                    startCooldown();
                } else {
                    setShowAuthModal(false);
                    resetForm();
                }
            } else {
                setAuthError(result.error || t('common.error'));
            }
        } catch {
            setAuthError(t('common.error'));
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
        setResendCooldown(60);
        const interval = setInterval(() => {
            setResendCooldown(prev => {
                if (prev <= 1) {
                    clearInterval(interval);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
    };

    const resetForm = () => {
        setAuthForm({ email: '', password: '', confirmPassword: '', name: '', surname: '', birthYear: '' });
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
