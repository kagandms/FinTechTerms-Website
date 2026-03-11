'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { RefreshCw } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import DataStateCard from '@/components/DataStateCard';

const messages = {
    tr: {
        title: 'Sayfa yuklenemedi',
        description: 'Bu sayfa acilirken beklenmeyen bir sorun olustu. Lutfen tekrar deneyin.',
        retry: 'Tekrar Dene',
        home: 'Ana Sayfa',
    },
    en: {
        title: 'Page failed to load',
        description: 'An unexpected problem prevented this page from loading. Please try again.',
        retry: 'Try Again',
        home: 'Home',
    },
    ru: {
        title: 'Ошибка загрузки страницы',
        description: 'Во время открытия страницы произошла непредвиденная ошибка. Попробуйте еще раз.',
        retry: 'Повторить',
        home: 'Главная',
    },
} as const;

interface RouteErrorFallbackProps {
    error: Error & { digest?: string };
    reset: () => void;
}

export default function RouteErrorFallback({ error, reset }: RouteErrorFallbackProps) {
    const { language } = useLanguage();
    const t = messages[language] ?? messages.en;

    useEffect(() => {
        console.error('Route error:', error);
    }, [error]);

    return (
        <div className="page-content px-4 py-8">
            <DataStateCard
                tone="error"
                title={t.title}
                description={t.description}
                action={(
                    <>
                        <button
                            onClick={reset}
                            className="inline-flex items-center gap-2 rounded-xl bg-primary-500 px-5 py-3 font-semibold text-white transition-colors hover:bg-primary-600"
                        >
                            <RefreshCw className="w-4 h-4" />
                            {t.retry}
                        </button>
                        <Link
                            href="/"
                            className="inline-flex items-center gap-2 rounded-xl bg-gray-100 px-5 py-3 font-medium text-gray-700 transition-colors hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
                        >
                            {t.home}
                        </Link>
                    </>
                )}
            />
        </div>
    );
}
