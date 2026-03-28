import 'server-only';

import { fullRepoTerms } from '@/data/terms/repo-catalog';
import { filterAcademicTerms } from '@/lib/academicQuarantine';
import { normalizeSearchText } from '@/lib/search-normalization';
import type { Language, Term } from '@/types';

const groundedCatalog = filterAcademicTerms(fullRepoTerms);

const DOMAIN_KEYWORDS = [
    'finance',
    'financial',
    'fintech',
    'technology',
    'tech',
    'bank',
    'banking',
    'payment',
    'payments',
    'open banking',
    'crypto',
    'bitcoin',
    'market',
    'trading',
    'stock',
    'equity',
    'debt',
    'inflation',
    'gdp',
    'api',
    'sql',
    'database',
    'token',
    'tokenization',
    'blockchain',
    'wallet',
    'merchant',
    'compliance',
    'fraud',
    'security',
    'ai',
    'machine learning',
    'finans',
    'fintek',
    'teknoloji',
    'banka',
    'ödeme',
    'kripto',
    'piyasa',
    'işlem',
    'enflasyon',
    'gsyih',
    'банк',
    'финансы',
    'финтех',
    'технолог',
    'рынок',
    'инфляц',
];

const getLocalizedTermLabel = (term: Term, language: Language): string => (
    language === 'tr' ? term.term_tr : language === 'ru' ? term.term_ru : term.term_en
);

const getLocalizedDefinition = (term: Term, language: Language): string => (
    language === 'tr' ? term.definition_tr : language === 'ru' ? term.definition_ru : term.definition_en
);

const scoreTermAgainstQuery = (term: Term, normalizedQuery: string, queryTokens: readonly string[]): number => {
    if (!normalizedQuery) {
        return 0;
    }

    const titleHaystack = normalizeSearchText(`${term.term_en} ${term.term_ru} ${term.term_tr}`);
    const definitionHaystack = normalizeSearchText(`${term.definition_en} ${term.definition_ru} ${term.definition_tr}`);

    let score = 0;

    if (titleHaystack.includes(normalizedQuery)) {
        score += 12;
    }

    if (definitionHaystack.includes(normalizedQuery)) {
        score += 6;
    }

    for (const token of queryTokens) {
        if (titleHaystack.includes(token)) {
            score += 3;
        }

        if (definitionHaystack.includes(token)) {
            score += 1;
        }
    }

    return score;
};

export const getAiCatalogTermById = (termId: string): Term | null => (
    groundedCatalog.find((term) => term.id === termId) ?? null
);

export const findRelevantAiTerms = (query: string, limit = 5): Term[] => {
    const normalizedQuery = normalizeSearchText(query);
    const queryTokens = normalizedQuery.split(' ').filter((token) => token.length >= 2);

    return groundedCatalog
        .map((term) => ({
            term,
            score: scoreTermAgainstQuery(term, normalizedQuery, queryTokens),
        }))
        .filter((entry) => entry.score > 0)
        .sort((left, right) => {
            if (right.score === left.score) {
                return left.term.term_en.localeCompare(right.term.term_en, 'en');
            }

            return right.score - left.score;
        })
        .slice(0, limit)
        .map((entry) => entry.term);
};

export const isAiDomainQuestion = (question: string): boolean => {
    const normalizedQuestion = normalizeSearchText(question);

    if (!normalizedQuestion) {
        return false;
    }

    if (DOMAIN_KEYWORDS.some((keyword) => normalizedQuestion.includes(normalizeSearchText(keyword)))) {
        return true;
    }

    return findRelevantAiTerms(question, 3).length > 0;
};

export const formatTermContextForAi = (term: Term, language: Language): string => [
    `Term (${language}): ${getLocalizedTermLabel(term, language)}`,
    `English: ${term.term_en}`,
    `Turkish: ${term.term_tr}`,
    `Russian: ${term.term_ru}`,
    `Definition (${language}): ${getLocalizedDefinition(term, language)}`,
    `Example (${language}): ${language === 'tr' ? term.example_sentence_tr : language === 'ru' ? term.example_sentence_ru : term.example_sentence_en}`,
    `Category: ${term.category}`,
    `Regional market: ${term.regional_market}`,
    `Context tags: ${Object.keys(term.context_tags).join(', ') || 'none'}`,
].join('\n');
