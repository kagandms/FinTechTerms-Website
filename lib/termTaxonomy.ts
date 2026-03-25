import type {
    RegionalMarket,
    TermContextTags,
    TermContextTagValue,
} from '@/types';

const CONTEXT_TAG_PRIORITY = [
    'disciplines',
    'contest_tracks',
    'target_universities',
    'contest_profile',
];

const KNOWN_LABELS: Record<string, string> = {
    bist: 'BIST',
    economics: 'Economics',
    finance: 'Finance',
    fintech: 'FinTech',
    global: 'Global',
    hse: 'HSE',
    mis: 'MIS',
    moex: 'MOEX',
    spbu: 'SPbU',
    technology: 'Technology',
};

const REGIONAL_MARKET_BADGES: Record<RegionalMarket, {
    label: string;
    description: string;
    className: string;
    dotClassName: string;
}> = {
    MOEX: {
        label: 'MOEX',
        description: 'Moscow Exchange',
        className: 'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-200',
        dotClassName: 'bg-sky-500 dark:bg-sky-300',
    },
    BIST: {
        label: 'BIST',
        description: 'Borsa Istanbul',
        className: 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200',
        dotClassName: 'bg-rose-500 dark:bg-rose-300',
    },
    GLOBAL: {
        label: 'GLOBAL',
        description: 'Global market',
        className: 'border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-200 dark:bg-white dark:text-slate-900',
        dotClassName: 'bg-slate-500 dark:bg-slate-700',
    },
};

const normalizeToken = (value: string): string => value.trim().toLowerCase();

const titleCase = (value: string): string => (
    value.charAt(0).toUpperCase() + value.slice(1).toLowerCase()
);

const formatTokenSegment = (segment: string): string => {
    const normalizedSegment = normalizeToken(segment);
    if (!normalizedSegment) {
        return '';
    }

    const knownLabel = KNOWN_LABELS[normalizedSegment];
    if (knownLabel) {
        return knownLabel;
    }

    if (segment === segment.toUpperCase() && segment.length <= 5) {
        return segment;
    }

    return titleCase(segment);
};

const formatContextValue = (
    key: string,
    value: Exclude<TermContextTagValue, boolean[]>
): string => {
    if (typeof value === 'boolean') {
        return value ? formatTaxonomyLabel(key) : '';
    }

    const rawValue = String(value).trim();
    if (!rawValue) {
        return '';
    }

    return formatTaxonomyLabel(rawValue);
};

export const formatTaxonomyLabel = (value: string): string => {
    const trimmedValue = value.trim();
    if (!trimmedValue) {
        return '';
    }

    const knownLabel = KNOWN_LABELS[normalizeToken(trimmedValue)];
    if (knownLabel) {
        return knownLabel;
    }

    return trimmedValue
        .split(/[\s_-]+/)
        .filter(Boolean)
        .map(formatTokenSegment)
        .join(' ');
};

export const getContextTagLabels = (contextTags: TermContextTags): string[] => {
    const entries = Object.entries(contextTags).sort(([leftKey], [rightKey]) => {
        const leftPriority = CONTEXT_TAG_PRIORITY.indexOf(leftKey);
        const rightPriority = CONTEXT_TAG_PRIORITY.indexOf(rightKey);

        if (leftPriority === -1 && rightPriority === -1) {
            return leftKey.localeCompare(rightKey);
        }

        if (leftPriority === -1) {
            return 1;
        }

        if (rightPriority === -1) {
            return -1;
        }

        return leftPriority - rightPriority;
    });

    const labels: string[] = [];
    const seen = new Set<string>();

    for (const [key, rawValue] of entries) {
        const values = Array.isArray(rawValue) ? rawValue : [rawValue];

        for (const value of values) {
            if (value === undefined || value === null) {
                continue;
            }

            const label = formatContextValue(
                key,
                value as Exclude<TermContextTagValue, boolean[]>
            );
            const normalizedLabel = normalizeToken(label);

            if (!label || seen.has(normalizedLabel)) {
                continue;
            }

            seen.add(normalizedLabel);
            labels.push(label);
        }
    }

    return labels;
};

export const getRegionalMarketBadgeConfig = (market: RegionalMarket) => (
    REGIONAL_MARKET_BADGES[market]
);
