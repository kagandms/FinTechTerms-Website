import { Category, Language, RegionalMarket, Term } from '@/types';
import { normalizeSearchText } from '@/lib/search-normalization';

export type SearchSortOrder = 'alpha-asc' | 'alpha-desc';

export interface SearchFilterState {
    query: string;
    selectedCategory: Category | null;
    selectedMarket: RegionalMarket | null;
    sortOrder: SearchSortOrder;
    hasActiveSearch: boolean;
}

const VALID_CATEGORIES = new Set<Category>(['Fintech', 'Finance', 'Technology']);
const VALID_MARKETS = new Set<RegionalMarket>(['MOEX', 'BIST', 'GLOBAL']);
const VALID_SORT_ORDERS = new Set<SearchSortOrder>(['alpha-asc', 'alpha-desc']);

export const DEFAULT_SEARCH_SORT_ORDER: SearchSortOrder = 'alpha-asc';

export const defaultSearchFilterState: SearchFilterState = {
    query: '',
    selectedCategory: null,
    selectedMarket: null,
    sortOrder: DEFAULT_SEARCH_SORT_ORDER,
    hasActiveSearch: false,
};

type SearchParamsReader = {
    get: (name: string) => string | null;
};

const parseCategory = (value: string | null): Category | null => (
    VALID_CATEGORIES.has(value as Category)
        ? value as Category
        : null
);

const parseMarket = (value: string | null): RegionalMarket | null => (
    VALID_MARKETS.has(value as RegionalMarket)
        ? value as RegionalMarket
        : null
);

const parseSortOrder = (value: string | null): SearchSortOrder => (
    VALID_SORT_ORDERS.has(value as SearchSortOrder)
        ? value as SearchSortOrder
        : DEFAULT_SEARCH_SORT_ORDER
);

export const parseSearchFilterState = (searchParams: SearchParamsReader): SearchFilterState => {
    const query = searchParams.get('q')?.trim() ?? '';
    const selectedCategory = parseCategory(searchParams.get('category'));
    const selectedMarket = parseMarket(searchParams.get('market'));
    const sortOrder = parseSortOrder(searchParams.get('sort'));
    const hasActiveSearch = (
        query.length > 0
        || selectedCategory !== null
        || selectedMarket !== null
    );

    return {
        query,
        selectedCategory,
        selectedMarket,
        sortOrder,
        hasActiveSearch,
    };
};

export const applySearchParams = (
    searchParams: URLSearchParams,
    filterState: Pick<SearchFilterState, 'query' | 'selectedCategory' | 'selectedMarket' | 'sortOrder'>
) => {
    const normalizedQuery = filterState.query.trim();

    if (normalizedQuery) {
        searchParams.set('q', normalizedQuery);
    } else {
        searchParams.delete('q');
    }

    if (filterState.selectedCategory) {
        searchParams.set('category', filterState.selectedCategory);
    } else {
        searchParams.delete('category');
    }

    if (filterState.selectedMarket) {
        searchParams.set('market', filterState.selectedMarket);
    } else {
        searchParams.delete('market');
    }

    if (filterState.sortOrder !== DEFAULT_SEARCH_SORT_ORDER) {
        searchParams.set('sort', filterState.sortOrder);
    } else {
        searchParams.delete('sort');
    }

    return searchParams;
};

export const filterTermsForSearch = (
    terms: Term[],
    filterState: Pick<SearchFilterState, 'query' | 'selectedCategory' | 'selectedMarket'>
): Term[] => {
    const searchQuery = normalizeSearchText(filterState.query);
    let filtered = terms;

    if (filterState.selectedCategory) {
        filtered = filtered.filter((term) => term.category === filterState.selectedCategory);
    }

    if (filterState.selectedMarket) {
        filtered = filtered.filter((term) => {
            const termMarkets = term.regional_markets ?? [term.regional_market];
            return termMarkets.includes(filterState.selectedMarket!);
        });
    }

    if (!searchQuery) {
        return filtered;
    }

    return filtered.filter((term) => (
        normalizeSearchText(term.term_en).includes(searchQuery)
        || normalizeSearchText(term.term_ru).includes(searchQuery)
        || normalizeSearchText(term.term_tr).includes(searchQuery)
        || normalizeSearchText(term.definition_en).includes(searchQuery)
        || normalizeSearchText(term.definition_ru).includes(searchQuery)
        || normalizeSearchText(term.definition_tr).includes(searchQuery)
    ));
};

const getTermByLanguage = (term: Term, language: Language): string => {
    const termMap: Record<Language, string> = {
        tr: term.term_tr,
        en: term.term_en,
        ru: term.term_ru,
    };

    return termMap[language];
};

export const sortTermsForSearch = (
    terms: Term[],
    language: Language,
    sortOrder: SearchSortOrder
): Term[] => {
    const direction = sortOrder === 'alpha-desc' ? -1 : 1;

    return [...terms].sort((left, right) => (
        getTermByLanguage(left, language)
            .toLowerCase()
            .localeCompare(getTermByLanguage(right, language).toLowerCase(), language)
        * direction
    ));
};
