import type { AuthFormState } from '@/components/features/auth/types';
import type { AppRouterInstance } from 'next/dist/shared/lib/app-router-context.shared-runtime';

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

export const navigateAfterLogin = (
    redirectTarget: string,
    router: Pick<AppRouterInstance, 'push' | 'refresh'>
): void => {
    if (typeof window !== 'undefined') {
        window.location.assign(redirectTarget);
        return;
    }

    router.refresh();
    router.push(redirectTarget);
};

export const submitLoginNavigation = (
    email: string,
    password: string,
    redirectTarget: string
): void => {
    const form = document.createElement('form');
    form.method = 'POST';
    form.action = '/api/auth/login/browser';
    form.style.display = 'none';

    const appendHiddenInput = (name: string, value: string) => {
        const input = document.createElement('input');
        input.type = 'hidden';
        input.name = name;
        input.value = value;
        form.appendChild(input);
    };

    appendHiddenInput('email', email);
    appendHiddenInput('password', password);
    appendHiddenInput('redirectTo', redirectTarget);

    const submitButton = document.createElement('button');
    submitButton.type = 'submit';
    submitButton.hidden = true;
    form.appendChild(submitButton);

    document.body.appendChild(form);

    if (typeof form.requestSubmit === 'function') {
        form.requestSubmit();
        return;
    }

    submitButton.click();
};
