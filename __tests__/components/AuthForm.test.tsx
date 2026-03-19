/**
 * @jest-environment jsdom
 */

import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

import { AuthForm } from '@/components/features/auth/AuthForm';

const createBaseProps = (language: 'tr' | 'en' | 'ru') => ({
    authMode: 'register' as const,
    setAuthMode: jest.fn(),
    authForm: {
        email: '',
        password: '',
        confirmPassword: '',
        name: '',
        surname: '',
        birthDate: '',
    },
    setAuthForm: jest.fn(),
    authLoading: false,
    handleAuth: jest.fn(),
    authError: '',
    setAuthError: jest.fn(),
    showPassword: false,
    setShowPassword: jest.fn(),
    showConfirmPassword: false,
    setShowConfirmPassword: jest.fn(),
    resetPassword: jest.fn(),
    t: (key: string) => key,
    language,
    showToast: jest.fn(),
});

describe('AuthForm', () => {
    it('renders English labels and confirm-password field in register mode', () => {
        render(<AuthForm {...createBaseProps('en')} />);

        expect(screen.getByLabelText('Email')).toBeInTheDocument();
        expect(screen.getByLabelText('Confirm Password')).toBeInTheDocument();
        expect(screen.getByTestId('auth-submit')).toHaveTextContent('Sign Up');
    });

    it('renders Turkish auth copy when language is tr', () => {
        render(<AuthForm {...createBaseProps('tr')} />);

        expect(screen.getByLabelText('E-posta')).toBeInTheDocument();
        expect(screen.getByLabelText('Şifreyi Onayla')).toBeInTheDocument();
        expect(screen.getByTestId('auth-submit')).toHaveTextContent('Kayıt Ol');
    });

    it('updates confirm-password state separately from password', () => {
        const props = createBaseProps('en');
        render(<AuthForm {...props} />);

        fireEvent.change(screen.getByTestId('auth-confirm-password'), {
            target: { value: 'Secret123!' },
        });

        expect(props.setAuthForm).toHaveBeenCalledWith(expect.objectContaining({
            confirmPassword: 'Secret123!',
        }));
    });
});
