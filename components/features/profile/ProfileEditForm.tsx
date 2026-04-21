'use client';

import React, { startTransition, useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { createProfileSchema, ProfileFormValues } from '@/lib/validations/profile';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useRouter } from 'next/navigation';
import { toSafeUserError } from '@/lib/errors';
import { getTranslationString } from '@/lib/i18n';
import { logger } from '@/lib/logger';
import { hasPersistedBirthDate } from '@/lib/profile-birth-date';

interface ProfileEditFormProps {
    language: 'tr' | 'en' | 'ru';
    initialData?: ProfileFormInitialData | null;
    onProfileSaved?: () => Promise<void> | void;
}

export interface ProfileFormInitialData {
    userId: string;
    name: string;
    surname: string;
    email: string | null;
    birthDate: string;
}

interface ProfileFormDefaults extends ProfileFormValues {
    email: string | null;
}

interface ProfileUpdateResponse {
    status?: 'ok' | 'partial_metadata_sync';
    message?: string;
}

const buildProfileFormDefaults = (
    initialData?: ProfileFormInitialData | null
): ProfileFormDefaults => ({
    name: initialData?.name || '',
    surname: initialData?.surname || '',
    email: initialData?.email ?? null,
    birthDate: initialData?.birthDate || '',
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
});

const hasCompleteProfileInitialData = (
    initialData?: ProfileFormInitialData | null
): initialData is ProfileFormInitialData => (
    Boolean(initialData?.name.trim())
    && Boolean(initialData?.surname.trim())
    && Boolean(initialData?.birthDate.trim())
    && initialData?.email !== null
);

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
export const PROFILE_PASSWORD_HARD_TIMEOUT_MS = 24_000;

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

