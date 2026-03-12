'use client';

import React, { useState } from 'react';
import { Search, X, Filter } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { Category, RegionalMarket } from '@/types';
import {
    DEFAULT_SEARCH_SORT_ORDER,
    type SearchFilterState,
    type SearchSortOrder,
} from '@/lib/search-state';

export type { SearchFilterState, SearchSortOrder } from '@/lib/search-state';

interface SearchBarProps {
    filterState: SearchFilterState;
    onQueryChange: (query: string) => void;
    onCategoryChange: (category: Category | null) => void;
    onMarketChange: (market: RegionalMarket | null) => void;
    onSortChange: (sortOrder: SearchSortOrder) => void;
    onClear: () => void;
}

const categories: Category[] = ['Fintech', 'Finance', 'Technology'];
const regionalMarkets: RegionalMarket[] = ['MOEX', 'BIST', 'GLOBAL'];

export default function SearchBar({
    filterState,
    onQueryChange,
    onCategoryChange,
    onMarketChange,
    onSortChange,
    onClear,
}: SearchBarProps) {
    const { t } = useLanguage();
    const [showOptionalFilters, setShowOptionalFilters] = useState(filterState.selectedCategory !== null);
    const showFilters = showOptionalFilters || filterState.selectedCategory !== null;

    const hasActiveFilters = (
        filterState.query.length > 0
        || filterState.selectedCategory !== null
        || filterState.selectedMarket !== null
        || filterState.sortOrder !== DEFAULT_SEARCH_SORT_ORDER
    );

    const handleClear = () => {
        setShowOptionalFilters(false);
        onClear();
    };

    return (
        <div className="space-y-3" role="search" aria-label={t('search.containerLabel')}>
            {/* Search Input */}
            <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Search className="w-5 h-5 text-gray-400 dark:text-gray-300" />
                </div>

                <input
                    type="text"
                    value={filterState.query}
                    onChange={(e) => onQueryChange(e.target.value)}
                    data-testid="search-input"
                    placeholder={t('search.placeholder')}
                    aria-label={t('search.placeholder')}
                    className="w-full pl-12 pr-20 py-3.5 bg-white border border-gray-200 rounded-2xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all duration-200 shadow-sm dark:bg-gray-800 dark:border-gray-700 dark:text-white dark:placeholder-gray-400"
                />

                <div className="absolute inset-y-0 right-0 flex items-center gap-1 pr-2">
                    {hasActiveFilters && (
                        <button
                            type="button"
                            onClick={handleClear}
                            className="p-2 text-gray-400 hover:text-gray-600 dark:text-gray-300 dark:hover:text-white transition-colors"
                            aria-label={t('search.clearSearch')}
                        >
                            <X className="w-5 h-5" />
                        </button>
                    )}

                        <button
                            type="button"
                            onClick={() => setShowOptionalFilters((current) => !current)}
                            data-testid="search-filter-toggle"
                            className={`p-2 rounded-xl transition-all duration-200 ${showFilters || filterState.selectedCategory
                                ? 'bg-primary-100 text-primary-600 dark:bg-primary-900/30 dark:text-primary-300'
                                : 'text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:text-gray-300 dark:hover:bg-gray-700 dark:hover:text-white'
                            }`}
                        aria-label={showFilters ? t('search.hideFilters') : t('search.showFilters')}
                        aria-expanded={showFilters}
                    >
                        <Filter className="w-5 h-5" />
                    </button>
                </div>
            </div>

            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                        {t('search.marketLabel')}
                    </p>
                    <div className="flex flex-wrap gap-2">
                        <button
                            type="button"
                            onClick={() => onMarketChange(null)}
                            aria-pressed={!filterState.selectedMarket}
                            className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 ${!filterState.selectedMarket
                                ? 'bg-slate-900 text-white shadow-md dark:bg-slate-100 dark:text-slate-900'
                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700'
                                }`}
                        >
                            {t('search.allMarkets')}
                        </button>

                        {regionalMarkets.map((market) => (
                            <button
                                key={market}
                                type="button"
                                onClick={() => onMarketChange(market)}
                                aria-pressed={filterState.selectedMarket === market}
                                className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 ${filterState.selectedMarket === market
                                    ? 'bg-primary-500 text-white shadow-md'
                                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700'
                                    }`}
                            >
                                {t(`search.markets.${market}`)}
                            </button>
                        ))}
                    </div>
                </div>

                <label className="flex min-w-[12rem] flex-col gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                    <span>{t('search.sortLabel')}</span>
                    <select
                        value={filterState.sortOrder}
                        onChange={(event) => onSortChange(event.target.value as SearchSortOrder)}
                        aria-label={t('search.sortLabel')}
                        className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-medium normal-case tracking-normal text-gray-900 shadow-sm transition-all duration-200 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                    >
                        <option value="alpha-asc">{t('search.sort.alphaAsc')}</option>
                        <option value="alpha-desc">{t('search.sort.alphaDesc')}</option>
                    </select>
                </label>
            </div>

            {/* Category Filters */}
            {showFilters && (
                <div className="flex flex-wrap gap-2 animate-fade-in">
                    <button
                        type="button"
                        onClick={() => onCategoryChange(null)}
                        aria-pressed={!filterState.selectedCategory}
                        className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 ${!filterState.selectedCategory
                            ? 'bg-primary-500 text-white shadow-md'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700'
                            }`}
                    >
                        {t('search.allTerms')}
                    </button>

                    {categories.map((cat) => (
                        <button
                            key={cat}
                            type="button"
                            onClick={() => onCategoryChange(cat)}
                            aria-pressed={filterState.selectedCategory === cat}
                            className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 ${filterState.selectedCategory === cat
                                ? 'bg-primary-500 text-white shadow-md'
                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700'
                                }`}
                        >
                            {t(`categories.${cat}`)}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
