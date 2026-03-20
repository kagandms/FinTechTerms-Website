'use client';

import React from 'react';
import type { Language } from '@/types';
import { logger } from '@/lib/logger';

const boundaryCopy: Record<Language, { title: string; description: string; retry: string }> = {
    tr: {
        title: 'Profil yüklenemedi',
        description: 'Profil veya ayarlar bölümü beklenmeyen bir hata verdi. Tekrar deneyin.',
        retry: 'Tekrar Dene',
    },
    en: {
        title: 'Profile failed to load',
        description: 'The profile or settings section hit an unexpected error. Try again.',
        retry: 'Try Again',
    },
    ru: {
        title: 'Профиль не загрузился',
        description: 'Раздел профиля или настроек завершился с неожиданной ошибкой. Попробуйте снова.',
        retry: 'Повторить',
    },
};

interface ProfileErrorBoundaryProps {
    children: React.ReactNode;
    language: Language;
    onError: (error: Error) => void;
}

interface ProfileErrorBoundaryState {
    hasError: boolean;
}

export default class ProfileErrorBoundary extends React.Component<
    ProfileErrorBoundaryProps,
    ProfileErrorBoundaryState
> {
    state: ProfileErrorBoundaryState = {
        hasError: false,
    };

    static getDerivedStateFromError(): ProfileErrorBoundaryState {
        return { hasError: true };
    }

    componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
        logger.error('PROFILE_ERROR_BOUNDARY_CAUGHT', {
            route: 'ProfileErrorBoundary',
            error,
            componentStack: errorInfo.componentStack,
        });
        this.props.onError(error);
    }

    private handleRetry = () => {
        this.setState({ hasError: false });
    };

    render() {
        if (this.state.hasError) {
            const copy = boundaryCopy[this.props.language];

            return (
                <div className="min-h-[50vh] flex items-center justify-center px-4">
                    <div className="max-w-md rounded-3xl border border-red-100 bg-white p-6 text-center shadow-sm dark:border-red-900/30 dark:bg-gray-900">
                        <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                            {copy.title}
                        </h2>
                        <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">
                            {copy.description}
                        </p>
                        <button
                            type="button"
                            onClick={this.handleRetry}
                            className="mt-5 inline-flex items-center justify-center rounded-xl bg-primary-500 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-primary-600"
                        >
                            {copy.retry}
                        </button>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}
