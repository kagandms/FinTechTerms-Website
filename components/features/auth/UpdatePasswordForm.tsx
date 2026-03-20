import React, { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { UpdatePasswordProps } from './types';
import { getLocalizedAuthError } from '@/lib/auth/error-messages';
import { getTranslationString } from '@/lib/i18n';
import { logger } from '@/lib/logger';

export const UpdatePasswordForm: React.FC<UpdatePasswordProps> = ({
    authForm, setAuthForm, showPassword, setShowPassword,
    authError, setAuthError, validatePassword, updatePassword,
    showToast, logout, onSuccess, language
}) => {
    const [isUpdating, setIsUpdating] = useState(false);

    const dict = {
        title: getTranslationString(language, 'updatePassword.title') ?? 'Set New Password',
        placeholder: getTranslationString(language, 'updatePassword.placeholder') ?? 'New Password',
        btnText: getTranslationString(language, 'updatePassword.submit') ?? 'Update Password',
        loading: getTranslationString(language, 'updatePassword.loading') ?? 'Updating...',
        success: getTranslationString(language, 'updatePassword.success') ?? 'Password updated!',
        error: getTranslationString(language, 'updatePassword.error') ?? 'Error',
    };

    return (
        <>
            <h3 className="text-lg font-bold mb-4 dark:text-white">{dict.title}</h3>
            <div className="space-y-4">
                <div className="relative">
                    <input
                        type={showPassword ? "text" : "password"}
                        value={authForm.password}
                        onChange={(e) => setAuthForm({ ...authForm, password: e.target.value })}
                        className="w-full pl-4 pr-12 py-3 border rounded-xl dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-primary-500 transition-all"
                        placeholder={dict.placeholder}
                    />
                    <button
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-3 text-gray-400 hover:text-gray-600 transition-colors"
                    >
                        {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                </div>
                {authError && <p className="text-sm text-red-500">{authError}</p>}

                <button
                    onClick={async () => {
                        setIsUpdating(true);
                        setAuthError('');

                        try {
                            const check = validatePassword(authForm.password);
                            if (!check.valid) {
                                setAuthError(check.message);
                                showToast(check.message, 'error');
                                return;
                            }

                            const res = await updatePassword(authForm.password);
                            if (res.success) {
                                showToast(dict.success, 'success');
                                void Promise.resolve(logout());
                                onSuccess();
                                return;
                            }

                            const errorMessage = getLocalizedAuthError(res.error, language);
                            setAuthError(errorMessage);
                            showToast(errorMessage, 'error');
                        } catch (error: unknown) {
                            logger.error('AUTH_UPDATE_PASSWORD_UI_ERROR', {
                                route: 'UpdatePasswordForm',
                                error: error instanceof Error ? error : undefined,
                            });
                            const errorMessage = getLocalizedAuthError(error, language);
                            setAuthError(errorMessage);
                            showToast(errorMessage, 'error');
                        } finally {
                            setIsUpdating(false);
                        }
                    }}
                    disabled={isUpdating}
                    className="w-full py-3 bg-primary-500 text-white font-semibold rounded-xl hover:bg-primary-600 transition-colors"
                >
                    {isUpdating ? dict.loading : dict.btnText}
                </button>
            </div>
        </>
    );
};
