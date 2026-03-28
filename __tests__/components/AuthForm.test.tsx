/**
 * @jest-environment jsdom
 */

import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

import { AuthForm } from '@/components/features/auth/AuthForm';

const authTranslations: Record<string, Record<string, string>> = {
    en: {
        'auth.login': 'Sign In',
        'auth.register': 'Sign Up',
        'auth.resetPassword': 'Reset Password',
        'auth.email': 'Email',
        'auth.password': 'Password',
        'auth.confirmPassword': 'Confirm Password',
        'auth.firstName': 'First Name',
        'auth.lastName': 'Last Name',
        'profileForm.birthDate': 'Date of Birth',
        'auth.loginLoading': 'Signing in...',
        'auth.registerLoading': 'Creating account...',
        'auth.resetLoading': 'Sending...',
        'auth.sendResetLink': 'Send Reset Link',
        'auth.forgotPassword': 'Forgot Password?',
        'auth.noAccount': "Don't have an account?",
        'auth.alreadyHaveAccount': 'Already have an account?',
        'auth.checkEmail': '✅ Check your inbox and spam folder',
        'auth.continueWithGoogle': 'Continue with Google',
        'auth.showPassword': 'Show password',
        'auth.hidePassword': 'Hide password',
    },
    tr: {
        'auth.login': 'Giriş Yap',
        'auth.register': 'Kayıt Ol',
        'auth.resetPassword': 'Şifreyi Sıfırla',
        'auth.email': 'E-posta',
        'auth.password': 'Şifre',
        'auth.confirmPassword': 'Şifreyi Onayla',
        'auth.firstName': 'Ad',
        'auth.lastName': 'Soyad',
        'profileForm.birthDate': 'Doğum Tarihi',
        'auth.loginLoading': 'Giriş yapılıyor...',
        'auth.registerLoading': 'Hesap oluşturuluyor...',
        'auth.resetLoading': 'Gönderiliyor...',
        'auth.sendResetLink': 'Sıfırlama Linki Gönder',
        'auth.forgotPassword': 'Şifremi Unuttum?',
        'auth.noAccount': 'Hesabınız yok mu?',
        'auth.alreadyHaveAccount': 'Zaten hesabınız var mı?',
        'auth.checkEmail': '✅ E-postanı ve spam klasörünü kontrol et',
        'auth.continueWithGoogle': 'Google ile devam et',
        'auth.showPassword': 'Şifreyi göster',
        'auth.hidePassword': 'Şifreyi gizle',
    },
    ru: {
        'auth.login': 'Войти',
        'auth.register': 'Регистрация',
        'auth.resetPassword': 'Сброс пароля',
        'auth.email': 'Эл. почта',
        'auth.password': 'Пароль',
        'auth.confirmPassword': 'Подтвердите пароль',
        'auth.firstName': 'Имя',
        'auth.lastName': 'Фамилия',
        'profileForm.birthDate': 'Дата рождения',
        'auth.loginLoading': 'Выполняется вход...',
        'auth.registerLoading': 'Создаём профиль...',
        'auth.resetLoading': 'Отправка...',
        'auth.sendResetLink': 'Отправить ссылку',
        'auth.forgotPassword': 'Забыли пароль?',
        'auth.noAccount': 'Нет аккаунта?',
        'auth.alreadyHaveAccount': 'Уже есть аккаунт?',
        'auth.checkEmail': '✅ Проверьте почту и папку «Спам»',
        'auth.continueWithGoogle': 'Продолжить с Google',
        'auth.showPassword': 'Показать пароль',
        'auth.hidePassword': 'Скрыть пароль',
    },
};

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
    handleGoogleAuth: jest.fn(),
    authError: '',
    setAuthError: jest.fn(),
    showPassword: false,
    setShowPassword: jest.fn(),
    showConfirmPassword: false,
    setShowConfirmPassword: jest.fn(),
    resetPassword: jest.fn(),
    t: (key: string) => authTranslations[language]?.[key] ?? key,
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

    it('exposes the Google continuation action outside forgot-password mode', () => {
        const props = createBaseProps('en');
        render(<AuthForm {...props} />);

        fireEvent.click(screen.getByTestId('auth-google-submit'));

        expect(props.handleGoogleAuth).toHaveBeenCalledTimes(1);
    });
});
