import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useToast } from '@/contexts/ToastContext';
import { supabase } from '@/lib/supabase';
import { AuthFormState } from '@/components/features/auth/types';
import { resetAllData } from '@/utils/storage';

export type AuthMode = 'login' | 'register' | 'forgot-password' | 'update-password';

// Supabase error translations map
const translateAuthError = (errorMsg: string, lang: string): string => {
    const msg = errorMsg.toLowerCase();

    if (msg.includes('invalid login credentials')) {
        return lang === 'tr' ? 'E-posta veya şifre hatalı.' : lang === 'ru' ? 'Неверный e-mail или пароль.' : 'Invalid email or password.';
    }
    if (msg.includes('email not confirmed')) {
        return lang === 'tr' ? 'E-posta adresi henüz doğrulanmadı.' : lang === 'ru' ? 'E-mail адрес не подтвержден.' : 'Email address not confirmed.';
    }
    if (msg.includes('already registered')) {
        return lang === 'tr' ? 'Bu e-posta adresi zaten kayıtlı.' : lang === 'ru' ? 'Этот e-mail уже зарегистрирован.' : 'This email is already registered.';
    }
    if (msg.includes('token has expired') || msg.includes('invalid token')) {
        return lang === 'tr' ? 'Girdiğiniz kod hatalı veya süresi dolmuş.' : lang === 'ru' ? 'Введенный код неверен или истек его срок действия.' : 'The code is invalid or has expired.';
    }
    if (msg.includes('password should be at least')) {
        return lang === 'tr' ? 'Şifre daha güçlü olmalıdır.' : lang === 'ru' ? 'Пароль должен быть надежнее.' : 'Password should be stronger.';
    }
    if (msg.includes('rate limit')) {
        return lang === 'tr' ? 'Çok fazla deneme yaptınız. Lütfen biraz bekleyin.' : lang === 'ru' ? 'Слишком много попыток. Пожалуйста, подождите.' : 'Too many attempts. Please wait.';
    }

    // Default fallback translations
    return lang === 'tr' ? 'Bir hata oluştu: ' + errorMsg : lang === 'ru' ? 'Произошла ошибка: ' + errorMsg : errorMsg;
};

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
        birthDate: ''
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

    const validateAge = (birthDate: string): boolean => {
        if (!birthDate) return false;
        const dob = new Date(birthDate);
        if (isNaN(dob.getTime())) return false; // invalid date

        const today = new Date();
        let age = today.getFullYear() - dob.getFullYear();
        const m = today.getMonth() - dob.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) {
            age--; // hasn't had birthday yet this year
        }

        return age >= 13 && age <= 120;
    };

    // Actions
    const handleAuth = async () => {
        setAuthError('');

        // Registration Validation
        if (authMode === 'register') {
            if (!authForm.name.trim()) {
                const msg = t('auth.nameRequired') || 'Name required';
                setAuthError(msg);
                showToast(msg, 'error');
                return;
            }

            if (!authForm.surname.trim()) {
                const msg = t('auth.surnameRequired') || 'Surname required';
                setAuthError(msg);
                showToast(msg, 'error');
                return;
            }

            if (!authForm.birthDate || !validateAge(authForm.birthDate)) {
                const msg = language === 'tr'
                    ? 'Geçerli bir doğum tarihi girin (13+)'
                    : language === 'ru' ? 'Введите действительную дату рождения (13+)' : 'Enter valid birth date (13+)';
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
                    showToast(
                        language === 'tr'
                            ? 'Doğrulama kodu gönderildi.'
                            : language === 'ru'
                                ? 'Код подтверждения отправлен.'
                                : 'Verification code sent.',
                        'success'
                    );
                } else {
                    setShowAuthModal(false);
                    resetForm();

                    if (authMode === 'login') {
                        showToast(
                            language === 'tr'
                                ? 'Giriş başarılı.'
                                : language === 'ru'
                                    ? 'Вход выполнен.'
                                    : 'Login successful.',
                            'success'
                        );

                        try {
                            router.refresh();
                            router.push('/profile');
                        } catch (navError: any) {
                            const navErrorMsg = translateAuthError(navError?.message || 'Navigation failed', language);
                            setAuthError(navErrorMsg);
                            showToast(navErrorMsg, 'error');
                        }
                    } else {
                        showToast(
                            language === 'tr'
                                ? 'Kayıt başarılı.'
                                : language === 'ru'
                                    ? 'Регистрация успешна.'
                                    : 'Registration successful.',
                            'success'
                        );
                        router.refresh();
                    }
                }
            } else {
                const msg = translateAuthError(result.error || '', language);
                setAuthError(msg);
                showToast(msg, 'error');
            }
        } catch (error: any) {
            const msg = translateAuthError(error?.message || '', language);
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
        setAuthForm({ email: '', password: '', confirmPassword: '', name: '', surname: '', birthDate: '' });
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
