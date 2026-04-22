'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useLanguage } from '@/contexts/LanguageContext';
import { logger } from '@/lib/logger';
import { resolveHomeHref } from '@/lib/navigation';

export default function GlobalError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    const pathname = usePathname();
    const { t } = useLanguage();
    const homeHref = resolveHomeHref(pathname);

    useEffect(() => {
        logger.error('GLOBAL_ERROR_BOUNDARY_CAUGHT', {
            route: pathname ?? 'unknown',
            error,
        });
    }, [error, pathname]);

    return (
        <div className="min-h-[60vh] flex items-center justify-center px-4">
            <div className="text-center max-w-md">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/30 mb-6">
                    <span className="text-3xl font-black text-red-500">!</span>
                </div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">
                    {t('errors.globalTitle')}
                </h2>
                <p className="text-gray-500 dark:text-gray-400 mb-8 leading-relaxed">
                    {t('errors.globalDescription')}
                </p>
                <div className="flex gap-3 justify-center">
                    <button
                        onClick={reset}
                        className="inline-flex items-center gap-2 px-6 py-3 bg-primary-500 text-white font-semibold rounded-xl hover:bg-primary-600 transition-colors shadow-md"
                    >
                        {t('errors.retry')}
                    </button>
                    <a
                        href={homeHref}
                        className="inline-flex items-center gap-2 px-6 py-3 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-medium rounded-xl hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                    >
                        {t('errors.home')}
                    </a>
                </div>
            </div>
        </div>
    );
}
