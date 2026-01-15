'use client';

import React, { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useLanguage, languageNames, languageFlags } from '@/contexts/LanguageContext';
import { useSRS } from '@/contexts/SRSContext';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { supabase } from '@/lib/supabase';
import { Language } from '@/types';
import { resetAllData } from '@/utils/storage';
import {
    User,
    Flame,
    BookMarked,
    Target,
    RotateCcw,
    Trophy,
    BookOpen,
    Globe,
    ChevronRight,
    AlertTriangle,
    LogIn,
    LogOut,
    Mail,
    Lock,
    UserPlus,
    Info,
    Brain,
    BarChart3,
    Sun,
    Moon,
    Monitor,
} from 'lucide-react';
import Link from 'next/link';

function ProfileContent() {
    const { t, language, setLanguage } = useLanguage();
    const { userProgress, stats, refreshData, favoritesRemaining } = useSRS();
    const { user, isAuthenticated, login, register, logout, verifyOTP, resendOTP, pendingVerificationEmail, cancelVerification, resetPassword, updatePassword, isPasswordRecovery } = useAuth();
    const { theme, setTheme } = useTheme();

    const [showResetConfirm, setShowResetConfirm] = useState(false);
    const [showAuthModal, setShowAuthModal] = useState(false);
    const [authMode, setAuthMode] = useState<'login' | 'register' | 'forgot-password' | 'update-password'>('login');
    const [authForm, setAuthForm] = useState({
        email: '',
        password: '',
        confirmPassword: '',
        name: '',
        surname: '',
        birthYear: ''
    });

    const searchParams = useSearchParams();

    // Detect password recovery mode via Event (primary) or URL (fallback)
    React.useEffect(() => {
        // Debug logging to help diagnose issues
        if (typeof window !== 'undefined') {
            const hash = window.location.hash;
            const fullUrl = window.location.href;
            const isResetParam = searchParams.get('reset') === 'true';
            const isTypeParam = searchParams.get('type') === 'recovery';
            const isHashRecovery = hash.includes('type=recovery');
            const isAccessToken = hash.includes('access_token') || fullUrl.includes('access_token');

            console.log('Password Reset Detection:', {
                event: isPasswordRecovery,
                queryReset: isResetParam,
                queryType: isTypeParam,
                hashRecovery: isHashRecovery,
                hasAccessToken: isAccessToken,
                authenticated: isAuthenticated,
                hash: hash.substring(0, 100) // Show first 100 chars of hash for debugging
            });
        }

        // Check local state from AuthContext (Event based)
        if (isPasswordRecovery) {
            setAuthMode('update-password');
            setShowAuthModal(true);
            return;
        }

        // Check URL params (Fallback if event missed)
        const isResetUrl = searchParams.get('reset') === 'true';
        const isRecoveryType = searchParams.get('type') === 'recovery';

        // Hash Checks (Supabase puts params in hash fragment)
        const hash = typeof window !== 'undefined' ? window.location.hash : '';
        const isRecoveryInHash = hash.includes('type=recovery');

        // If any recovery indicator is present, open the modal
        // Don't require isAuthenticated as Supabase will handle auth via the recovery token
        if (isResetUrl || isRecoveryType || isRecoveryInHash) {
            console.log('Recovery detected via URL. Opening password update modal...');

            // Give Supabase a moment to process the hash token and establish session
            setTimeout(() => {
                supabase.auth.getSession().then(({ data: { session } }) => {
                    if (session) {
                        console.log('Session found after recovery link:', session.user?.email);
                        setAuthMode('update-password');
                        setShowAuthModal(true);
                    } else {
                        console.log('No session yet, trying to refresh...');
                        // Try refreshing the session
                        supabase.auth.refreshSession().then(({ data: { session: refreshedSession }, error }) => {
                            if (refreshedSession) {
                                console.log('Session refreshed:', refreshedSession.user?.email);
                                setAuthMode('update-password');
                                setShowAuthModal(true);
                            } else if (error) {
                                console.warn('Session refresh failed:', error.message);
                                // Still try to open the modal - user may need to re-click the link
                                setAuthMode('update-password');
                                setShowAuthModal(true);
                            }
                        });
                    }
                });
            }, 500);
        }
    }, [isPasswordRecovery, searchParams, isAuthenticated]);
    const [otpCode, setOtpCode] = useState('');
    const [authError, setAuthError] = useState('');
    const [authLoading, setAuthLoading] = useState(false);
    const [resendCooldown, setResendCooldown] = useState(0);

    // Password validation
    const validatePassword = (password: string): { valid: boolean; message: string } => {
        if (password.length < 8) {
            return {
                valid: false,
                message: language === 'tr'
                    ? 'Şifre en az 8 karakter olmalı'
                    : language === 'ru'
                        ? 'Пароль минимум 8 символов'
                        : 'Password must be at least 8 characters'
            };
        }
        return { valid: true, message: '' };
    };

    // Age validation
    const validateAge = (birthYear: string): boolean => {
        const year = parseInt(birthYear);
        const currentYear = new Date().getFullYear();
        const age = currentYear - year;
        return age >= 13 && age <= 120;
    };

    const handleReset = () => {
        resetAllData();
        refreshData();
        setShowResetConfirm(false);
    };

    const handleAuth = async () => {
        setAuthError('');

        // Validation for register mode
        if (authMode === 'register') {
            // Name validation
            if (!authForm.name.trim()) {
                setAuthError(language === 'tr'
                    ? 'Ad alanı zorunludur'
                    : language === 'ru'
                        ? 'Имя обязательно'
                        : 'First name is required');
                return;
            }
            if (!authForm.surname.trim()) {
                setAuthError(language === 'tr'
                    ? 'Soyad alanı zorunludur'
                    : language === 'ru'
                        ? 'Фамилия обязательна'
                        : 'Last name is required');
                return;
            }
            if (!authForm.birthYear || !validateAge(authForm.birthYear)) {
                setAuthError(language === 'tr'
                    ? 'Geçerli bir doğum yılı girin (13 yaş ve üzeri)'
                    : language === 'ru'
                        ? 'Введите год рождения (13+ лет)'
                        : 'Enter a valid birth year (13 years or older)');
                return;
            }
            // Password validation
            const passwordCheck = validatePassword(authForm.password);
            if (!passwordCheck.valid) {
                setAuthError(passwordCheck.message);
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
                result = await register(authForm.email, authForm.password, fullName);
            }

            if (result.success) {
                if (result.needsOTPVerification) {
                    // OTP verification needed - modal will show OTP input via pendingVerificationEmail
                    setAuthError('');
                    setOtpCode('');
                    // Start resend cooldown
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
                } else {
                    setShowAuthModal(false);
                    setAuthForm({ email: '', password: '', confirmPassword: '', name: '', surname: '', birthYear: '' });
                }
            } else {
                setAuthError(result.error || (language === 'tr'
                    ? 'Geçersiz bilgiler. Lütfen tekrar deneyin.'
                    : language === 'ru'
                        ? 'Неверные данные. Попробуйте снова.'
                        : 'Invalid credentials. Please try again.'));
            }
        } catch {
            setAuthError(language === 'tr'
                ? 'Bir hata oluştu.'
                : language === 'ru'
                    ? 'Произошла ошибка.'
                    : 'An error occurred.');
        } finally {
            setAuthLoading(false);
        }
    };

    // Calculate total reviews and accuracy
    const totalReviews = userProgress.quiz_history.length;
    const correctReviews = userProgress.quiz_history.filter(q => q.is_correct).length;
    const accuracy = totalReviews > 0 ? Math.round((correctReviews / totalReviews) * 100) : 0;

    return (
        <div className="page-content px-4 py-6">
            {/* Header */}
            <header className="text-center mb-8">
                <div className="w-20 h-20 bg-gradient-to-br from-primary-400 to-primary-600 rounded-full mx-auto mb-4 flex items-center justify-center shadow-lg">
                    <User className="w-10 h-10 text-white" />
                </div>
                <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                    {isAuthenticated ? user?.name : t('profile.title')}
                </h1>
                {isAuthenticated && (
                    <p className="text-sm text-gray-500 dark:text-gray-400">{user?.email}</p>
                )}
            </header>

            {/* Auth Section */}
            {!isAuthenticated ? (
                <section className="mb-6">
                    <div className="bg-gradient-to-br from-primary-500 to-primary-600 rounded-2xl p-5 text-white">
                        <div className="flex items-center gap-3 mb-3">
                            <LogIn className="w-5 h-5" />
                            <h3 className="font-semibold">{t('auth.login')} / {t('auth.register')}</h3>
                        </div>
                        <p className="text-white/80 text-sm mb-4">
                            {language === 'tr'
                                ? `Giriş yaparak sınırsız favori ekleyebilirsiniz. Kalan hak: ${favoritesRemaining}`
                                : language === 'ru'
                                    ? `Войдите для безлимитного избранного. Осталось: ${favoritesRemaining}`
                                    : `Sign in for unlimited favorites. Remaining: ${favoritesRemaining}`
                            }
                        </p>
                        <div className="flex gap-3">
                            <button
                                onClick={() => { setAuthMode('login'); setShowAuthModal(true); }}
                                className="flex-1 py-3 bg-white text-primary-600 font-semibold rounded-xl hover:bg-primary-50 transition-colors"
                            >
                                {t('auth.login')}
                            </button>
                            <button
                                onClick={() => { setAuthMode('register'); setShowAuthModal(true); }}
                                className="flex-1 py-3 bg-white/20 text-white font-semibold rounded-xl hover:bg-white/30 transition-colors"
                            >
                                {t('auth.register')}
                            </button>
                        </div>
                    </div>
                </section>
            ) : (
                <section className="mb-6">
                    <button
                        onClick={logout}
                        className="w-full flex items-center justify-center gap-2 py-3 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-medium rounded-xl hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                    >
                        <LogOut className="w-5 h-5" />
                        {t('auth.logout')}
                    </button>
                </section>
            )}

            {/* Statistics Grid */}
            <section className="mb-8">
                <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-4">
                    {t('profile.statistics')}
                </h2>

                <div className="grid grid-cols-2 gap-4">
                    {/* Streak */}
                    <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-700">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-xl">
                                <Flame className="w-5 h-5 text-orange-500" />
                            </div>
                            <span className="text-sm text-gray-500 dark:text-gray-400">{t('profile.currentStreak')}</span>
                        </div>
                        <p className="text-2xl font-bold text-gray-900 dark:text-white">
                            {userProgress.current_streak} <span className="text-sm font-normal text-gray-400">{t('profile.days')}</span>
                        </p>
                    </div>

                    {/* Favorites */}
                    <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="p-2 bg-primary-100 rounded-xl">
                                <BookMarked className="w-5 h-5 text-primary-500" />
                            </div>
                            <span className="text-sm text-gray-500">{t('profile.favoriteCount')}</span>
                        </div>
                        <p className="text-2xl font-bold text-gray-900">
                            {stats.totalFavorites}
                            {!isAuthenticated && (
                                <span className="text-sm font-normal text-gray-400"> / 50</span>
                            )}
                        </p>
                    </div>

                    {/* Mastered */}
                    <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="p-2 bg-green-100 rounded-xl">
                                <Trophy className="w-5 h-5 text-green-500" />
                            </div>
                            <span className="text-sm text-gray-500">{t('profile.masteredWords')}</span>
                        </div>
                        <p className="text-2xl font-bold text-gray-900">{stats.mastered}</p>
                    </div>

                    {/* Learning */}
                    <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="p-2 bg-blue-100 rounded-xl">
                                <BookOpen className="w-5 h-5 text-blue-500" />
                            </div>
                            <span className="text-sm text-gray-500">{t('profile.learningWords')}</span>
                        </div>
                        <p className="text-2xl font-bold text-gray-900">{stats.learning}</p>
                    </div>

                    {/* Total Reviews */}
                    <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="p-2 bg-purple-100 rounded-xl">
                                <RotateCcw className="w-5 h-5 text-purple-500" />
                            </div>
                            <span className="text-sm text-gray-500">{t('profile.totalReviews')}</span>
                        </div>
                        <p className="text-2xl font-bold text-gray-900">{totalReviews}</p>
                    </div>

                    {/* Accuracy */}
                    <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="p-2 bg-accent-100 rounded-xl">
                                <Target className="w-5 h-5 text-accent-500" />
                            </div>
                            <span className="text-sm text-gray-500">{t('profile.accuracy')}</span>
                        </div>
                        <p className="text-2xl font-bold text-gray-900">%{accuracy}</p>
                    </div>
                </div>
            </section>

            {/* Settings */}
            <section className="mb-8">
                <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">
                    {t('common.settings')}
                </h2>

                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                    {/* Language Selection */}
                    <div className="p-4 border-b border-gray-100">
                        <div className="flex items-center gap-3 mb-3">
                            <Globe className="w-5 h-5 text-gray-400" />
                            <span className="font-medium text-gray-900">{t('profile.language')}</span>
                        </div>

                        <div className="flex gap-2">
                            {(['tr', 'en', 'ru'] as Language[]).map((lang) => (
                                <button
                                    key={lang}
                                    onClick={() => setLanguage(lang)}
                                    className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-medium transition-all ${language === lang
                                        ? 'bg-primary-500 text-white shadow-md'
                                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300'
                                        }`}
                                >
                                    <span>{languageFlags[lang]}</span>
                                    <span className="text-sm">{languageNames[lang].native}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Theme Selection */}
                    <div className="p-4 border-b border-gray-100 dark:border-gray-700">
                        <div className="flex items-center gap-3 mb-3">
                            {theme === 'dark' ? (
                                <Moon className="w-5 h-5 text-gray-400" />
                            ) : theme === 'light' ? (
                                <Sun className="w-5 h-5 text-gray-400" />
                            ) : (
                                <Monitor className="w-5 h-5 text-gray-400" />
                            )}
                            <span className="font-medium text-gray-900 dark:text-white">
                                {language === 'tr' ? 'Tema' : language === 'ru' ? 'Тема' : 'Theme'}
                            </span>
                        </div>

                        <div className="flex gap-2">
                            <button
                                onClick={() => setTheme('light')}
                                className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-medium transition-all ${theme === 'light'
                                    ? 'bg-primary-500 text-white shadow-md'
                                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300'
                                    }`}
                            >
                                <Sun className="w-4 h-4" />
                                <span className="text-sm">
                                    {language === 'tr' ? 'Açık' : language === 'ru' ? 'Светлая' : 'Light'}
                                </span>
                            </button>
                            <button
                                onClick={() => setTheme('dark')}
                                className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-medium transition-all ${theme === 'dark'
                                    ? 'bg-primary-500 text-white shadow-md'
                                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300'
                                    }`}
                            >
                                <Moon className="w-4 h-4" />
                                <span className="text-sm">
                                    {language === 'tr' ? 'Koyu' : language === 'ru' ? 'Тёмная' : 'Dark'}
                                </span>
                            </button>
                            <button
                                onClick={() => setTheme('system')}
                                className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-medium transition-all ${theme === 'system'
                                    ? 'bg-primary-500 text-white shadow-md'
                                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300'
                                    }`}
                            >
                                <Monitor className="w-4 h-4" />
                                <span className="text-sm">
                                    {language === 'tr' ? 'Sistem' : language === 'ru' ? 'Система' : 'System'}
                                </span>
                            </button>
                        </div>
                    </div>

                    {/* Analytics */}
                    <Link
                        href="/analytics"
                        className="w-full p-4 flex items-center justify-between text-gray-700 hover:bg-gray-50 transition-colors border-b border-gray-100"
                    >
                        <div className="flex items-center gap-3">
                            <BarChart3 className="w-5 h-5 text-gray-400" />
                            <span className="font-medium">
                                {language === 'tr' ? 'Analitik' : language === 'ru' ? 'Аналитика' : 'Analytics'}
                            </span>
                        </div>
                        <ChevronRight className="w-5 h-5 text-gray-400" />
                    </Link>

                    {/* About */}
                    <Link
                        href="/about"
                        className="w-full p-4 flex items-center justify-between text-gray-700 hover:bg-gray-50 transition-colors border-b border-gray-100"
                    >
                        <div className="flex items-center gap-3">
                            <Info className="w-5 h-5 text-gray-400" />
                            <span className="font-medium">{t('about.viewAbout')}</span>
                        </div>
                        <ChevronRight className="w-5 h-5 text-gray-400" />
                    </Link>

                    {/* Methodology */}
                    <Link
                        href="/methodology"
                        className="w-full p-4 flex items-center justify-between text-gray-700 hover:bg-gray-50 transition-colors border-b border-gray-100"
                    >
                        <div className="flex items-center gap-3">
                            <Brain className="w-5 h-5 text-gray-400" />
                            <span className="font-medium">
                                {language === 'tr' ? 'Metodoloji' : language === 'ru' ? 'Методология' : 'Methodology'}
                            </span>
                        </div>
                        <ChevronRight className="w-5 h-5 text-gray-400" />
                    </Link>

                    {/* Reset Data */}
                    <button
                        onClick={() => setShowResetConfirm(true)}
                        className="w-full p-4 flex items-center justify-between text-red-500 hover:bg-red-50 transition-colors"
                    >
                        <div className="flex items-center gap-3">
                            <RotateCcw className="w-5 h-5" />
                            <span className="font-medium">{t('profile.resetData')}</span>
                        </div>
                        <ChevronRight className="w-5 h-5" />
                    </button>
                </div>
            </section>

            {/* Auth Modal */}
            {(showAuthModal || pendingVerificationEmail) && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 animate-fade-in">
                    <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 max-w-sm w-full shadow-xl max-h-[90vh] overflow-y-auto">

                        {/* OTP Verification Screen */}
                        {pendingVerificationEmail ? (
                            <>
                                <div className="flex items-center gap-3 mb-6">
                                    <Mail className="w-6 h-6 text-primary-500" />
                                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                                        {language === 'tr' ? 'E-posta Doğrulama' : language === 'ru' ? 'Подтверждение email' : 'Email Verification'}
                                    </h3>
                                </div>

                                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                                    {language === 'tr'
                                        ? `${pendingVerificationEmail} adresine 8 haneli bir kod gönderdik.`
                                        : language === 'ru'
                                            ? `Мы отправили 8-значный код на ${pendingVerificationEmail}.`
                                            : `We sent an 8-digit code to ${pendingVerificationEmail}.`}
                                </p>

                                <div className="space-y-4">
                                    {/* OTP Input */}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                            {language === 'tr' ? 'Doğrulama Kodu' : language === 'ru' ? 'Код подтверждения' : 'Verification Code'}
                                        </label>
                                        <input
                                            type="text"
                                            inputMode="numeric"
                                            maxLength={8}
                                            value={otpCode}
                                            onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 8))}
                                            className="w-full px-4 py-4 text-center text-2xl font-mono tracking-[0.2em] border border-gray-200 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
                                            placeholder="00000000"
                                            autoFocus
                                        />
                                    </div>

                                    {authError && (
                                        <p className="text-sm text-red-500">{authError}</p>
                                    )}

                                    <button
                                        onClick={async () => {
                                            if (otpCode.length !== 8) {
                                                setAuthError(language === 'tr' ? '8 haneli kodu girin' : language === 'ru' ? 'Введите 8-значный код' : 'Enter 8-digit code');
                                                return;
                                            }
                                            setAuthLoading(true);
                                            setAuthError('');
                                            const result = await verifyOTP(pendingVerificationEmail, otpCode);
                                            setAuthLoading(false);
                                            if (result.success) {
                                                setShowAuthModal(false);
                                                setAuthForm({ email: '', password: '', confirmPassword: '', name: '', surname: '', birthYear: '' });
                                                setOtpCode('');
                                            } else {
                                                setAuthError(result.error || (language === 'tr' ? 'Geçersiz kod' : language === 'ru' ? 'Неверный код' : 'Invalid code'));
                                            }
                                        }}
                                        disabled={authLoading || otpCode.length !== 8}
                                        className="w-full py-3 bg-primary-500 text-white font-semibold rounded-xl hover:bg-primary-600 transition-colors disabled:opacity-50"
                                    >
                                        {authLoading ? '...' : (language === 'tr' ? 'Doğrula' : language === 'ru' ? 'Подтвердить' : 'Verify')}
                                    </button>

                                    <button
                                        onClick={async () => {
                                            if (resendCooldown > 0) return;
                                            setAuthLoading(true);
                                            const result = await resendOTP(pendingVerificationEmail);
                                            setAuthLoading(false);
                                            if (result.success) {
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
                                                setAuthError(language === 'tr' ? '✅ Yeni kod gönderildi!' : language === 'ru' ? '✅ Новый код отправлен!' : '✅ New code sent!');
                                            } else {
                                                setAuthError(result.error || (language === 'tr' ? 'Kod gönderilemedi' : language === 'ru' ? 'Не удалось отправить код' : 'Failed to send code'));
                                            }
                                        }}
                                        disabled={authLoading || resendCooldown > 0}
                                        className="w-full text-sm text-gray-500 dark:text-gray-400 hover:text-primary-500 disabled:opacity-50"
                                    >
                                        {resendCooldown > 0
                                            ? `${language === 'tr' ? 'Tekrar gönder' : language === 'ru' ? 'Отправить снова' : 'Resend'} (${resendCooldown}s)`
                                            : (language === 'tr' ? 'Kodu tekrar gönder' : language === 'ru' ? 'Отправить код снова' : 'Resend code')}
                                    </button>

                                    <button
                                        onClick={() => {
                                            cancelVerification();
                                            setShowAuthModal(false);
                                            setOtpCode('');
                                            setAuthError('');
                                        }}
                                        className="w-full py-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                                    >
                                        {language === 'tr' ? 'İptal' : language === 'ru' ? 'Отмена' : 'Cancel'}
                                    </button>
                                </div>
                            </>
                        ) : authMode === 'update-password' ? (
                            /* Update Password Form */
                            <>
                                <div className="flex items-center gap-3 mb-6">
                                    <Lock className="w-6 h-6 text-primary-500" />
                                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                                        {language === 'tr' ? 'Yeni Şifre Belirle' : language === 'ru' ? 'Установить новый пароль' : 'Set New Password'}
                                    </h3>
                                </div>

                                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                                    {language === 'tr'
                                        ? 'Lütfen yeni şifrenizi girin.'
                                        : language === 'ru'
                                            ? 'Пожалуйста, введите новый пароль.'
                                            : 'Please enter your new password.'}
                                </p>

                                <div className="space-y-4">
                                    {/* New Password */}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                            {language === 'tr' ? 'Yeni Şifre' : language === 'ru' ? 'Новый пароль' : 'New Password'}
                                        </label>
                                        <div className="relative">
                                            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                            <input
                                                type="password"
                                                value={authForm.password}
                                                onChange={(e) => setAuthForm({ ...authForm, password: e.target.value })}
                                                className="w-full pl-10 pr-4 py-3 border border-gray-200 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
                                                placeholder="********"
                                            />
                                        </div>
                                    </div>

                                    {/* Confirm Password */}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                            {language === 'tr' ? 'Şifreyi Onayla' : language === 'ru' ? 'Подтвердите пароль' : 'Confirm Password'}
                                        </label>
                                        <div className="relative">
                                            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                            <input
                                                type="password"
                                                value={authForm.confirmPassword}
                                                onChange={(e) => setAuthForm({ ...authForm, confirmPassword: e.target.value })}
                                                className="w-full pl-10 pr-4 py-3 border border-gray-200 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
                                                placeholder="********"
                                            />
                                        </div>
                                    </div>

                                    {authError && (
                                        <p className={`text-sm ${authError.startsWith('✅') ? 'text-green-500' : 'text-red-500'}`}>
                                            {authError}
                                        </p>
                                    )}

                                    <button
                                        onClick={async () => {
                                            if (authForm.password.length < 8) {
                                                setAuthError(language === 'tr' ? 'Şifre en az 8 karakter olmalı' : language === 'ru' ? 'Пароль минимум 8 символов' : 'Password must be at least 8 characters');
                                                return;
                                            }
                                            if (authForm.password !== authForm.confirmPassword) {
                                                setAuthError(language === 'tr' ? 'Şifreler uyuşmuyor' : language === 'ru' ? 'Пароли не совпадают' : 'Passwords do not match');
                                                return;
                                            }

                                            setAuthLoading(true);
                                            setAuthError('');

                                            try {
                                                console.log('Calling updatePassword...');
                                                const result = await updatePassword(authForm.password);
                                                console.log('updatePassword result:', result);

                                                if (result.success) {
                                                    // Immediately close modal and reset
                                                    setAuthLoading(false);
                                                    setShowAuthModal(false);
                                                    setAuthForm({ email: '', password: '', confirmPassword: '', name: '', surname: '', birthYear: '' });
                                                    setAuthError('');

                                                    // Show toast or alert and logout
                                                    alert(language === 'tr'
                                                        ? 'Şifreniz başarıyla değiştirildi! Yeni şifrenizle giriş yapabilirsiniz.'
                                                        : language === 'ru'
                                                            ? 'Пароль успешно изменен! Войдите с новым паролем.'
                                                            : 'Password successfully changed! Please login with your new password.');

                                                    // Logout and redirect
                                                    await logout();
                                                    return;
                                                } else {
                                                    setAuthError(result.error || 'Error');
                                                }
                                            } catch (e: any) {
                                                console.error('Unexpected error in Update Password UI:', e);
                                                setAuthError(`Unexpected error: ${e.message}`);
                                            } finally {
                                                setAuthLoading(false);
                                            }
                                        }}
                                        disabled={authLoading}
                                        className="w-full py-3 bg-primary-500 text-white font-semibold rounded-xl hover:bg-primary-600 transition-colors disabled:opacity-50"
                                    >
                                        {authLoading ? '...' : (language === 'tr' ? 'Şifreyi Güncelle' : language === 'ru' ? 'Обновить пароль' : 'Update Password')}
                                    </button>
                                </div>
                            </>
                        ) : (
                            /* Normal Auth Form */
                            <>
                                <div className="flex items-center gap-3 mb-6">
                                    {authMode === 'login' ? (
                                        <LogIn className="w-6 h-6 text-primary-500" />
                                    ) : authMode === 'register' ? (
                                        <UserPlus className="w-6 h-6 text-primary-500" />
                                    ) : (
                                        <Lock className="w-6 h-6 text-primary-500" />
                                    )}
                                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                                        {authMode === 'login'
                                            ? t('auth.login')
                                            : authMode === 'register'
                                                ? t('auth.register')
                                                : (language === 'tr' ? 'Şifre Sıfırlama' : language === 'ru' ? 'Сброс пароля' : 'Reset Password')}
                                    </h3>
                                </div>

                                <div className="space-y-4">
                                    {authMode === 'forgot-password' ? (
                                        <>
                                            <p className="text-sm text-gray-600 dark:text-gray-400">
                                                {language === 'tr'
                                                    ? 'E-posta adresinizi girin. Size şifre sıfırlama bağlantısı göndereceğiz.'
                                                    : language === 'ru'
                                                        ? 'Введите ваш email. Мы отправим ссылку для сброса пароля.'
                                                        : 'Enter your email address. We will send you a password reset link.'}
                                            </p>

                                            {/* Email for Reset */}
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                                    {t('auth.email')}
                                                </label>
                                                <div className="relative">
                                                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                                    <input
                                                        type="email"
                                                        value={authForm.email}
                                                        onChange={(e) => setAuthForm({ ...authForm, email: e.target.value })}
                                                        className="w-full pl-10 pr-4 py-3 border border-gray-200 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
                                                        placeholder={t('auth.email')}
                                                    />
                                                </div>
                                            </div>

                                            {authError && (
                                                <p className={`text-sm ${authError.startsWith('✅') ? 'text-green-500' : 'text-red-500'}`}>
                                                    {authError}
                                                </p>
                                            )}

                                            <button
                                                onClick={async () => {
                                                    if (!authForm.email) {
                                                        setAuthError(language === 'tr' ? 'E-posta girin' : language === 'ru' ? 'Введите email' : 'Enter email');
                                                        return;
                                                    }
                                                    setAuthLoading(true);
                                                    setAuthError('');
                                                    const result = await resetPassword(authForm.email);
                                                    setAuthLoading(false);
                                                    if (result.success) {
                                                        setAuthError(language === 'tr'
                                                            ? '✅ Bağlantı gönderildi! (Spam klasörünü kontrol ediniz)'
                                                            : language === 'ru'
                                                                ? '✅ Ссылка отправлена! (Проверьте спам)'
                                                                : '✅ Reset link sent! (Check your spam folder)');
                                                    } else {
                                                        setAuthError(result.error || 'Error');
                                                    }
                                                }}
                                                disabled={authLoading}
                                                className="w-full py-3 bg-primary-500 text-white font-semibold rounded-xl hover:bg-primary-600 transition-colors disabled:opacity-50"
                                            >
                                                {authLoading ? '...' : (language === 'tr' ? 'Bağlantı Gönder' : language === 'ru' ? 'Отправить ссылку' : 'Send Link')}
                                            </button>

                                            <button
                                                onClick={() => {
                                                    setAuthMode('login');
                                                    setAuthError('');
                                                }}
                                                className="w-full py-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                                            >
                                                {language === 'tr' ? 'Girişe Dön' : language === 'ru' ? 'Назад ко входу' : 'Back to Login'}
                                            </button>
                                        </>
                                    ) : (
                                        <>
                                            {authMode === 'register' && (
                                                <>
                                                    {/* Name */}
                                                    <div>
                                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                                            {language === 'tr' ? 'Ad *' : language === 'ru' ? 'Имя *' : 'First Name *'}
                                                        </label>
                                                        <div className="relative">
                                                            <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                                            <input
                                                                type="text"
                                                                value={authForm.name}
                                                                onChange={(e) => setAuthForm({ ...authForm, name: e.target.value })}
                                                                className="w-full pl-10 pr-4 py-3 border border-gray-200 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
                                                                placeholder={language === 'tr' ? 'Adınız' : language === 'ru' ? 'Ваше имя' : 'Your first name'}
                                                            />
                                                        </div>
                                                    </div>

                                                    {/* Surname */}
                                                    <div>
                                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                                            {language === 'tr' ? 'Soyad *' : language === 'ru' ? 'Фамилия *' : 'Last Name *'}
                                                        </label>
                                                        <div className="relative">
                                                            <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                                            <input
                                                                type="text"
                                                                value={authForm.surname}
                                                                onChange={(e) => setAuthForm({ ...authForm, surname: e.target.value })}
                                                                className="w-full pl-10 pr-4 py-3 border border-gray-200 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
                                                                placeholder={language === 'tr' ? 'Soyadınız' : language === 'ru' ? 'Ваша фамилия' : 'Your last name'}
                                                            />
                                                        </div>
                                                    </div>

                                                    {/* Birth Year */}
                                                    <div>
                                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                                            {language === 'tr' ? 'Doğum Yılı *' : language === 'ru' ? 'Год рождения *' : 'Birth Year *'}
                                                        </label>
                                                        <div className="relative">
                                                            <input
                                                                type="number"
                                                                min="1900"
                                                                max={new Date().getFullYear() - 13}
                                                                value={authForm.birthYear}
                                                                onChange={(e) => setAuthForm({ ...authForm, birthYear: e.target.value })}
                                                                className="w-full px-4 py-3 border border-gray-200 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
                                                                placeholder={language === 'tr' ? 'Örn: 1995' : language === 'ru' ? 'Напр: 1995' : 'e.g. 1995'}
                                                            />
                                                        </div>
                                                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                                            {language === 'tr' ? '13 yaş ve üzeri' : language === 'ru' ? '13 лет и старше' : '13 years or older'}
                                                        </p>
                                                    </div>
                                                </>
                                            )}

                                            {/* Email */}
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                                    {t('auth.email')}
                                                </label>
                                                <div className="relative">
                                                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                                    <input
                                                        type="email"
                                                        value={authForm.email}
                                                        onChange={(e) => setAuthForm({ ...authForm, email: e.target.value })}
                                                        className="w-full pl-10 pr-4 py-3 border border-gray-200 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
                                                        placeholder={t('auth.email')}
                                                    />
                                                </div>
                                            </div>

                                            {/* Password */}
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                                    {t('auth.password')}
                                                </label>
                                                <div className="relative">
                                                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                                    <input
                                                        type="password"
                                                        value={authForm.password}
                                                        onChange={(e) => setAuthForm({ ...authForm, password: e.target.value })}
                                                        className="w-full pl-10 pr-4 py-3 border border-gray-200 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
                                                        placeholder={t('auth.password')}
                                                    />
                                                </div>
                                                {authMode === 'register' && (
                                                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                                        {language === 'tr'
                                                            ? 'En az 8 karakter'
                                                            : language === 'ru'
                                                                ? 'Минимум 8 символов'
                                                                : 'Minimum 8 characters'}
                                                    </p>
                                                )}
                                                {authMode === 'login' && (
                                                    <div className="flex justify-end mt-1">
                                                        <button
                                                            onClick={() => {
                                                                setAuthMode('forgot-password');
                                                                setAuthError('');
                                                            }}
                                                            className="text-xs text-primary-500 dark:text-primary-300 hover:text-primary-600 dark:hover:text-primary-200 font-medium"
                                                        >
                                                            {language === 'tr' ? 'Şifremi Unuttum?' : language === 'ru' ? 'Забыли пароль?' : 'Forgot Password?'}
                                                        </button>
                                                    </div>
                                                )}
                                            </div>

                                            {authError && (
                                                <p className={`text-sm ${authError.startsWith('✅') ? 'text-green-500' : 'text-red-500'}`}>
                                                    {authError}
                                                </p>
                                            )}

                                            <button
                                                onClick={handleAuth}
                                                disabled={authLoading}
                                                className="w-full py-3 bg-primary-500 text-white font-semibold rounded-xl hover:bg-primary-600 transition-colors disabled:opacity-50"
                                            >
                                                {authLoading
                                                    ? '...'
                                                    : authMode === 'login'
                                                        ? t('auth.login')
                                                        : t('auth.register')
                                                }
                                            </button>

                                            <button
                                                onClick={() => setAuthMode(authMode === 'login' ? 'register' : 'login')}
                                                className="w-full text-sm text-gray-500 dark:text-gray-400 hover:text-primary-500"
                                            >
                                                {authMode === 'login' ? t('auth.noAccount') : t('auth.alreadyHaveAccount')}
                                            </button>

                                            <button
                                                onClick={() => setShowAuthModal(false)}
                                                className="w-full py-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                                            >
                                                {t('auth.guest')}
                                            </button>
                                        </>
                                    )}
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}

            {/* Reset Confirmation Modal */}
            {showResetConfirm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 animate-fade-in">
                    <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-xl">
                        <div className="flex items-center gap-3 text-red-500 mb-4">
                            <AlertTriangle className="w-6 h-6" />
                            <h3 className="text-lg font-bold">
                                {language === 'tr' ? 'Dikkat!' : language === 'ru' ? 'Внимание!' : 'Warning!'}
                            </h3>
                        </div>

                        <p className="text-gray-600 mb-6">
                            {language === 'tr'
                                ? 'Tüm ilerlemeniz, favorileriniz ve quiz geçmişiniz silinecek. Bu işlem geri alınamaz.'
                                : language === 'ru'
                                    ? 'Весь ваш прогресс, избранное и история тестов будут удалены. Это действие необратимо.'
                                    : 'All your progress, favorites and quiz history will be deleted. This action cannot be undone.'
                            }
                        </p>

                        <div className="flex gap-3">
                            <button
                                onClick={() => setShowResetConfirm(false)}
                                className="flex-1 py-3 bg-gray-100 text-gray-700 font-medium rounded-xl hover:bg-gray-200 transition-colors"
                            >
                                {language === 'tr' ? 'İptal' : language === 'ru' ? 'Отмена' : 'Cancel'}
                            </button>
                            <button
                                onClick={handleReset}
                                className="flex-1 py-3 bg-red-500 text-white font-medium rounded-xl hover:bg-red-600 transition-colors"
                            >
                                {language === 'tr' ? 'Sıfırla' : language === 'ru' ? 'Сбросить' : 'Reset'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* App Info */}
            <footer className="text-center text-xs text-gray-400">
                <p>FinTechTerms v0.1.0</p>
                <p className="mt-1">TR-EN-RU Ekonomi ve Bilişim Sözlüğü</p>
            </footer>
        </div>
    );
}

export default function ProfilePage() {
    return (
        <Suspense fallback={<div className="page-content px-4 py-6 text-center">Loading...</div>}>
            <ProfileContent />
        </Suspense>
    );
}
