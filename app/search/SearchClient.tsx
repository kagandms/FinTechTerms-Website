'use client';

import React, { useCallback, useMemo } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useLanguage } from '@/contexts/LanguageContext';
import { useSRS } from '@/contexts/SRSContext';
import SearchBar from '@/components/SearchBar';
import SmartCard from '@/components/SmartCard';
import DataStateCard from '@/components/DataStateCard';
import { getSiteUrl } from '@/lib/site-url';
import { RegionalMarket } from '@/types';
import { Search as SearchIcon, Loader2, RefreshCw } from 'lucide-react';
import {
    applySearchParams,
    defaultSearchFilterState,
    filterTermsForSearch,
    parseSearchFilterState,
    sortTermsForSearch,
    type SearchFilterState,
} from '@/lib/search-state';

interface SearchPageProps {
    nonce?: string;
}

export default function SearchPage({ nonce }: SearchPageProps) {
    const { language, t } = useLanguage();
    const { terms, isLoading, termsStatus, refreshData } = useSRS();
    const siteUrl = getSiteUrl();
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const filterState = useMemo(
        () => parseSearchFilterState(searchParams),
        [searchParams]
    );
    const visibleResults = useMemo(
        () => (filterState.hasActiveSearch ? filterTermsForSearch(terms, filterState) : terms),
        [filterState, terms]
    );

    const sortedTerms = useMemo(() => {
        return sortTermsForSearch(visibleResults, language, filterState.sortOrder);
    }, [visibleResults, language, filterState.sortOrder]);

    const navigateWithState = useCallback((
        updates: Partial<Pick<SearchFilterState, 'query' | 'selectedCategory' | 'selectedMarket' | 'sortOrder'>>,
        mode: 'push' | 'replace' = 'replace'
    ) => {
        const nextSearchParams = new URLSearchParams(searchParams.toString());
        const nextState = {
            ...defaultSearchFilterState,
            ...filterState,
            ...updates,
        };

        applySearchParams(nextSearchParams, nextState);

        const nextQueryString = nextSearchParams.toString();
        const nextHref = nextQueryString ? `${pathname}?${nextQueryString}` : pathname;
        const currentQueryString = searchParams.toString();
        const currentHref = currentQueryString ? `${pathname}?${currentQueryString}` : pathname;

        if (nextHref === currentHref) {
            return;
        }

        if (mode === 'push') {
            router.push(nextHref, { scroll: false });
            return;
        }

        router.replace(nextHref, { scroll: false });
    }, [filterState, pathname, router, searchParams]);

    const handleQueryChange = useCallback((query: string) => {
        navigateWithState({ query }, 'replace');
    }, [navigateWithState]);

    const handleClear = useCallback(() => {
        if (!searchParams.toString()) {
            return;
        }

        router.push(pathname, { scroll: false });
    }, [pathname, router, searchParams]);

    const handleCategoryChange = useCallback((selectedCategory: SearchFilterState['selectedCategory']) => {
        navigateWithState({ selectedCategory }, 'push');
    }, [navigateWithState]);

    const handleMarketChange = useCallback((selectedMarket: SearchFilterState['selectedMarket']) => {
        navigateWithState({ selectedMarket }, 'push');
    }, [navigateWithState]);

    const handleSortChange = useCallback((sortOrder: SearchFilterState['sortOrder']) => {
        navigateWithState({ sortOrder }, 'push');
    }, [navigateWithState]);

    const hasBlockingError = termsStatus === 'error' || (termsStatus === 'degraded' && terms.length === 0);
    const shouldShowDegradedNotice = !hasBlockingError && termsStatus === 'degraded';
    const showNoResults = filterState.hasActiveSearch && sortedTerms.length === 0;
    const showCatalogEmptyState = !filterState.hasActiveSearch && visibleResults.length === 0;
    const showMarketEmptyState = showNoResults && filterState.selectedMarket !== null;
    const activeMarketLabel = filterState.selectedMarket
        ? t(`search.markets.${filterState.selectedMarket as RegionalMarket}`)
        : null;

    return (
        <div className="page-content px-4 py-6">
            <script
                nonce={nonce}
                type="application/ld+json"
                dangerouslySetInnerHTML={{
                    __html: JSON.stringify({
                        '@context': 'https://schema.org',
                        '@type': 'WebSite',
                        potentialAction: {
                            '@type': 'SearchAction',
                            target: `${siteUrl}/search?q={search_term_string}`,
                            'query-input': 'required name=search_term_string'
                        }
                    }),
                }}
            />
            {/* Header */}
            <header className="mb-6">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
                    {t('search.title')}
                </h1>
                <p className="text-sm text-gray-500 dark:text-gray-300">
                    {t('search.description')}
                </p>
            </header>

            {isLoading ? (
                <DataStateCard
                    title={t('search.loadingTitle')}
                    description={t('search.loadingDescription')}
                    icon={<Loader2 className="w-10 h-10 animate-spin text-primary-500" />}
                />
            ) : hasBlockingError ? (
                <DataStateCard
                    tone="error"
                    title={t('search.errorTitle')}
                    description={t('search.errorDescription')}
                    action={(
                        <button
                            onClick={refreshData}
                            className="inline-flex items-center gap-2 rounded-xl bg-primary-500 px-5 py-3 font-semibold text-white transition-colors hover:bg-primary-600"
                        >
                            <RefreshCw className="w-4 h-4" />
                            {t('search.retry')}
                        </button>
                    )}
                />
            ) : (
                <>
                    {/* Search Bar */}
                    <div className="mb-6">
                        <SearchBar
                            filterState={filterState}
                            onQueryChange={handleQueryChange}
                            onCategoryChange={handleCategoryChange}
                            onMarketChange={handleMarketChange}
                            onSortChange={handleSortChange}
                            onClear={handleClear}
                        />
                    </div>

                    {shouldShowDegradedNotice ? (
                        <div className="mb-6">
                            <DataStateCard
                                tone="warning"
                                title={t('search.degradedTitle')}
                                description={t('search.degradedDescription')}
                                action={(
                                    <button
                                        onClick={refreshData}
                                        className="inline-flex items-center gap-2 rounded-xl bg-amber-500 px-5 py-3 font-semibold text-white transition-colors hover:bg-amber-600"
                                    >
                                        <RefreshCw className="w-4 h-4" />
                                        {t('search.retry')}
                                    </button>
                                )}
                            />
                        </div>
                    ) : null}

                    {!showCatalogEmptyState ? (
                        <div className="mb-4 flex flex-wrap items-center gap-3 text-sm text-gray-500 dark:text-gray-300">
                            <p>
                                <span className="font-semibold text-primary-500 dark:text-primary-300">{sortedTerms.length}</span> {t('search.results')}
                            </p>
                            {activeMarketLabel ? (
                                <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                                    {activeMarketLabel}
                                </span>
                            ) : null}
                        </div>
                    ) : null}

                    {sortedTerms.length > 0 ? (
                        <div className="space-y-4">
                            {sortedTerms.map((term) => (
                                <SmartCard key={term.id} term={term} />
                            ))}
                        </div>
                    ) : showNoResults ? (
                        <div className="flex flex-col items-center justify-center py-16 text-center">
                            <div className="p-4 bg-gray-100 dark:bg-gray-800 rounded-full mb-4">
                                <SearchIcon className="w-8 h-8 text-gray-400 dark:text-gray-300" />
                            </div>
                            <p className="text-base font-semibold text-slate-900 dark:text-slate-100">
                                {showMarketEmptyState ? t('search.filteredMarketTitle') : t('search.noResultsTitle')}
                            </p>
                            <p className="mt-2 max-w-md text-sm text-gray-500 dark:text-gray-300">
                                {showMarketEmptyState ? t('search.filteredMarketDescription') : t('search.noResultsDescription')}
                            </p>
                        </div>
                    ) : (
                        <DataStateCard
                            title={t('search.emptyTitle')}
                            description={t('search.emptyDescription')}
                        />
                    )}
                </>
            )}
        </div>
    );
}
