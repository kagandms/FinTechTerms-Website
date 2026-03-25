import 'server-only';

import { mockTerms } from '@/data/mockData';
import { filterAcademicTerms } from '@/lib/academicQuarantine';
import { normalizeSearchText } from '@/lib/search-normalization';
import type { Category, RegionalMarket, Term } from '@/types';

interface SearchCatalogOptions {
    readonly query?: string;
    readonly category?: Category | null;
    readonly market?: RegionalMarket | null;
    readonly sortOrder?: 'alpha-asc' | 'alpha-desc';
    readonly page?: number;
    readonly pageSize?: number;
}

interface SearchCatalogResult {
    readonly data: Term[];
    readonly page: number;
    readonly pageSize: number;
    readonly totalCount: number;
}

const TERM_CATALOG_LAST_MODIFIED = '2026-03-11T00:00:00.000Z';

const normalizedCatalog = filterAcademicTerms(mockTerms).map((term) => ({
    ...term,
}));

const catalogById = new Map(normalizedCatalog.map((term) => [term.id, term] as const));

const matchesQuery = (term: Term, query: string): boolean => {
    const normalizedQuery = normalizeSearchText(query);

    if (!normalizedQuery) {
        return true;
    }

    const haystack = normalizeSearchText([
        term.term_en,
        term.term_ru,
        term.term_tr,
        term.definition_en,
        term.definition_ru,
        term.definition_tr,
    ].join(' '));

    return haystack.includes(normalizedQuery);
};

const sortTerms = (
    terms: readonly Term[],
    sortOrder: 'alpha-asc' | 'alpha-desc'
): Term[] => {
    const sortedTerms = [...terms].sort((left, right) => left.term_ru.localeCompare(right.term_ru, 'ru'));

    if (sortOrder === 'alpha-desc') {
        sortedTerms.reverse();
    }

    return sortedTerms;
};

export const getPublicTermById = async (termId: string): Promise<Term | null> => (
    catalogById.get(termId) ?? null
);

export const listHomepageTerms = async (limit = 3): Promise<Term[]> => {
    const selectedTerms: Term[] = [];
    const seenCategories = new Set<Category>();

    for (const term of sortTerms(normalizedCatalog, 'alpha-asc')) {
        if (seenCategories.has(term.category)) {
            continue;
        }

        selectedTerms.push(term);
        seenCategories.add(term.category);

        if (selectedTerms.length === limit) {
            return selectedTerms;
        }
    }

    return normalizedCatalog.slice(0, limit);
};

export const listSitemapTerms = async (): Promise<Array<{ id: string; lastModified: string }>> => (
    normalizedCatalog.map((term) => ({
        id: term.id,
        lastModified: TERM_CATALOG_LAST_MODIFIED,
    }))
);

export const getPublicTermCount = async (): Promise<number> => normalizedCatalog.length;

export const searchPublicTerms = async (
    options: SearchCatalogOptions = {}
): Promise<SearchCatalogResult> => {
    const {
        query = '',
        category = null,
        market = null,
        page = 1,
        pageSize = 24,
        sortOrder = 'alpha-asc',
    } = options;

    const filteredTerms = normalizedCatalog.filter((term) => {
        if (category && term.category !== category) {
            return false;
        }

        if (market && !(term.regional_markets ?? [term.regional_market]).includes(market)) {
            return false;
        }

        return matchesQuery(term, query);
    });

    const safePage = Math.max(page, 1);
    const safePageSize = Math.min(Math.max(pageSize, 1), 100);
    const from = (safePage - 1) * safePageSize;
    const to = from + safePageSize;

    return {
        data: sortTerms(filteredTerms, sortOrder).slice(from, to),
        page: safePage,
        pageSize: safePageSize,
        totalCount: filteredTerms.length,
    };
};
