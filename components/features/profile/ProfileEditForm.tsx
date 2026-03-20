'use client';

import React, { startTransition, useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { createProfileSchema, ProfileFormValues } from '@/lib/validations/profile';
import { getSupabaseClient } from '@/lib/supabase';
import {
    getSupabaseUserMetadataBirthDate,
    getSupabaseUserMetadataName,
    getSupabaseUserNameSeed,
    supportsPasswordSignIn,
} from '@/lib/auth/user';
import { useToast } from '@/contexts/ToastContext';
import { useRouter } from 'next/navigation';
import { toSafeUserError } from '@/lib/errors';
import { getTranslationString } from '@/lib/i18n';
import { logger } from '@/lib/logger';

interface ProfileEditFormProps {
    language: 'tr' | 'en' | 'ru';
    initialData?: ProfileFormInitialData | null;
}

export interface ProfileFormInitialData {
    userId: string;
    name: string;
    surname: string;
    email: string | null;
    birthDate: string;
}

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

export const PROFILE_SUBMIT_TIMEOUT_MS = 12_000;

export const createAbortError = (message: string): Error => {
    const error = new Error(message);
    error.name = 'AbortError';
    return error;
};

export const runWithAbortSignal = async <T,>(
    signal: AbortSignal,
    operation: () => Promise<T>,
    timeoutMessage: string
): Promise<T> => {
    if (signal.aborted) {
        throw createAbortError(timeoutMessage);
    }

    return await new Promise<T>((resolve, reject) => {
        const handleAbort = () => {
            reject(createAbortError(timeoutMessage));
        };

        signal.addEventListener('abort', handleAbort, { once: true });

        void operation().then(
            (value) => {
                signal.removeEventListener('abort', handleAbort);

                if (signal.aborted) {
                    reject(createAbortError(timeoutMessage));
                    return;
                }

                resolve(value);
            },
            (error) => {
                signal.removeEventListener('abort', handleAbort);
                reject(error);
            }
        );
    });
};

export const ProfileEditForm: React.FC<ProfileEditFormProps> = ({ language, initialData }) => {
    const supabase = getSupabaseClient();
    const { showToast, showToastAfterRefresh } = useToast();
    const router = useRouter();

    const [showPasswordSection, setShowPasswordSection] = useState(false);
    const [isPending, setIsPending] = useState(false);
    const [canChangePassword, setCanChangePassword] = useState(false);

    // UI Alerts
    const [formSuccess, setFormSuccess] = useState<string | null>(null);
    const [formWarning, setFormWarning] = useState<string | null>(null);
    const [formError, setFormError] = useState<string | null>(null);

    const [showCurrentPassword, setShowCurrentPassword] = useState(false);
    const [showNewPassword, setShowNewPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);

    const copy = (key: string, fallback: string): string => (
        getTranslationString(language, key) ?? fallback
    );

    const dict = {
        name: copy('profileForm.name', 'First Name'),
        surname: copy('profileForm.surname', 'Last Name'),
        email: copy('profileForm.email', 'Email'),
        birthDate: copy('profileForm.birthDate', 'Date of Birth'),
        saveBtn: copy('profileForm.save', 'Save Changes'),
        saving: copy('profileForm.saving', 'Saving...'),
        pwdTitle: copy('profileForm.changePassword', 'Change Password'),
        pwdCurrent: copy('profileForm.currentPassword', 'Current Password'),
        pwdNew: copy('profileForm.newPassword', 'New Password'),
        pwdConfirm: copy('profileForm.confirmNewPassword', 'Confirm New Password'),
        unknownError: copy('profileForm.unknownError', 'Something went wrong.'),
        profileUpdated: copy('profileForm.profileUpdated', 'Successfully saved'),
        profilePartiallyUpdated: copy('profileForm.profilePartiallyUpdated', 'Profile details were saved, but the secondary profile sync did not complete.'),
        passwordUpdated: copy('profileForm.passwordUpdated', 'Password updated successfully!'),
        currentPasswordError: copy('profileForm.currentPasswordError', 'Current password incorrect'),
        authRequired: copy('profileForm.authRequired', 'Session not authenticated.'),
        profileLoadError: copy('profileForm.profileLoadError', 'Unable to load profile data.'),
        emailUnavailable: copy('profileForm.emailUnavailable', 'This sign-in method does not provide an email address.'),
        passwordManagedByProvider: copy('profileForm.passwordManagedByProvider', 'This account does not use a Supabase email-password credential. Change the password with the linked identity provider.'),
        requestTimeout: copy('profileForm.requestTimeout', 'Profile update timed out. Please try again.'),
    };

    const {
        control,
        register,
        handleSubmit,
        reset,
        formState: { errors, isSubmitting },
    } = useForm<ProfileFormValues>({
        resolver: zodResolver(createProfileSchema(language)),
        values: {
            name: initialData?.name || '',
            surname: initialData?.surname || '',
            email: initialData?.email ?? null,
            birthDate: initialData?.birthDate || '',
            currentPassword: '',
            newPassword: '',
            confirmPassword: '',
        },
    });

    useEffect(() => {
        let isMounted = true;

        const resetWithInitialData = () => {
            if (!initialData || !isMounted) {
                return;
            }

            reset({
                name: initialData.name || '',
                surname: initialData.surname || '',
                email: initialData.email ?? null,
                birthDate: initialData.birthDate || '',
                currentPassword: '',
                newPassword: '',
                confirmPassword: '',
            });
        };

        const loadProfileData = async () => {
            if (initialData) {
                resetWithInitialData();
            }

            try {
                const { data, error } = await supabase.auth.getUser();
                if (error || !data.user) {
                    logger.warn('PROFILE_FORM_SESSION_UNAVAILABLE', {
                        route: 'ProfileEditForm',
                        error: error ?? undefined,
                    });
                    if (initialData) {
                        resetWithInitialData();
                        return;
                    }
                    if (isMounted) {
                        setCanChangePassword(false);
                        setFormError(dict.authRequired);
                    }
                    showToast(dict.authRequired, 'warning');
                    return;
                }

                const supabaseUser = data.user;
                if (isMounted) {
                    setCanChangePassword(supportsPasswordSignIn(supabaseUser));
                }

                if (initialData) {
                    resetWithInitialData();
                    return;
                }

                let fullName = getSupabaseUserMetadataName(supabaseUser);
                let birthDate = toDateInputValue(getSupabaseUserMetadataBirthDate(supabaseUser));

                const { data: profile } = await supabase
                    .from('profiles')
                    .select('full_name, birth_date')
                    .eq('id', supabaseUser.id)
                    .maybeSingle();

                if (!fullName && profile?.full_name) fullName = profile.full_name.trim();
                if (!birthDate && profile?.birth_date) birthDate = toDateInputValue(profile.birth_date);
                if (!fullName) fullName = getSupabaseUserNameSeed(supabaseUser);

                const nameParts = fullName ? fullName.split(' ') : [''];
                const firstName = nameParts[0] || '';
                const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : '';

                if (isMounted) {
                    reset({
                        name: firstName,
                        surname: lastName,
                        email: supabaseUser.email ?? null,
                        birthDate,
                        currentPassword: '',
                        newPassword: '',
                        confirmPassword: '',
                    });
                }
            } catch (err) {
                logger.error('PROFILE_FORM_LOAD_ERROR', {
                    route: 'ProfileEditForm',
                    error: err instanceof Error ? err : undefined,
                });
                if (isMounted) {
                    setCanChangePassword(false);
                    setFormError(dict.profileLoadError);
                }
                showToast(dict.profileLoadError, 'error');
            }
        };

        void loadProfileData();

        return () => {
            isMounted = false;
        };
    }, [dict.authRequired, dict.profileLoadError, initialData, reset, showToast, supabase]);

    useEffect(() => {
        if (!canChangePassword) {
            setShowPasswordSection(false);
        }
    }, [canChangePassword]);

    const onSubmit = async (data: ProfileFormValues) => {
        setIsPending(true);
        setFormSuccess(null);
        setFormWarning(null);
        setFormError(null);
        const timeoutController = new AbortController();
        const timeoutId = globalThis.setTimeout(() => {
            timeoutController.abort();
        }, PROFILE_SUBMIT_TIMEOUT_MS);

        try {
            const withTimeout = <T,>(operation: () => Promise<T>) => runWithAbortSignal(
                timeoutController.signal,
                operation,
                dict.requestTimeout
            );

            const { data: userResultData, error: userError } = await withTimeout(() => supabase.auth.getUser());

            if (userError || !userResultData?.user) {
                throw userError || new Error(dict.authRequired);
            }

            const authUser = userResultData.user;
            const fullName = `${data.name.trim()} ${data.surname.trim()}`.trim();
            const normalizedBirthDate = toDateInputValue(data.birthDate);
            let hasProfileSyncWarning = false;

            if (showPasswordSection && data.newPassword) {
                if (!supportsPasswordSignIn(authUser)) {
                    throw new Error(dict.passwordManagedByProvider);
                }

                const passwordAccountEmail = authUser.email ?? data.email;
                if (!passwordAccountEmail) {
                    throw new Error(dict.emailUnavailable);
                }

                const { error: reauthError } = await withTimeout(() => supabase.auth.signInWithPassword({
                    email: passwordAccountEmail,
                    password: data.currentPassword || '',
                }));

                if (reauthError) throw new Error(dict.currentPasswordError);
            }

            // 1. Update auth metadata first because it is the primary profile source.
            const { error: metadataError } = await withTimeout(() => supabase.auth.updateUser({
                data: { name: fullName, full_name: fullName, birth_date: normalizedBirthDate || null },
            }));

            if (metadataError) throw metadataError;

            // 2. Optional password update after re-auth validation succeeds.
            if (showPasswordSection && data.newPassword) {
                const { error: passwordError } = await withTimeout(() => supabase.auth.updateUser({ password: data.newPassword }));
                if (passwordError) throw passwordError;

                setShowPasswordSection(false);
                showToast(dict.passwordUpdated, 'success');
            }

            // 3. Keep profiles table in sync when allowed, but do not downgrade the canonical write.
            const { error: profileError } = await withTimeout(async () => await supabase
                .from('profiles')
                .update({ full_name: fullName, birth_date: normalizedBirthDate || null })
                .eq('id', authUser.id)
                .abortSignal(timeoutController.signal));

            if (profileError) {
                logger.warn('PROFILE_FORM_PROFILE_TABLE_SYNC_WARNING', {
                    route: 'ProfileEditForm',
                    error: profileError ?? undefined,
                });
                hasProfileSyncWarning = true;
            }

            if (hasProfileSyncWarning) {
                setFormWarning(dict.profilePartiallyUpdated);
                showToastAfterRefresh(dict.profilePartiallyUpdated, 'warning');
            } else {
                setFormSuccess(dict.profileUpdated);
                showToastAfterRefresh(dict.profileUpdated, 'success');
            }

            // Soft reset to update values instantly
            reset({
                ...data,
                currentPassword: '',
                newPassword: '',
                confirmPassword: '',
            });

            startTransition(() => {
                router.refresh();
            });

        } catch (error: unknown) {
            logger.error('PROFILE_FORM_SUBMIT_FAILED', {
                route: 'ProfileEditForm',
                error: error instanceof Error ? error : undefined,
            });
            const timedOut = error instanceof Error && error.name === 'AbortError';
            const safeError = toSafeUserError(error);
            const detailedMessage = timedOut
                ? dict.requestTimeout
                : safeError.message || dict.unknownError;
            setFormWarning(null);
            setFormError(detailedMessage);
            showToast(detailedMessage, 'error');
        } finally {
            globalThis.clearTimeout(timeoutId);
            setIsPending(false);
        }
    };

    return (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5 bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
                {copy('profileForm.personalInfo', 'Personal Information')}
            </h2>

            {/* Inline Alerts */}
            {formSuccess && (
                <div className="mb-4 p-3 text-sm text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800 rounded-lg">
                    {formSuccess}
                </div>
            )}

            {formWarning && (
                <div className="mb-4 p-3 text-sm text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800 rounded-lg">
                    {formWarning}
                </div>
            )}

            {formError && (
                <div className="mb-4 p-3 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 rounded-lg">
                    {formError}
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{dict.name}</label>
                    <input
                        {...register('name')}
                        type="text"
                        data-testid="profile-name"
                        className={`w-full px-4 py-2 border rounded-xl dark:bg-gray-700 dark:text-white dark:border-gray-600 focus:ring-2 focus:ring-primary-500 outline-none transition-all ${errors.name ? 'border-red-500' : 'border-gray-200'}`}
                    />
                    {errors.name && <p className="text-sm text-red-500 mt-1">{errors.name.message}</p>}
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{dict.surname}</label>
                    <input
                        {...register('surname')}
                        type="text"
                        data-testid="profile-surname"
                        className={`w-full px-4 py-2 border rounded-xl dark:bg-gray-700 dark:text-white dark:border-gray-600 focus:ring-2 focus:ring-primary-500 outline-none transition-all ${errors.surname ? 'border-red-500' : 'border-gray-200'}`}
                    />
                    {errors.surname && <p className="text-sm text-red-500 mt-1">{errors.surname.message}</p>}
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{dict.birthDate}</label>
                    <input
                        {...register('birthDate')}
                        type="date"
                        data-testid="profile-birth-date"
                        className={`w-full px-4 py-2 border rounded-xl dark:bg-gray-700 dark:text-white dark:border-gray-600 focus:ring-2 focus:ring-primary-500 outline-none transition-all ${errors.birthDate ? 'border-red-500' : 'border-gray-200'}`}
                    />
                    {errors.birthDate && <p className="text-sm text-red-500 mt-1">{errors.birthDate.message}</p>}
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{dict.email}</label>
                    <Controller
                        name="email"
                        control={control}
                        render={({ field: { value } }) => (
                            <>
                                <input
                                    type="email"
                                    value={value ?? ''}
                                    disabled
                                    readOnly
                                    className="w-full px-4 py-2 border border-gray-200 rounded-xl bg-gray-50 text-gray-500 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700 cursor-not-allowed"
                                />
                                {!value && (
                                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                                        {dict.emailUnavailable}
                                    </p>
                                )}
                            </>
                        )}
                    />
                </div>
            </div>

            <hr className="border-gray-100 dark:border-gray-700 my-6" />

            <div>
                {canChangePassword ? (
                    <button
                        type="button"
                        onClick={() => setShowPasswordSection(!showPasswordSection)}
                        className="text-sm font-semibold text-primary-600 dark:text-primary-400 hover:text-primary-700 hover:underline transition-colors focus:outline-none"
                    >
                        {showPasswordSection ? copy('profileForm.cancelPasswordChange', 'Cancel Password Change') : dict.pwdTitle}
                    </button>
                ) : (
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                        {dict.passwordManagedByProvider}
                    </p>
                )}
            </div>

            {showPasswordSection && (
                <div className="space-y-4 animate-fade-in bg-gray-50 dark:bg-gray-900/50 p-4 rounded-xl border border-gray-100 dark:border-gray-800">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{dict.pwdCurrent}</label>
                        <div className="relative">
                            <input
                                {...register('currentPassword')}
                                type={showCurrentPassword ? 'text' : 'password'}
                                className={`w-full pl-4 pr-10 py-2 border rounded-xl dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-primary-500 outline-none transition-all ${errors.currentPassword ? 'border-red-500 dark:border-red-500' : 'border-gray-200 dark:border-gray-600'}`}
                            />
                            <button type="button" onClick={() => setShowCurrentPassword(!showCurrentPassword)} className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600 transition-colors">
                                {showCurrentPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                            </button>
                        </div>
                        {errors.currentPassword && <p className="text-sm text-red-500 mt-1">{errors.currentPassword.message}</p>}
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{dict.pwdNew}</label>
                        <div className="relative">
                            <input
                                {...register('newPassword')}
                                type={showNewPassword ? 'text' : 'password'}
                                className={`w-full pl-4 pr-10 py-2 border rounded-xl dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-primary-500 outline-none transition-all ${errors.newPassword ? 'border-red-500 dark:border-red-500' : 'border-gray-200 dark:border-gray-600'}`}
                            />
                            <button type="button" onClick={() => setShowNewPassword(!showNewPassword)} className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600 transition-colors">
                                {showNewPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                            </button>
                        </div>
                        {errors.newPassword && <p className="text-sm text-red-500 mt-1">{errors.newPassword.message}</p>}
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{dict.pwdConfirm}</label>
                        <div className="relative">
                            <input
                                {...register('confirmPassword')}
                                type={showConfirmPassword ? 'text' : 'password'}
                                className={`w-full pl-4 pr-10 py-2 border rounded-xl dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-primary-500 outline-none transition-all ${errors.confirmPassword ? 'border-red-500 dark:border-red-500' : 'border-gray-200 dark:border-gray-600'}`}
                            />
                            <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600 transition-colors">
                                {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                            </button>
                        </div>
                        {errors.confirmPassword && <p className="text-sm text-red-500 mt-1">{errors.confirmPassword.message}</p>}
                    </div>
                </div>
            )}

            <div className="pt-2 flex justify-end">
                <button
                    type="submit"
                    disabled={isSubmitting || isPending}
                    data-testid="profile-save"
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