export const ProfileEditForm: React.FC<ProfileEditFormProps> = ({ language, initialData, onProfileSaved }) => {
    const { user: authenticatedUser } = useAuth();
    const { showToast, showToastAfterRefresh } = useToast();
    const router = useRouter();

    const [showPasswordSection, setShowPasswordSection] = useState(false);
    const [pendingAction, setPendingAction] = useState<'profile' | 'password' | null>(null);
    const [canChangePassword, setCanChangePassword] = useState(false);

    // UI Alerts
    const [formSuccess, setFormSuccess] = useState<string | null>(null);
    const [formWarning, setFormWarning] = useState<string | null>(null);
    const [formError, setFormError] = useState<string | null>(null);

    const [showCurrentPassword, setShowCurrentPassword] = useState(false);
    const [showNewPassword, setShowNewPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const fallbackInitialName = initialData?.name ?? '';
    const fallbackInitialSurname = initialData?.surname ?? '';
    const fallbackInitialBirthDate = initialData?.birthDate ?? '';
    const fallbackInitialEmail = initialData?.email ?? null;
    const shouldTrustInitialData = hasCompleteProfileInitialData(initialData);
    const defaultFormValues = React.useMemo(
        () => buildProfileFormDefaults(shouldTrustInitialData ? initialData : null),
        [initialData, shouldTrustInitialData]
    );
    const authenticatedUserId = authenticatedUser?.id ?? null;
    const authenticatedUserName = authenticatedUser?.name?.trim() ?? '';
    const authenticatedUserEmail = authenticatedUser?.email ?? null;
    const authenticatedUserProviderKey = authenticatedUser?.providers.join(',') ?? '';

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
        pwdSaveBtn: copy('profileForm.updatePassword', 'Update Password'),
        unknownError: copy('profileForm.unknownError', 'Something went wrong.'),
        profileUpdated: copy('profileForm.profileUpdated', 'Successfully saved'),
        profilePartiallyUpdated: copy('profileForm.profilePartiallyUpdated', 'Profile details were saved, but the secondary auth sync did not complete.'),
        passwordUpdated: copy('profileForm.passwordUpdated', 'Password updated successfully!'),
        currentPasswordError: copy('profileForm.currentPasswordError', 'Current password incorrect'),
        authRequired: copy('profileForm.authRequired', 'Session not authenticated.'),
        profileLoadError: copy('profileForm.profileLoadError', 'Unable to load profile data.'),
        emailUnavailable: copy('profileForm.emailUnavailable', 'This sign-in method does not provide an email address.'),
        passwordManagedByProvider: copy('profileForm.passwordManagedByProvider', 'This account does not use a Supabase email-password credential. Change the password with the linked identity provider.'),
        requestTimeout: copy('profileForm.requestTimeout', 'Profile update timed out. Please try again.'),
        passwordRequestTimeout: copy('profileForm.passwordRequestTimeout', 'Password update timed out. Please try again.'),
        passwordRequestSlow: copy('profileForm.passwordRequestSlow', 'Password update is taking longer than expected. Please wait.'),
    };

    const {
        control,
        register,
        reset,
        trigger,
        getValues,
        setValue,
        formState: { errors },
    } = useForm<ProfileFormValues>({
        resolver: zodResolver(createProfileSchema(language)),
        defaultValues: defaultFormValues,
    });

    useEffect(() => {
        let isMounted = true;

        const resetWithInitialData = () => {
            if (!isMounted) {
                return;
            }

            reset(buildProfileFormDefaults(initialData));
        };

        const loadProfileData = async () => {
            if (shouldTrustInitialData) {
                resetWithInitialData();
                if (isMounted) {
                    setCanChangePassword(Boolean(
                        authenticatedUserEmail
                        && authenticatedUserProviderKey.split(',').includes('email')
                    ));
                }
                return;
            }

            try {
                if (!authenticatedUserId) {
                    if (isMounted) {
                        setCanChangePassword(false);
                        setFormError(dict.authRequired);
                    }
                    showToast(dict.authRequired, 'warning');
                    return;
                }

                const recoveredFullName = (
                    [fallbackInitialName, fallbackInitialSurname].filter(Boolean).join(' ').trim()
                    || authenticatedUserName
                );
                const nameParts = recoveredFullName ? recoveredFullName.split(' ') : [''];
                const firstName = fallbackInitialName || nameParts[0] || '';
                const lastName = fallbackInitialSurname || (nameParts.length > 1 ? nameParts.slice(1).join(' ') : '');
                const recoveredBirthDate = fallbackInitialBirthDate;
                const recoveredEmail = fallbackInitialEmail ?? authenticatedUserEmail ?? null;

                if (isMounted) {
                    setCanChangePassword(Boolean(
                        authenticatedUserEmail
                        && authenticatedUserProviderKey.split(',').includes('email')
                    ));
                    reset({
                        name: firstName,
                        surname: lastName,
                        email: recoveredEmail,
                        birthDate: recoveredBirthDate,
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
                if (isMounted && initialData) {
                    reset(buildProfileFormDefaults(initialData));
                }
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
    }, [
        dict.authRequired,
        dict.profileLoadError,
        fallbackInitialBirthDate,
        fallbackInitialEmail,
        fallbackInitialName,
        fallbackInitialSurname,
        authenticatedUserEmail,
        authenticatedUserId,
        authenticatedUserName,
        authenticatedUserProviderKey,
        initialData,
        reset,
        shouldTrustInitialData,
        showToast,
    ]);

    useEffect(() => {
        if (!canChangePassword) {
            setShowPasswordSection(false);
        }
    }, [canChangePassword]);

    const resetPasswordFields = () => {
        setValue('currentPassword', '');
        setValue('newPassword', '');
        setValue('confirmPassword', '');
    };

    const runTimedAction = async (
        action: 'profile' | 'password',
        operation: (
            withTimeout: <T,>(callback: () => Promise<T>) => Promise<T>,
            timeoutSignal: AbortSignal
        ) => Promise<void>,
        options?: {
            slowMessage?: string;
            slowAfterMs?: number;
            hardTimeoutMs?: number;
        }
    ) => {
        const slowMessage = options?.slowMessage ?? null;
        const slowAfterMs = options?.slowAfterMs ?? null;
        const hardTimeoutMs = options?.hardTimeoutMs ?? PROFILE_SUBMIT_TIMEOUT_MS;
        const timeoutMessage = action === 'password'
            ? dict.passwordRequestTimeout
            : dict.requestTimeout;
        setPendingAction(action);
        setFormSuccess(null);
        setFormWarning(null);
        setFormError(null);
        const timeoutController = new AbortController();
        let hasShownSlowWarning = false;
        const slowWarningTimeoutId = slowMessage && slowAfterMs !== null
            ? globalThis.setTimeout(() => {
                hasShownSlowWarning = true;
                setFormWarning(slowMessage);
            }, slowAfterMs)
            : null;
        const hardTimeoutId = globalThis.setTimeout(() => {
            timeoutController.abort();
        }, hardTimeoutMs);


        try {
            const withTimeout = <T,>(callback: () => Promise<T>) => (
                runWithAbortSignal(
                    timeoutController.signal,
                    callback,
                    timeoutMessage
                )
            );
            await operation(withTimeout, timeoutController.signal);

        } catch (error: unknown) {
            logger.error('PROFILE_FORM_SUBMIT_FAILED', {
                route: 'ProfileEditForm',
                error: error instanceof Error ? error : undefined,
            });
            const timedOut = error instanceof Error && error.name === 'AbortError';
            const safeError = toSafeUserError(error);
            const detailedMessage = timedOut
                ? timeoutMessage
                : safeError.message || dict.unknownError;
            setFormWarning(null);
            setFormError(detailedMessage);
            showToast(detailedMessage, 'error');
        } finally {
            if (slowWarningTimeoutId !== null) {
                globalThis.clearTimeout(slowWarningTimeoutId);
            }
            globalThis.clearTimeout(hardTimeoutId);
            setPendingAction(null);
        }
    };

    const handleProfileSubmit = async () => {
        const isValid = await trigger(['name', 'surname', 'birthDate', 'email']);
        if (!isValid) {
            return;
        }

        const formValues = getValues();

        await runTimedAction('profile', async (_withTimeout, timeoutSignal) => {
            const fullName = `${formValues.name.trim()} ${formValues.surname.trim()}`.trim();
            const normalizedBirthDate = toDateInputValue(formValues.birthDate);

            const response = await fetch('/api/profile', {
                method: 'POST',
                credentials: 'same-origin',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    fullName,
                    birthDate: normalizedBirthDate || null,
                }),
                signal: timeoutSignal,
            });

            let responseBody: ProfileUpdateResponse | null = null;
            try {
                responseBody = await response.json() as ProfileUpdateResponse;
            } catch {
                responseBody = null;
            }

            if (response.status === 401) {
                throw new Error(dict.authRequired);
            }

            if (!response.ok) {
                throw new Error(responseBody?.message || dict.unknownError);
            }

            if (responseBody?.status === 'partial_metadata_sync') {
                setFormWarning(dict.profilePartiallyUpdated);
                showToastAfterRefresh(dict.profilePartiallyUpdated, 'warning');
            } else {
                setFormSuccess(dict.profileUpdated);
                showToastAfterRefresh(dict.profileUpdated, 'success');
            }

            await onProfileSaved?.();

            startTransition(() => {
                router.refresh();
            });
        });
    };

    const handlePasswordSubmit = async () => {
        const isValid = await trigger(['currentPassword', 'newPassword', 'confirmPassword', 'email']);
        if (!isValid) {
            return;
        }

        const formValues = getValues();

        await runTimedAction('password', async (withTimeout, timeoutSignal) => {
            if (!authenticatedUserId) {
                throw new Error(dict.authRequired);
            }

            if (!authenticatedUserEmail || !authenticatedUserProviderKey.split(',').includes('email')) {
                throw new Error(dict.passwordManagedByProvider);
            }

            const response = await withTimeout(() => fetch('/api/auth/update-password', {
                method: 'POST',
                credentials: 'same-origin',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    currentPassword: formValues.currentPassword || '',
                    password: formValues.newPassword,
                }),
                signal: timeoutSignal,
            }));

            let responseBody: { message?: string } | null = null;
            try {
                responseBody = await response.json() as { message?: string };
            } catch {
                responseBody = null;
            }

            if (!response.ok) {
                if (responseBody?.message === 'Current password incorrect') {
                    throw new Error(dict.currentPasswordError);
                }

                throw new Error(responseBody?.message || dict.unknownError);
            }

            resetPasswordFields();
            setShowPasswordSection(false);
            setFormWarning(null);
            setFormSuccess(dict.passwordUpdated);
            showToast(dict.passwordUpdated, 'success');
        }, {
            slowMessage: dict.passwordRequestSlow,
            slowAfterMs: PROFILE_SUBMIT_TIMEOUT_MS,
            hardTimeoutMs: PROFILE_PASSWORD_HARD_TIMEOUT_MS,
        });
    };

    return (
        <form onSubmit={(event) => event.preventDefault()} className="space-y-5 bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
                {copy('profileForm.personalInfo', 'Personal Information')}
            </h2>

            {/* Inline Alerts */}
            {formSuccess && (
                <div
                    data-testid="profile-form-success"
                    className="mb-4 p-3 text-sm text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800 rounded-lg"
                >
                    {formSuccess}
                </div>
            )}

            {formWarning && (
                <div
                    data-testid="profile-form-warning"
                    className="mb-4 p-3 text-sm text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800 rounded-lg"
                >
                    {formWarning}
                </div>
            )}

            {formError && (
                <div
                    data-testid="profile-form-error"
                    className="mb-4 p-3 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 rounded-lg"
                >
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
                                aria-label={dict.pwdCurrent}
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
                                aria-label={dict.pwdNew}
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
                                aria-label={dict.pwdConfirm}
                                className={`w-full pl-4 pr-10 py-2 border rounded-xl dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-primary-500 outline-none transition-all ${errors.confirmPassword ? 'border-red-500 dark:border-red-500' : 'border-gray-200 dark:border-gray-600'}`}
                            />
                            <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600 transition-colors">
                                {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                            </button>
                        </div>
                        {errors.confirmPassword && <p className="text-sm text-red-500 mt-1">{errors.confirmPassword.message}</p>}
                    </div>

                    <div className="flex justify-end pt-2">
                        <button
                            type="button"
                            onClick={() => {
                                void handlePasswordSubmit();
                            }}
                            disabled={pendingAction !== null}
                            data-testid="profile-password-save"
                            className="flex items-center gap-2 px-5 py-2.5 bg-primary-500 text-white font-semibold rounded-xl hover:bg-primary-600 transition-all disabled:opacity-70 disabled:cursor-not-allowed shadow-md shadow-primary-500/20"
                        >
                            {pendingAction === 'password' ? (
                                <>
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                    {dict.saving}
                                </>
                            ) : (
                                dict.pwdSaveBtn
                            )}
                        </button>
                    </div>
                </div>
            )}

            <div className="pt-2 flex justify-end">
                <button
                    type="button"
                    onClick={() => {
                        void handleProfileSubmit();
                    }}
                    disabled={pendingAction !== null}
                    data-testid="profile-save"
                    className="flex items-center gap-2 px-6 py-3 bg-primary-500 text-white font-semibold rounded-xl hover:bg-primary-600 hover:-translate-y-0.5 active:translate-y-0 active:scale-95 transition-all disabled:opacity-70 disabled:cursor-not-allowed shadow-md shadow-primary-500/20"
                >
                    {pendingAction === 'profile' ? (
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
