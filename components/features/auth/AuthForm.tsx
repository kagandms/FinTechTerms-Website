import React, { useState } from 'react';
import { Mail, Lock, Eye, EyeOff } from 'lucide-react';
import { AuthFormProps, AuthFormState } from './types';
import { getLocalizedAuthError } from '@/lib/auth/error-messages';

export const AuthForm: React.FC<AuthFormProps> = ({
    authMode, setAuthMode, authForm, setAuthForm,
    authLoading, handleAuth, authError, setAuthError,
    showPassword, setShowPassword, showConfirmPassword,
    setShowConfirmPassword, resetPassword, showToast, language
}) => {
    const copy = {
        tr: {
            login: 'Giriş Yap',
            register: 'Kayıt Ol',
            resetPassword: 'Şifre Sıfırlama',
            email: 'E-posta',
            password: 'Şifre',
            confirmPassword: 'Şifreyi Onayla',
            name: 'Ad',
            surname: 'Soyad',
            birthDate: 'Doğum Tarihi',
            loginLoading: 'Giriş yapılıyor...',
            registerLoading: 'Hesap oluşturuluyor...',
            resetLoading: 'Gönderiliyor...',
            sendResetLink: 'Sıfırlama Bağlantısı Gönder',
            forgotPassword: 'Şifreni mi unuttun?',
            noAccount: 'Hesabın yok mu?',
            alreadyHaveAccount: 'Zaten hesabın var mı?',
            checkEmail: '✅ E-postanı ve spam klasörünü kontrol et',
            showPassword: 'Şifreyi göster',
            hidePassword: 'Şifreyi gizle',
        },
        en: {
            login: 'Log In',
            register: 'Sign Up',
            resetPassword: 'Reset Password',
            email: 'Email',
            password: 'Password',
            confirmPassword: 'Confirm Password',
            name: 'First Name',
            surname: 'Last Name',
            birthDate: 'Date of Birth',
            loginLoading: 'Signing in...',
            registerLoading: 'Creating account...',
            resetLoading: 'Sending...',
            sendResetLink: 'Send Reset Link',
            forgotPassword: 'Forgot password?',
            noAccount: 'No account yet?',
            alreadyHaveAccount: 'Already have an account?',
            checkEmail: '✅ Check your inbox and spam folder',
            showPassword: 'Show password',
            hidePassword: 'Hide password',
        },
        ru: {
            login: 'Войти',
            register: 'Регистрация',
            resetPassword: 'Восстановление доступа',
            email: 'Эл. почта',
            password: 'Пароль',
            confirmPassword: 'Подтвердите пароль',
            name: 'Имя',
            surname: 'Фамилия',
            birthDate: 'Дата рождения',
            loginLoading: 'Выполняется вход...',
            registerLoading: 'Создаём профиль...',
            resetLoading: 'Отправка...',
            sendResetLink: 'Отправить ссылку',
            forgotPassword: 'Забыли пароль?',
            noAccount: 'Нет аккаунта?',
            alreadyHaveAccount: 'Уже есть аккаунт?',
            checkEmail: '✅ Проверьте почту и папку «Спам»',
            showPassword: 'Показать пароль',
            hidePassword: 'Скрыть пароль',
        },
    }[language === 'tr' || language === 'en' ? language : 'ru'];
    const [isResetting, setIsResetting] = useState(false);

    const updateAuthField = (field: keyof AuthFormState, value: string) => {
        setAuthForm({ ...authForm, [field]: value });

        if (authError) {
            setAuthError('');
        }
    };

    const emailField = (
        <div className="relative">
            <Mail className="absolute left-3 top-3.5 w-5 h-5 text-gray-400" />
            <input
                type="email"
                value={authForm.email}
                onChange={(e) => updateAuthField('email', e.target.value)}
                data-testid="auth-email"
                className="w-full pl-10 pr-4 py-3 border rounded-xl dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-primary-500 transition-all"
                placeholder={copy.email}
                aria-label={copy.email}
            />
        </div>
    );

    const title = authMode === 'login'
        ? copy.login
        : authMode === 'register'
            ? copy.register
            : copy.resetPassword;

    return (
        <>
            <div className="flex items-center gap-3 mb-6">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                    {title}
                </h3>
            </div>

            <div className="space-y-4">
                {authMode !== 'register' && emailField}

                {/* Register Fields */}
                {authMode === 'register' && (
                    <>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div className="flex flex-col gap-1.5">
                                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                    {copy.name}
                                </label>
                                <input
                                    type="text"
                                    value={authForm.name}
                                    onChange={(e) => updateAuthField('name', e.target.value)}
                                    data-testid="auth-name"
                                    className="w-full px-4 py-3 border rounded-xl dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-primary-500"
                                    placeholder={copy.name}
                                    aria-label={copy.name}
                                />
                            </div>

                            <div className="flex flex-col gap-1.5">
                                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                    {copy.surname}
                                </label>
                                <input
                                    type="text"
                                    value={authForm.surname}
                                    onChange={(e) => updateAuthField('surname', e.target.value)}
                                    data-testid="auth-surname"
                                    className="w-full px-4 py-3 border rounded-xl dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-primary-500"
                                    placeholder={copy.surname}
                                    aria-label={copy.surname}
                                />
                            </div>
                        </div>

                        {emailField}

                        <div className="flex flex-col gap-1.5">
                            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                {copy.birthDate}
                            </label>
                            <input
                                type="date"
                                value={authForm.birthDate || ''}
                                onChange={(e) => updateAuthField('birthDate', e.target.value)}
                                data-testid="auth-birth-date"
                                className="auth-date-input w-full min-h-[48px] px-4 py-3 border rounded-xl bg-white text-gray-900 dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-primary-500"
                                aria-label={copy.birthDate}
                            />
                        </div>
                    </>
                )}

                {/* Password Field (Not for forgot-password) */}
                {authMode !== 'forgot-password' && (
                    <>
                        <div className="relative">
                            <Lock className="absolute left-3 top-3.5 w-5 h-5 text-gray-400" />
                            <input
                                type={showPassword ? "text" : "password"}
                                value={authForm.password}
                                onChange={(e) => updateAuthField('password', e.target.value)}
                                data-testid="auth-password"
                                className="w-full pl-10 pr-12 py-3 border rounded-xl dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-primary-500 transition-all"
                                placeholder={copy.password}
                                aria-label={copy.password}
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-3 top-3 text-gray-400 hover:text-gray-600 transition-colors"
                                aria-label={showPassword ? copy.hidePassword : copy.showPassword}
                            >
                                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                            </button>
                        </div>

                        {authMode === 'register' ? (
                            <div className="relative">
                                <Lock className="absolute left-3 top-3.5 w-5 h-5 text-gray-400" />
                                <input
                                    type={showConfirmPassword ? "text" : "password"}
                                    value={authForm.confirmPassword}
                                    onChange={(e) => updateAuthField('confirmPassword', e.target.value)}
                                    data-testid="auth-confirm-password"
                                    className="w-full pl-10 pr-12 py-3 border rounded-xl dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-primary-500 transition-all"
                                    placeholder={copy.confirmPassword}
                                    aria-label={copy.confirmPassword}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                    className="absolute right-3 top-3 text-gray-400 hover:text-gray-600 transition-colors"
                                    aria-label={showConfirmPassword ? copy.hidePassword : copy.showPassword}
                                >
                                    {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                </button>
                            </div>
                        ) : null}
                    </>
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
                                    const successMessage = copy.checkEmail;

                                    setAuthError(successMessage);
                                    showToast(successMessage, 'success');
                                } else {
                                    const errorMessage = getLocalizedAuthError(res.error, language);
                                    setAuthError(errorMessage);
                                    showToast(errorMessage, 'error');
                                }
                            } catch (error: unknown) {
                                console.error('AUTH_RESET_PASSWORD_UI_ERROR', error);
                                const errorMessage = getLocalizedAuthError(error, language);
                                setAuthError(errorMessage);
                                showToast(errorMessage, 'error');
                            } finally {
                                setIsResetting(false);
                            }
                        }}
                        disabled={isResetting}
                        className="w-full py-3 bg-primary-500 text-white font-semibold rounded-xl hover:bg-primary-600 transition-colors"
                    >
                        {isResetting ? copy.resetLoading : copy.sendResetLink}
                    </button>
                ) : (
                    <button
                        type="button"
                        onClick={handleAuth}
                        disabled={authLoading}
                        data-testid="auth-submit"
                        className="w-full py-3 bg-primary-500 text-white font-semibold rounded-xl hover:bg-primary-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {authLoading
                            ? (authMode === 'login' ? copy.loginLoading : copy.registerLoading)
                            : authMode === 'login' ? copy.login : copy.register}
                    </button>
                )}

                {/* Mode Switchers */}
                <div className="text-center space-y-2 mt-4">
                    {authMode === 'login' && (
                        <button type="button" onClick={() => setAuthMode('forgot-password')} className="text-xs text-primary-400 dark:text-primary-300 hover:text-primary-600 dark:hover:text-primary-200 hover:underline transition-colors">
                            {copy.forgotPassword}
                        </button>
                    )}
                    <button
                        type="button"
                        onClick={() => setAuthMode(authMode === 'login' ? 'register' : 'login')}
                        className="block w-full text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 transition-colors"
                    >
                        {authMode === 'login' ? copy.noAccount : copy.alreadyHaveAccount}
                    </button>
                </div>
            </div>
        </>
    );
};
