'use client';

import React from 'react';
import { resolveHomeHref } from '@/lib/navigation';
import { useLanguage } from '@/contexts/LanguageContext';
import { useSRS } from '@/contexts/SRSContext';
import { useAuth } from '@/contexts/AuthContext';
import SmartCard from '@/components/SmartCard';
import DataStateCard from '@/components/DataStateCard';
import Link from 'next/link';
import { ArrowLeft, BookMarked, Loader2, RefreshCw } from 'lucide-react';

export default function FavoritesClient() {
    const { t } = useLanguage();
    const { isAuthenticated } = useAuth();
    const {
        terms,
        userProgress,
        termsStatus,
        progressStatus,
        refreshData,
    } = useSRS();
    const homeHref = isAuthenticated ? resolveHomeHref('/favorites') : '/';

    // Get the terms that the user has favorited
    const favoriteTerms = terms.filter(term => userProgress.favorites.includes(term.id));
    const isRouteLoading = (termsStatus === 'loading' && terms.length === 0)
        || (progressStatus === 'loading' && favoriteTerms.length === 0);
    const hasBlockingError = termsStatus === 'error'
        || progressStatus === 'error'
        || ((termsStatus === 'degraded' || progressStatus === 'degraded') && favoriteTerms.length === 0);
    const shouldShowDegradedNotice = !hasBlockingError && (termsStatus === 'degraded' || progressStatus === 'degraded');

    return (
        <div className="page-content px-4 py-8 mb-20 max-w-4xl mx-auto min-h-screen">
            <header className="mb-8 hidden md:block">
                <Link href={homeHref} className="inline-flex items-center text-sm font-medium app-text-secondary hover:text-gray-900 dark:hover:text-white transition-colors mb-4">
                    <ArrowLeft className="w-4 h-4 mr-1" />
                    {t('favorites.backToHome')}
                </Link>
                <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white flex items-center gap-3">
                    <BookMarked className="w-8 h-8 text-primary-500" />
                    {t('favorites.title')}
                </h1>
                <p className="mt-2 app-text-secondary">
                    {t('favorites.description')}
                </p>
            </header>

            {/* Mobile Header */}
            <header className="md:hidden flex items-center justify-between mb-8 pb-4 border-b border-gray-100 dark:border-gray-800">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary-50 dark:bg-primary-900/20 text-primary-500 rounded-xl">
                        <BookMarked className="w-6 h-6" />
                    </div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                        {t('favorites.mobileTitle')}
                    </h1>
                </div>
            </header>

            <div className="space-y-4">
                {isRouteLoading ? (
                    <DataStateCard
                        title={t('favorites.loadingTitle')}
                        description={t('favorites.loadingDescription')}
                        icon={<Loader2 className="w-10 h-10 animate-spin text-primary-500" />}
                    />
                ) : hasBlockingError ? (
                    <DataStateCard
                        tone="error"
                        title={t('favorites.errorTitle')}
                        description={t('favorites.errorDescription')}
                        action={(
                            <button
                                onClick={refreshData}
                                className="inline-flex items-center gap-2 rounded-xl bg-primary-500 px-5 py-3 font-semibold text-white transition-colors hover:bg-primary-600"
                            >
                                <RefreshCw className="w-4 h-4" />
                                {t('favorites.retry')}
                            </button>
                        )}
                    />
                ) : favoriteTerms.length > 0 ? (
                    <>
                        {shouldShowDegradedNotice ? (
                            <DataStateCard
                                tone="warning"
                                title={t('favorites.degradedTitle')}
                                description={t('favorites.degradedDescription')}
                                action={(
                                    <button
                                        onClick={refreshData}
                                        className="inline-flex items-center gap-2 rounded-xl bg-amber-500 px-5 py-3 font-semibold text-white transition-colors hover:bg-amber-600"
                                    >
                                        <RefreshCw className="w-4 h-4" />
                                        {t('favorites.retry')}
                                    </button>
                                )}
                            />
                        ) : null}
                        {favoriteTerms.map(term => (
                            <SmartCard key={term.id} term={term} />
                        ))}
                    </>
                ) : (
                    <>
                        {shouldShowDegradedNotice ? (
                            <DataStateCard
                                tone="warning"
                                title={t('favorites.degradedTitle')}
                                description={t('favorites.degradedDescription')}
                                action={(
                                    <button
                                        onClick={refreshData}
                                        className="inline-flex items-center gap-2 rounded-xl bg-amber-500 px-5 py-3 font-semibold text-white transition-colors hover:bg-amber-600"
                                    >
                                        <RefreshCw className="w-4 h-4" />
                                        {t('favorites.retry')}
                                    </button>
                                )}
                            />
                        ) : null}
                        <div className="app-surface rounded-2xl border-dashed p-12 text-center mt-8">
                            <BookMarked className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
                                {t('favorites.emptyTitle')}
                            </h3>
                            <p className="app-text-secondary mb-6 max-w-sm mx-auto">
                                {t('favorites.emptyDescription')}
                            </p>
                            <Link href="/search" className="inline-flex px-6 py-3 bg-primary-500 text-white font-medium rounded-xl hover:bg-primary-600 transition-colors shadow-sm">
                                {t('favorites.explore')}
                            </Link>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
