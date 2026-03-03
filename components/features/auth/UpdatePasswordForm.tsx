import React from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { UpdatePasswordProps } from './types';

export const UpdatePasswordForm: React.FC<UpdatePasswordProps> = ({
    authForm, setAuthForm, showPassword, setShowPassword,
    authError, setAuthError, validatePassword, updatePassword,
    showToast, logout, onSuccess
}) => {
    const lang = typeof window !== 'undefined' ? localStorage.getItem('language') || 'ru' : 'ru';

    const dict = {
        title: lang === 'tr' ? 'Yeni Şifre Belirle' : lang === 'ru' ? 'Новый пароль' : 'Set New Password',
        placeholder: lang === 'tr' ? 'Yeni Şifre' : lang === 'ru' ? 'Новый пароль' : 'New Password',
        btnText: lang === 'tr' ? 'Şifreyi Güncelle' : lang === 'ru' ? 'Обновить пароль' : 'Update Password',
        success: lang === 'tr' ? 'Şifreniz güncellendi!' : lang === 'ru' ? 'Пароль обновлен!' : 'Password updated!',
        error: lang === 'tr' ? 'Hata oluştu' : lang === 'ru' ? 'Ошибка' : 'Error'
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
                        const check = validatePassword(authForm.password);
                        if (!check.valid) return setAuthError(check.message);
                        const res = await updatePassword(authForm.password);
                        if (res.success) {
                            showToast(dict.success, 'success');
                            logout();
                            onSuccess();
                        } else {
                            setAuthError(res.error || dict.error);
                        }
                    }}
                    className="w-full py-3 bg-primary-500 text-white font-semibold rounded-xl hover:bg-primary-600 transition-colors"
                >
                    {dict.btnText}
                </button>
            </div>
        </>
    );
};
