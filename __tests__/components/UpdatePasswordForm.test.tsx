/**
 * @jest-environment jsdom
 */

import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

import { UpdatePasswordForm } from '@/components/features/auth/UpdatePasswordForm';

const createProps = (language: 'tr' | 'en' | 'ru') => ({
    authForm: {
        email: '',
        password: '',
        confirmPassword: '',
        name: '',
        surname: '',
        birthDate: '',
    },
    setAuthForm: jest.fn(),
    updatePassword: jest.fn(),
    validatePassword: jest.fn().mockReturnValue({ valid: true, message: '' }),
    showPassword: false,
    setShowPassword: jest.fn(),
    authError: '',
    setAuthError: jest.fn(),
    authLoading: false,
    showToast: jest.fn(),
    logout: jest.fn(),
    onSuccess: jest.fn(),
    t: (key: string) => key,
    language,
});

describe('UpdatePasswordForm', () => {
    it('renders English copy from the language prop', () => {
        render(<UpdatePasswordForm {...createProps('en')} />);

        expect(screen.getByText('Set New Password')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Update Password' })).toBeInTheDocument();
    });

    it('renders Turkish copy from the language prop', () => {
        render(<UpdatePasswordForm {...createProps('tr')} />);

        expect(screen.getByText('Yeni Şifre Belirle')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Şifreyi Güncelle' })).toBeInTheDocument();
    });

    it('shows an error and does not call success handlers when updatePassword fails', async () => {
        const updatePassword = jest.fn().mockResolvedValue({
            success: false,
            error: 'Session expired. Please try again.',
        });
        const logout = jest.fn();
        const onSuccess = jest.fn();
        const showToast = jest.fn();

        render(<UpdatePasswordForm
            {...createProps('en')}
            authForm={{
                email: '',
                password: 'StrongPass1!',
                confirmPassword: '',
                name: '',
                surname: '',
                birthDate: '',
            }}
            updatePassword={updatePassword}
            logout={logout}
            onSuccess={onSuccess}
            showToast={showToast}
        />);

        fireEvent.click(screen.getByRole('button', { name: 'Update Password' }));

        await waitFor(() => {
            expect(updatePassword).toHaveBeenCalledWith('StrongPass1!');
            expect(onSuccess).not.toHaveBeenCalled();
            expect(logout).not.toHaveBeenCalled();
            expect(showToast).toHaveBeenCalledWith('Session expired. Please try again.', 'error');
        });
    });
});
