/**
 * @jest-environment jsdom
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
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
});
