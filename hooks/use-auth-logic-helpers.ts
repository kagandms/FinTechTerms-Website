import type { AuthFormState } from '@/components/features/auth/types';

export const createEmptyAuthForm = (): AuthFormState => ({
    email: '',
    password: '',
    confirmPassword: '',
    name: '',
    surname: '',
    birthDate: '',
});

export const getSafeRedirectPath = (value: string | null): string | null => {
    if (!value) {
        return null;
    }

    if (!value.startsWith('/') || value.startsWith('//')) {
        return null;
    }

    return value;
};
