import React, { useState } from 'react';
import { Mail, Lock, Eye, EyeOff } from 'lucide-react';
import { AuthFormProps, AuthFormState } from './types';
import { getLocalizedAuthError } from '@/lib/auth/error-messages';
import { logger } from '@/lib/logger';

export const AuthForm: React.FC<AuthFormProps> = ({
    authMode, setAuthMode, authForm, setAuthForm,
    authLoading, handleAuth, handleGoogleAuth, authError, setAuthError,
    showPassword, setShowPassword, showConfirmPassword,
    setShowConfirmPassword, resetPassword, showToast, language, t
}) => {
    const copy = {
        login: t('auth.login'),
        register: t('auth.register'),
        resetPassword: t('auth.resetPassword'),
        continueWithGoogle: t('auth.continueWithGoogle'),
        email: t('auth.email'),
        password: t('auth.password'),
        confirmPassword: t('auth.confirmPassword'),
        name: t('auth.firstName'),
        surname: t('auth.lastName'),
        birthDate: t('profileForm.birthDate'),
        loginLoading: t('auth.loginLoading'),
        registerLoading: t('auth.registerLoading'),
        resetLoading: t('auth.resetLoading'),
        sendResetLink: t('auth.sendResetLink'),
        forgotPassword: t('auth.forgotPassword'),
        noAccount: t('auth.noAccount'),
        alreadyHaveAccount: t('auth.alreadyHaveAccount'),
        checkEmail: t('auth.checkEmail'),
        showPassword: t('auth.showPassword'),
        hidePassword: t('auth.hidePassword'),
    };
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
                {authMode !== 'forgot-password' ? (
                    <>
                        <button
                            type="button"
                            onClick={handleGoogleAuth}
                            disabled={authLoading}
                            data-testid="auth-google-submit"
                            className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 font-semibold text-gray-900 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:hover:bg-gray-600"
                        >
                            {copy.continueWithGoogle}
                        </button>

                        <div className="flex items-center gap-3">
                            <div className="h-px flex-1 bg-gray-200 dark:bg-gray-700" />
                            <span className="text-xs font-medium uppercase tracking-[0.16em] text-gray-400 dark:text-gray-500">
                                {t('auth.or')}
                            </span>
                            <div className="h-px flex-1 bg-gray-200 dark:bg-gray-700" />
                        </div>
                    </>
                ) : null}

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

                {authError && (
                    <p
                        data-testid="auth-error"
                        role="alert"
                        className="text-sm text-red-500 animate-fade-in"
                    >
                        {authError}
                    </p>
                )}

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
                                logger.error('AUTH_RESET_PASSWORD_UI_ERROR', {
                                    route: 'AuthForm',
                                    error: error instanceof Error ? error : undefined,
                                });
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
