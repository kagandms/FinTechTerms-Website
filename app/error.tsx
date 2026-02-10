'use client';

import { useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { AlertTriangle, RefreshCw } from 'lucide-react';

const errorMessages = {
    tr: {
        title: 'Bir hata oluştu',
        description: 'Beklenmeyen bir sorun meydana geldi. Lütfen tekrar deneyin.',
        retry: 'Tekrar Dene',
        home: 'Ana Sayfa',
    },
    en: {
        title: 'Something went wrong',
        description: 'An unexpected error occurred. Please try again.',
        retry: 'Try Again',
        home: 'Home',
    },
    ru: {
        title: 'Произошла ошибка',
        description: 'Произошла непредвиденная ошибка. Пожалуйста, попробуйте снова.',
        retry: 'Повторить',
        home: 'Главная',
    },
};

export default function GlobalError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    const { language } = useLanguage();
    const t = errorMessages[language] || errorMessages.en;

    useEffect(() => {
        // Log error to monitoring service in production
        console.error('Application error:', error);
    }, [error]);

    return (
        <div className="min-h-[60vh] flex items-center justify-center px-4">
            <div className="text-center max-w-md">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/30 mb-6">
                    <AlertTriangle className="w-8 h-8 text-red-500" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">
                    {t.title}
                </h2>
                <p className="text-gray-500 dark:text-gray-400 mb-8 leading-relaxed">
                    {t.description}
                </p>
                <div className="flex gap-3 justify-center">
                    <button
                        onClick={reset}
                        className="inline-flex items-center gap-2 px-6 py-3 bg-primary-500 text-white font-semibold rounded-xl hover:bg-primary-600 transition-colors shadow-md"
                    >
                        <RefreshCw className="w-4 h-4" />
                        {t.retry}
                    </button>
                    <a
                        href="/"
                        className="inline-flex items-center gap-2 px-6 py-3 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-medium rounded-xl hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                    >
                        {t.home}
                    </a>
                </div>
            </div>
        </div>
    );
}
