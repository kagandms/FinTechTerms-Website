'use client';

import React, { useEffect, useState } from 'react';
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

type ProfileRow = {
    id: string;
    full_name: string | null;
    birth_date: string | null;
};

const withTimeout = <T,>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> => {
    return new Promise<T>((resolve, reject) => {
        const timeoutId = setTimeout(() => reject(new Error(message)), timeoutMs);
        promise
            .then((value) => {
                clearTimeout(timeoutId);
                resolve(value);
            })
            .catch((error) => {
                clearTimeout(timeoutId);
                reject(error);
            });
    });
};

const toDateInputValue = (value: unknown): string => {
    if (!value) return '';

    const raw = String(value).trim();
    if (!raw) return '';

    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
        return raw;
    }

    if (/^\d{4}-\d{2}-\d{2}T/.test(raw)) {
        return raw.slice(0, 10);
    }

    const parsed = new Date(raw);
    if (Number.isNaN(parsed.getTime())) {
        return '';
    }

    const yyyy = parsed.getUTCFullYear();
    const mm = String(parsed.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(parsed.getUTCDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
};

export const ProfileEditForm: React.FC<ProfileEditFormProps> = ({ language }) => {
    const { user } = useAuth();
    const { showToast } = useToast();
    const router = useRouter();
    const toast = {
        success: (message: string) => showToast(message, 'success'),
        error: (message: string) => showToast(message, 'error'),
    };

    const [showPasswordSection, setShowPasswordSection] = useState(false);
    const [isPending, setIsPending] = useState(false);
    const [isHydrating, setIsHydrating] = useState(true);

    // Password visibility toggles
    const [showCurrentPassword, setShowCurrentPassword] = useState(false);
    const [showNewPassword, setShowNewPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);

    const dict = {
        name: language === 'tr' ? 'Ad' : language === 'ru' ? 'Имя' : 'First Name',
        surname: language === 'tr' ? 'Soyad' : language === 'ru' ? 'Фамилия' : 'Last Name',
        email: language === 'tr' ? 'E-posta' : language === 'ru' ? 'Эл. почта' : 'Email',
        birthDate: language === 'tr' ? 'Doğum Tarihi' : language === 'ru' ? 'Дата рождения' : 'Date of Birth',
        saveBtn: language === 'tr' ? 'Değişiklikleri Kaydet' : language === 'ru' ? 'Сохранить изменения' : 'Save Changes',
        saving: language === 'tr' ? 'Kaydediliyor...' : language === 'ru' ? 'Сохранение...' : 'Saving...',
        loadingProfile: language === 'tr' ? 'Profil yükleniyor...' : language === 'ru' ? 'Загрузка профиля...' : 'Loading profile...',
        pwdTitle: language === 'tr' ? 'Şifre Değiştir' : language === 'ru' ? 'Изменить пароль' : 'Change Password',
        pwdCurrent: language === 'tr' ? 'Mevcut Şifre' : language === 'ru' ? 'Текущий пароль' : 'Current Password',
        pwdNew: language === 'tr' ? 'Yeni Şifre' : language === 'ru' ? 'Новый пароль' : 'New Password',
        pwdConfirm: language === 'tr' ? 'Yeni Şifre (Tekrar)' : language === 'ru' ? 'Новый пароль (Еще раз)' : 'Confirm New Password',
        timeoutError: language === 'tr' ? 'Sunucu zaman aşımına uğradı, lütfen tekrar deneyin.' : language === 'ru' ? 'Тайм-аут сервера, попробуйте снова.' : 'Server timeout. Please try again.',
        unknownError: language === 'tr' ? 'Bir hata oluştu.' : language === 'ru' ? 'Произошла ошибка.' : 'Something went wrong.',
        loadError: language === 'tr' ? 'Profil verileri yüklenemedi.' : language === 'ru' ? 'Не удалось загрузить профиль.' : 'Failed to load profile data.',
        profileMissing: language === 'tr' ? 'Profil satırı bulunamadı. Lütfen yöneticinizle iletişime geçin.' : language === 'ru' ? 'Строка профиля не найдена. Обратитесь к администратору.' : 'Profile row not found. Please contact support.',
        profileUpdated: language === 'tr' ? 'Bilgileriniz güncellendi ✅' : language === 'ru' ? 'Профиль обновлен ✅' : 'Profile updated ✅',
        passwordUpdated: language === 'tr' ? '🔐 Şifreniz başarıyla güncellendi!' : language === 'ru' ? '🔐 Пароль успешно обновлён!' : '🔐 Password updated successfully!',
        currentPasswordError: language === 'tr' ? 'Mevcut şifre yanlış' : language === 'ru' ? 'Текущий пароль неверен' : 'Current password incorrect',
        authRequired: language === 'tr' ? 'Oturum doğrulanamadı.' : language === 'ru' ? 'Сессия не подтверждена.' : 'Session not authenticated.',
    };

    const {
        register,
        handleSubmit,
        reset,
        formState: { errors, isSubmitting },
    } = useForm<ProfileFormValues>({
        resolver: zodResolver(createProfileSchema(language)),
        defaultValues: {
            name: '',
            surname: '',
            email: user?.email || '',
            birthDate: '',
            currentPassword: '',
            newPassword: '',
            confirmPassword: '',
        },
    });

    useEffect(() => {
        let isMounted = true;

        const hydrateProfileForm = async () => {
            setIsHydrating(true);

            try {
                const { data, error } = await withTimeout(
                    supabase.auth.getUser(),
                    15000,
                    dict.timeoutError
                );
                if (error || !data.user) {
                    throw error || new Error(dict.authRequired);
                }

                const supabaseUser = data.user;
                let fullName = (
                    supabaseUser.user_metadata?.full_name ||
                    supabaseUser.user_metadata?.name ||
                    user?.name ||
                    ''
                ).trim();
                let birthDate = toDateInputValue(supabaseUser.user_metadata?.birth_date || '');

                try {
                    const profileResult = await withTimeout(
                        (async () =>
                            supabase
                                .from('profiles')
                                .select('id, full_name, birth_date')
                                .eq('id', supabaseUser.id)
                                .maybeSingle()
                        )(),
                        15000,
                        dict.timeoutError
                    );

                    if (profileResult.error) {
                        throw profileResult.error;
                    }

                    const profile = profileResult.data as ProfileRow | null;
                    if (profile?.full_name) {
                        fullName = profile.full_name.trim();
                    }
                    if (profile?.birth_date) {
                        birthDate = toDateInputValue(profile.birth_date);
                    }
                } catch (profileError: any) {
                    const message = profileError?.message || dict.loadError;
                    showToast(message, 'error');
                }

                if (!fullName) {
                    fullName = (supabaseUser.email?.split('@')[0] || '').trim();
                }

                const nameParts = fullName ? fullName.split(' ') : [''];
                const firstName = nameParts[0] || '';
                const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : '';

                if (!isMounted) return;
                reset({
                    name: firstName,
                    surname: lastName,
                    email: supabaseUser.email || user?.email || '',
                    birthDate,
                    currentPassword: '',
                    newPassword: '',
                    confirmPassword: '',
                });
            } catch (error: any) {
                const message = error?.message || dict.loadError;
                showToast(message, 'error');
            } finally {
                if (isMounted) {
                    setIsHydrating(false);
                }
            }
        };

        void hydrateProfileForm();
        return () => {
            isMounted = false;
        };
    }, [reset, showToast, user?.name, user?.email, dict.authRequired, dict.loadError, dict.timeoutError]);

    const onSubmit = async (data: ProfileFormValues) => {
        setIsPending(true);

        try {
            if (!user?.id) {
                throw new Error(dict.authRequired);
            }

            const fullName = `${data.name.trim()} ${data.surname.trim()}`.trim();
            const normalizedBirthDate = toDateInputValue(data.birthDate);

            const { data: updatedProfile, error: profileError } = await withTimeout(
                supabase
                    .from('profiles')
                    .update({
                        full_name: fullName,
                        birth_date: normalizedBirthDate || null,
                    })
                    .eq('id', user.id)
                    .select('id')
                    .single(),
                15000,
                dict.timeoutError
            );

            if (profileError) {
                throw profileError;
            }

            if (!updatedProfile?.id) {
                throw new Error(dict.profileMissing);
            }

            const metadataResult = await withTimeout(
                supabase.auth.updateUser({
                    data: {
                        name: fullName,
                        full_name: fullName,
                        birth_date: normalizedBirthDate || null,
                    },
                }),
                15000,
                dict.timeoutError
            );

            if (metadataResult.error) {
                throw metadataResult.error;
            }

            if (showPasswordSection && data.newPassword) {
                const reauthResult = await withTimeout(
                    supabase.auth.signInWithPassword({
                        email: data.email,
                        password: data.currentPassword || '',
                    }),
                    15000,
                    dict.timeoutError
                );

                if (reauthResult.error) {
                    throw new Error(dict.currentPasswordError);
                }

                const passwordResult = await withTimeout(
                    supabase.auth.updateUser({ password: data.newPassword }),
                    15000,
                    dict.timeoutError
                );

                if (passwordResult.error) {
                    throw passwordResult.error;
                }

                setShowPasswordSection(false);
                showToast(dict.passwordUpdated, 'success');
            }

            reset({
                name: data.name.trim(),
                surname: data.surname.trim(),
                email: data.email,
                birthDate: normalizedBirthDate,
                currentPassword: '',
                newPassword: '',
                confirmPassword: '',
            });

            toast.success('Profil güncellendi');
            setIsPending(false);
            router.refresh();
            return;
        } catch (error: any) {
            console.error('Profile update failed:', error);
            toast.error(error?.message || dict.unknownError);
        } finally {
            setIsPending(false);
        }
    };

    if (isHydrating) {
        return (
            <div className="space-y-5 bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 flex items-center justify-center gap-2 text-gray-500 dark:text-gray-300">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>{dict.loadingProfile}</span>
            </div>
        );
    }

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

                {/* Email */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{dict.email}</label>
                    <input
                        {...register('email')}
                        type="email"
                        disabled
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
                                type={showCurrentPassword ? 'text' : 'password'}
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
                                type={showNewPassword ? 'text' : 'password'}
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
                                type={showConfirmPassword ? 'text' : 'password'}
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
                    disabled={isSubmitting || isPending}
                    className="flex items-center gap-2 px-6 py-3 bg-primary-500 text-white font-semibold rounded-xl hover:bg-primary-600 hover:-translate-y-0.5 active:translate-y-0 active:scale-95 transition-all disabled:opacity-70 disabled:cursor-not-allowed shadow-md shadow-primary-500/20"
                >
                    {(isSubmitting || isPending) ? (
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
