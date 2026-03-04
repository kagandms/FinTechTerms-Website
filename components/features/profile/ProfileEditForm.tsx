'use client';

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { createProfileSchema, ProfileFormValues } from '@/lib/validations/profile';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useRouter } from 'next/navigation';

interface ProfileEditFormProps {
    language: 'tr' | 'en' | 'ru';
}

export const ProfileEditForm: React.FC<ProfileEditFormProps> = ({ language }) => {
    const { user } = useAuth();
    const { showToast } = useToast();
    const router = useRouter();

    const [showPasswordSection, setShowPasswordSection] = useState(false);

    // Password visibility toggles
    const [showCurrentPassword, setShowCurrentPassword] = useState(false);
    const [showNewPassword, setShowNewPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);

    // Split name into first and last name safely
    const nameParts = user?.name ? user.name.split(' ') : [''];
    const defaultFirstName = nameParts[0];
    const defaultLastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : '';

    const {
        register,
        handleSubmit,
        reset,
        formState: { errors, isSubmitting },
    } = useForm<ProfileFormValues>({
        resolver: zodResolver(createProfileSchema(language)),
        defaultValues: {
            name: defaultFirstName,
            surname: defaultLastName,
            email: user?.email || '',
            birthDate: (user as any)?.user_metadata?.birth_date || '', // Pre-filled from metadata
            currentPassword: '',
            newPassword: '',
            confirmPassword: '',
        },
    });

    const onSubmit = async (data: ProfileFormValues) => {
        try {
            // 1. Update Profile Information (User Metadata)
            const fullName = `${data.name.trim()} ${data.surname.trim()}`;

            const updatePromise = supabase.auth.updateUser({
                data: {
                    name: fullName,
                    full_name: fullName,
                    birth_date: data.birthDate,
                }
            });

            // Fallback timeout protection against frozen network requests
            const timeoutPromise = new Promise<{ error: any }>((_, reject) =>
                setTimeout(() => reject(new Error('Network timeout: Sunucu yanıt vermedi.')), 15000)
            );

            const { error: profileError } = await Promise.race([updatePromise, timeoutPromise]);

            if (profileError) throw profileError;

            // 2. Update Password (if fields are filled and valid)
            if (showPasswordSection && data.newPassword) {
                // Supabase doesn't natively require 'currentPassword' for standard authenticated users to update their own password,
                // but requiring it in the UI makes it more secure against session hijacking.
                // Note: Realistically, to verify the current password, we either re-authenticate them,
                // or we rely on the fact that they are already logged in via active JWT.

                // Optional: Re-authenticate to verify current password (Strict Security)
                const { error: reauthError } = await supabase.auth.signInWithPassword({
                    email: data.email,
                    password: data.currentPassword || ''
                });

                if (reauthError) {
                    throw new Error(
                        language === 'tr' ? 'Mevcut şifre yanlış' :
                            language === 'ru' ? 'Текущий пароль неверен' :
                                'Current password incorrect'
                    );
                }

                // Update the password
                const { error: passwordError } = await supabase.auth.updateUser({
                    password: data.newPassword
                });

                if (passwordError) throw passwordError;

                // Clear password fields after successful update
                reset((formValues) => ({
                    ...formValues,
                    currentPassword: '',
                    newPassword: '',
                    confirmPassword: ''
                }));
                setShowPasswordSection(false);

                // Password-specific success toast
                showToast(
                    language === 'tr' ? '🔐 Şifreniz başarıyla güncellendi!' :
                        language === 'ru' ? '🔐 Пароль успешно обновлён!' :
                            '🔐 Password updated successfully!',
                    'success'
                );
            }

            // Force session refresh so AuthContext picks up the new user metadata (name, birthDate) immediately
            const { data: { session: refreshedSession } } = await supabase.auth.refreshSession();

            // Verify if metadata is updated in the refreshed session
            if (refreshedSession?.user?.user_metadata?.full_name !== fullName) {
                console.warn('Metadata not immediately synced in session, waiting for next refresh cycle.');
            }

            showToast(
                language === 'tr' ? 'Bilgileriniz güncellendi ✅' :
                    language === 'ru' ? 'Профиль обновлен ✅' :
                        'Profile updated ✅',
                'success'
            );

            // Gecikmeli refresh (Toast mesajının ekranda görülebilmesi için ve session senkronizasyonu için)
            setTimeout(() => {
                if (typeof window !== 'undefined') {
                    window.location.reload(); // Hard reload for full meta sync
                }
            }, 800); // Reduced delay for snappier feel

        } catch (error: any) {
            console.error('Profile update error:', error);
            showToast(error.message || 'Something went wrong', 'error');
        }
    };

    // Dictionary for localization
    const dict = {
        name: language === 'tr' ? 'Ad' : language === 'ru' ? 'Имя' : 'First Name',
        surname: language === 'tr' ? 'Soyad' : language === 'ru' ? 'Фамилия' : 'Last Name',
        email: language === 'tr' ? 'E-posta' : language === 'ru' ? 'Эл. почта' : 'Email',
        birthDate: language === 'tr' ? 'Doğum Tarihi' : language === 'ru' ? 'Дата рождения' : 'Date of Birth',
        saveBtn: language === 'tr' ? 'Değişiklikleri Kaydet' : language === 'ru' ? 'Сохранить изменения' : 'Save Changes',
        saving: language === 'tr' ? 'Kaydediliyor...' : language === 'ru' ? 'Сохранение...' : 'Saving...',
        pwdTitle: language === 'tr' ? 'Şifre Değiştir' : language === 'ru' ? 'Изменить пароль' : 'Change Password',
        pwdCurrent: language === 'tr' ? 'Mevcut Şifre' : language === 'ru' ? 'Текущий пароль' : 'Current Password',
        pwdNew: language === 'tr' ? 'Yeni Şifre' : language === 'ru' ? 'Новый пароль' : 'New Password',
        pwdConfirm: language === 'tr' ? 'Yeni Şifre (Tekrar)' : language === 'ru' ? 'Новый пароль (Еще раз)' : 'Confirm New Password',
    };

    return (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5 bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
            {/* Personal Information */}
            <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
                {language === 'tr' ? 'Kişisel Bilgiler' : language === 'ru' ? 'Личные данные' : 'Personal Information'}
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Name */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{dict.name}</label>
                    <input
                        {...register('name')}
                        type="text"
                        className={`w-full px-4 py-2 border rounded-xl dark:bg-gray-700 dark:text-white dark:border-gray-600 focus:ring-2 focus:ring-primary-500 outline-none transition-all ${errors.name ? 'border-red-500' : 'border-gray-200'}`}
                    />
                    {errors.name && <p className="text-sm text-red-500 mt-1">{errors.name.message}</p>}
                </div>

                {/* Surname */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{dict.surname}</label>
                    <input
                        {...register('surname')}
                        type="text"
                        className={`w-full px-4 py-2 border rounded-xl dark:bg-gray-700 dark:text-white dark:border-gray-600 focus:ring-2 focus:ring-primary-500 outline-none transition-all ${errors.surname ? 'border-red-500' : 'border-gray-200'}`}
                    />
                    {errors.surname && <p className="text-sm text-red-500 mt-1">{errors.surname.message}</p>}
                </div>

                {/* Birth Date */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{dict.birthDate}</label>
                    <input
                        {...register('birthDate')}
                        type="date"
                        className={`w-full px-4 py-2 border rounded-xl dark:bg-gray-700 dark:text-white dark:border-gray-600 focus:ring-2 focus:ring-primary-500 outline-none transition-all ${errors.birthDate ? 'border-red-500' : 'border-gray-200'}`}
                    />
                    {errors.birthDate && <p className="text-sm text-red-500 mt-1">{errors.birthDate.message}</p>}
                </div>

                {/* Email (Readonly mostly, but Zod validated) */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{dict.email}</label>
                    <input
                        {...register('email')}
                        type="email"
                        disabled // Disabled by default to prevent easy email changes without explicit verification flows
                        className="w-full px-4 py-2 border border-gray-200 rounded-xl bg-gray-50 text-gray-500 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700 cursor-not-allowed"
                    />
                </div>
            </div>

            <hr className="border-gray-100 dark:border-gray-700 my-6" />

            {/* Password Change Toggle */}
            <div>
                <button
                    type="button"
                    onClick={() => setShowPasswordSection(!showPasswordSection)}
                    className="text-sm font-semibold text-primary-600 dark:text-primary-400 hover:text-primary-700 hover:underline transition-colors focus:outline-none"
                >
                    {showPasswordSection ? (language === 'tr' ? 'Şifre Değiştirmeyi İptal Et' : language === 'ru' ? 'Отменить изменение пароля' : 'Cancel Password Change') : dict.pwdTitle}
                </button>
            </div>

            {/* Password Fields */}
            {showPasswordSection && (
                <div className="space-y-4 animate-fade-in bg-gray-50 dark:bg-gray-900/50 p-4 rounded-xl border border-gray-100 dark:border-gray-800">
                    {/* Current Password */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{dict.pwdCurrent}</label>
                        <div className="relative">
                            <input
                                {...register('currentPassword')}
                                type={showCurrentPassword ? "text" : "password"}
                                className={`w-full pl-4 pr-10 py-2 border rounded-xl dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-primary-500 outline-none transition-all ${errors.currentPassword ? 'border-red-500 dark:border-red-500' : 'border-gray-200 dark:border-gray-600'}`}
                            />
                            <button
                                type="button"
                                onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                                className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600 transition-colors"
                            >
                                {showCurrentPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                            </button>
                        </div>
                        {errors.currentPassword && <p className="text-sm text-red-500 mt-1">{errors.currentPassword.message}</p>}
                    </div>

                    {/* New Password */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{dict.pwdNew}</label>
                        <div className="relative">
                            <input
                                {...register('newPassword')}
                                type={showNewPassword ? "text" : "password"}
                                className={`w-full pl-4 pr-10 py-2 border rounded-xl dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-primary-500 outline-none transition-all ${errors.newPassword ? 'border-red-500 dark:border-red-500' : 'border-gray-200 dark:border-gray-600'}`}
                            />
                            <button
                                type="button"
                                onClick={() => setShowNewPassword(!showNewPassword)}
                                className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600 transition-colors"
                            >
                                {showNewPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                            </button>
                        </div>
                        {errors.newPassword && <p className="text-sm text-red-500 mt-1">{errors.newPassword.message}</p>}
                    </div>

                    {/* Confirm New Password */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{dict.pwdConfirm}</label>
                        <div className="relative">
                            <input
                                {...register('confirmPassword')}
                                type={showConfirmPassword ? "text" : "password"}
                                className={`w-full pl-4 pr-10 py-2 border rounded-xl dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-primary-500 outline-none transition-all ${errors.confirmPassword ? 'border-red-500 dark:border-red-500' : 'border-gray-200 dark:border-gray-600'}`}
                            />
                            <button
                                type="button"
                                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600 transition-colors"
                            >
                                {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                            </button>
                        </div>
                        {errors.confirmPassword && <p className="text-sm text-red-500 mt-1">{errors.confirmPassword.message}</p>}
                    </div>
                </div>
            )}

            {/* Submit */}
            <div className="pt-2 flex justify-end">
                <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex items-center gap-2 px-6 py-3 bg-primary-500 text-white font-semibold rounded-xl hover:bg-primary-600 hover:-translate-y-0.5 active:translate-y-0 active:scale-95 transition-all disabled:opacity-70 disabled:cursor-not-allowed shadow-md shadow-primary-500/20"
                >
                    {isSubmitting ? (
                        <>
                            <Loader2 className="w-5 h-5 animate-spin" />
                            {dict.saving}
                        </>
                    ) : (
                        dict.saveBtn
                    )}
                </button>
            </div>
        </form>
    );
};
