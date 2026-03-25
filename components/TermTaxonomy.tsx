import React from 'react';
import { getTranslationString } from '@/lib/i18n';
import type { Language, RegionalMarket, TermContextTags } from '@/types';
import {
    getContextTagLabels,
    getRegionalMarketBadgeConfig,
} from '@/lib/termTaxonomy';

interface MarketBadgeProps {
    market: RegionalMarket;
    showGlobal?: boolean;
    size?: 'sm' | 'md';
}

interface ContextTagListProps {
    contextTags: TermContextTags;
    maxItems?: number;
    className?: string;
}

interface TaxonomySummaryProps {
    market: RegionalMarket;
    contextTags: TermContextTags;
    locale?: Language;
    showGlobalMarket?: boolean;
    maxContextTags?: number;
    className?: string;
}

export function MarketBadge({
    market,
    showGlobal = true,
    size = 'sm',
}: MarketBadgeProps) {
    if (market === 'GLOBAL' && !showGlobal) {
        return null;
    }

    const marketBadge = getRegionalMarketBadgeConfig(market);
    const sizeClassName = size === 'md'
        ? 'px-3 py-1.5 text-xs'
        : 'px-2.5 py-1 text-[11px]';

    return (
        <span
            title={marketBadge.description}
            className={`inline-flex items-center gap-2 rounded-full border font-semibold tracking-wide ${sizeClassName} ${marketBadge.className}`}
        >
            <span className={`h-2 w-2 rounded-full ${marketBadge.dotClassName}`} />
            <span>{marketBadge.label}</span>
        </span>
    );
}

export function ContextTagList({
    contextTags,
    maxItems,
    className = '',
}: ContextTagListProps) {
    const labels = getContextTagLabels(contextTags);

    if (labels.length === 0) {
        return null;
    }

    const visibleLabels = typeof maxItems === 'number'
        ? labels.slice(0, maxItems)
        : labels;
    const hiddenCount = labels.length - visibleLabels.length;

    return (
        <div className={className}>
            <div className="flex flex-wrap gap-2">
                {visibleLabels.map((label) => (
                    <span
                        key={label}
                        className="inline-flex items-center rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-[11px] font-medium text-gray-600 dark:border-slate-500/70 dark:bg-slate-700 dark:text-slate-100"
                    >
                        {label}
                    </span>
                ))}
                {hiddenCount > 0 ? (
                    <span className="inline-flex items-center rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-[11px] font-medium text-gray-500 dark:border-slate-500/70 dark:bg-slate-700 dark:text-slate-200">
                        +{hiddenCount}
                    </span>
                ) : null}
            </div>
        </div>
    );
}

export function TaxonomySummary({
    market,
    contextTags,
    locale = 'en',
    showGlobalMarket = true,
    maxContextTags,
    className = '',
}: TaxonomySummaryProps) {
    const labels = getContextTagLabels(contextTags);
    const showMarket = showGlobalMarket || market !== 'GLOBAL';

    if (!showMarket && labels.length === 0) {
        return null;
    }

    const marketLabel = getTranslationString(locale, 'taxonomy.market') ?? 'Regional market';
    const contextLabel = getTranslationString(locale, 'taxonomy.context') ?? 'Academic context';

    return (
        <section className={`rounded-2xl border border-gray-200 bg-gray-50/80 p-5 dark:border-gray-700 dark:bg-gray-800/60 ${className}`}>
            {showMarket ? (
                <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-gray-500 dark:text-gray-400">
                        {marketLabel}
                    </p>
                    <MarketBadge market={market} size="md" showGlobal={showGlobalMarket} />
                </div>
            ) : null}

            {labels.length > 0 ? (
                <div className={showMarket ? 'mt-4 border-t border-gray-200 pt-4 dark:border-gray-700' : ''}>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-gray-500 dark:text-gray-400">
                        {contextLabel}
                    </p>
                    <ContextTagList contextTags={contextTags} maxItems={maxContextTags} />
                </div>
            ) : null}
        </section>
    );
}
