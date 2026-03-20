'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { RefreshCw } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import DataStateCard from '@/components/DataStateCard';
import { logger } from '@/lib/logger';
import { resolveHomeHref } from '@/lib/navigation';

interface RouteErrorFallbackProps {
    error: Error & { digest?: string };
    reset: () => void;
}

export default function RouteErrorFallback({ error, reset }: RouteErrorFallbackProps) {
    const pathname = usePathname();
    const { t } = useLanguage();
    const homeHref = resolveHomeHref(pathname);

    useEffect(() => {
        logger.error('ROUTE_ERROR_BOUNDARY_CAUGHT', {
            route: pathname ?? 'unknown',
            error,
        });
    }, [error, pathname]);

    return (
        <div className="page-content px-4 py-8">
            <DataStateCard
                tone="error"
                title={t('errors.routeLoadTitle')}
                description={t('errors.routeLoadDescription')}
                action={(
                    <>
                        <button
                            onClick={reset}
                            className="inline-flex items-center gap-2 rounded-xl bg-primary-500 px-5 py-3 font-semibold text-white transition-colors hover:bg-primary-600"
                        >
                            <RefreshCw className="w-4 h-4" />
                            {t('errors.retry')}
                        </button>
                        <Link
                            href={homeHref}
                            className="inline-flex items-center gap-2 rounded-xl bg-gray-100 px-5 py-3 font-medium text-gray-700 transition-colors hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
                        >
                            {t('errors.home')}
                        </Link>
                    </>
                )}
            />
        </div>
    );
}
