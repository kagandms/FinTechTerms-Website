import React from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { UpdatePasswordProps } from './types';

export const UpdatePasswordForm: React.FC<UpdatePasswordProps> = ({
    authForm, setAuthForm, showPassword, setShowPassword,
    authError, setAuthError, validatePassword, updatePassword,
    showToast, logout, onSuccess
}) => {
    return (
        <>
            <h3 className="text-lg font-bold mb-4 dark:text-white">Set New Password</h3>
            <div className="space-y-4">
                <div className="relative">
                    <input
                        type={showPassword ? "text" : "password"}
                        value={authForm.password}
                        onChange={(e) => setAuthForm({ ...authForm, password: e.target.value })}
                        className="w-full pl-4 pr-12 py-3 border rounded-xl dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-primary-500 transition-all"
                        placeholder="New Password"
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
                            showToast('Password updated!', 'success');
                            logout();
                            onSuccess();
                        } else {
                            setAuthError(res.error || 'Error');
                        }
                    }}
                    className="w-full py-3 bg-primary-500 text-white font-semibold rounded-xl hover:bg-primary-600 transition-colors"
                >
                    Update Password
                </button>
            </div>
        </>
    );
};
