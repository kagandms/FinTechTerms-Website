import React, { useState } from 'react';
import { Mail, Lock, Eye, EyeOff } from 'lucide-react';
import { AuthFormProps } from './types';

export const AuthForm: React.FC<AuthFormProps> = ({
    authMode, setAuthMode, authForm, setAuthForm,
    authLoading, handleAuth, authError, setAuthError,
    showPassword, setShowPassword, resetPassword, showToast, t
}) => {
    const uiLang = typeof window !== 'undefined' ? localStorage.getItem('language') : 'en';
    const nameLabel = uiLang === 'tr' ? 'Ad' : uiLang === 'ru' ? 'Имя' : 'Name';
    const surnameLabel = uiLang === 'tr' ? 'Soyad' : uiLang === 'ru' ? 'Фамилия' : 'Surname';
    const birthDateLabel = uiLang === 'tr' ? 'Doğum Tarihi' : uiLang === 'ru' ? 'Дата рождения' : 'Date of Birth';
    const loginLoadingLabel = uiLang === 'tr' ? 'Giriş Yapılıyor...' : uiLang === 'ru' ? 'Выполняется вход...' : 'Signing in...';
    const registerLoadingLabel = uiLang === 'tr' ? 'Kayıt Yapılıyor...' : uiLang === 'ru' ? 'Регистрация...' : 'Registering...';
    const resetLoadingLabel = uiLang === 'tr' ? 'Gönderiliyor...' : uiLang === 'ru' ? 'Отправка...' : 'Sending...';
    const [isResetting, setIsResetting] = useState(false);

    return (
        <>
            <div className="flex items-center gap-3 mb-6">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                    {authMode === 'login' ? t('auth.login') : authMode === 'register' ? t('auth.register') :
                        (t('auth.resetPassword') || t('auth.forgotPassword') || 'Reset Password')}
                </h3>
            </div>

            <div className="space-y-4">
                {/* Email Input (Common) */}
                <div className="relative">
                    <Mail className="absolute left-3 top-3.5 w-5 h-5 text-gray-400" />
                    <input
                        type="email"
                        value={authForm.email}
                        onChange={(e) => setAuthForm({ ...authForm, email: e.target.value })}
                        className="w-full pl-10 pr-4 py-3 border rounded-xl dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-primary-500 transition-all"
                        placeholder={t('auth.email') || 'Email'}
                    />
                </div>

                {/* Register Fields */}
                {authMode === 'register' && (
                    <>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div className="flex flex-col gap-1.5">
                                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                    {nameLabel}
                                </label>
                                <input
                                    type="text"
                                    value={authForm.name}
                                    onChange={(e) => setAuthForm({ ...authForm, name: e.target.value })}
                                    className="w-full px-4 py-3 border rounded-xl dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-primary-500"
                                    placeholder={nameLabel}
                                />
                            </div>

                            <div className="flex flex-col gap-1.5">
                                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                    {surnameLabel}
                                </label>
                                <input
                                    type="text"
                                    value={authForm.surname}
                                    onChange={(e) => setAuthForm({ ...authForm, surname: e.target.value })}
                                    className="w-full px-4 py-3 border rounded-xl dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-primary-500"
                                    placeholder={surnameLabel}
                                />
                            </div>
                        </div>

                        <div className="flex flex-col gap-1.5">
                            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                {birthDateLabel}
                            </label>
                            <input
                                type="date"
                                value={authForm.birthDate || ''}
                                onChange={(e) => setAuthForm({ ...authForm, birthDate: e.target.value })}
                                className="auth-date-input w-full min-h-[48px] px-4 py-3 border rounded-xl bg-white text-gray-900 dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-primary-500"
                                aria-label={birthDateLabel}
                            />
                        </div>
                    </>
                )}

                {/* Password Field (Not for forgot-password) */}
                {authMode !== 'forgot-password' && (
                    <div className="relative">
                        <Lock className="absolute left-3 top-3.5 w-5 h-5 text-gray-400" />
                        <input
                            type={showPassword ? "text" : "password"}
                            value={authForm.password}
                            onChange={(e) => setAuthForm({ ...authForm, password: e.target.value })}
                            className="w-full pl-10 pr-12 py-3 border rounded-xl dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-primary-500 transition-all"
                            placeholder={t('auth.password')}
                        />
                        <button
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3 top-3 text-gray-400 hover:text-gray-600 transition-colors"
                        >
                            {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                        </button>
                    </div>
                )}

                {authError && <p className="text-sm text-red-500 animate-fade-in">{authError}</p>}

                {/* Main Action Button */}
                {authMode === 'forgot-password' ? (
                    <button
                        onClick={async () => {
                            setIsResetting(true);
                            setAuthError('');

                            try {
                                const res = await resetPassword(authForm.email);
                                if (res.success) {
                                    const lang = typeof window !== 'undefined' ? localStorage.getItem('language') || 'en' : 'en';
                                    const successMessage = lang === 'tr'
                                        ? '✅ Lütfen e-posta (ve spam) kutunuzu kontrol edin'
                                        : lang === 'ru'
                                            ? '✅ Проверьте почту (и папку спам)'
                                            : '✅ Check email (and spam folder)';

                                    setAuthError(successMessage);
                                    showToast(successMessage, 'success');
                                } else {
                                    const errorMessage = res.error || 'Error';
                                    setAuthError(errorMessage);
                                    showToast(errorMessage, 'error');
                                }
                            } catch (error) {
                                console.error('AUTH_RESET_PASSWORD_UI_ERROR', error);
                                const errorMessage = error instanceof Error ? error.message : 'Error';
                                setAuthError(errorMessage);
                                showToast(errorMessage, 'error');
                            } finally {
                                setIsResetting(false);
                            }
                        }}
                        disabled={isResetting}
                        className="w-full py-3 bg-primary-500 text-white font-semibold rounded-xl hover:bg-primary-600 transition-colors"
                    >
                        {isResetting ? resetLoadingLabel : (t('auth.sendResetLink') || 'Send Reset Link')}
                    </button>
                ) : (
                    <button
                        onClick={handleAuth}
                        disabled={authLoading}
                        className="w-full py-3 bg-primary-500 text-white font-semibold rounded-xl hover:bg-primary-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {authLoading
                            ? (authMode === 'login' ? loginLoadingLabel : registerLoadingLabel)
                            : authMode === 'login' ? t('auth.login') : t('auth.register')}
                    </button>
                )}

                {/* Mode Switchers */}
                <div className="text-center space-y-2 mt-4">
                    {authMode === 'login' && (
                        <button onClick={() => setAuthMode('forgot-password')} className="text-xs text-primary-400 dark:text-primary-300 hover:text-primary-600 dark:hover:text-primary-200 hover:underline transition-colors">
                            {t('auth.forgotPassword') || 'Forgot Password?'}
                        </button>
                    )}
                    <button
                        onClick={() => setAuthMode(authMode === 'login' ? 'register' : 'login')}
                        className="block w-full text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 transition-colors"
                    >
                        {authMode === 'login' ? t('auth.noAccount') : t('auth.alreadyHaveAccount')}
                    </button>
                </div>
            </div>
        </>
    );
};
