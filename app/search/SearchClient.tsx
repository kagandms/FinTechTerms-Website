'use client';

import React, { useState, useCallback, useMemo } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useSRS } from '@/contexts/SRSContext';
import SearchBar from '@/components/SearchBar';
import SmartCard from '@/components/SmartCard';
import { Term, Language } from '@/types';
import { Search as SearchIcon } from 'lucide-react';

export default function SearchPage() {
    const { t, language } = useLanguage();
    const { terms } = useSRS();
    const [results, setResults] = useState<Term[]>(terms);
    const [hasSearched, setHasSearched] = useState(false);

    // Sort terms alphabetically based on current language
    const sortedTerms = useMemo(() => {
        const getTermByLang = (term: Term, lang: Language): string => {
            const termMap: Record<Language, string> = {
                tr: term.term_tr,
                en: term.term_en,
                ru: term.term_ru,
            };
            return termMap[lang];
        };

        return [...results].sort((a, b) => {
            const termA = getTermByLang(a, language).toLowerCase();
            const termB = getTermByLang(b, language).toLowerCase();
            return termA.localeCompare(termB, language);
        });
    }, [results, language]);

    const handleResults = useCallback((searchResults: Term[]) => {
        setResults(searchResults);
        setHasSearched(true);
    }, []);

    const handleClear = useCallback(() => {
        setResults(terms);
        setHasSearched(false);
    }, [terms]);

    return (
        <div className="page-content px-4 py-6">
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{
                    __html: JSON.stringify({
                        '@context': 'https://schema.org',
                        '@type': 'WebSite',
                        potentialAction: {
                            '@type': 'SearchAction',
                            target: 'https://fintechterms.com/search?q={search_term_string}',
                            'query-input': 'required name=search_term_string'
                        }
                    }),
                }}
            />
            {/* Header */}
            <header className="mb-6">
                <h1 className="text-2xl font-bold text-gray-900 mb-1">
                    {t('common.search')}
                </h1>
                <p className="text-sm text-gray-500">
                    {t('search.placeholder')}
                </p>
            </header>

            {/* Search Bar */}
            <div className="mb-6">
                <SearchBar onResults={handleResults} onClear={handleClear} />
            </div>

            {/* Results Count */}
            <p className="text-sm text-gray-500 mb-4">
                <span className="font-semibold text-primary-500">{sortedTerms.length}</span> {t('search.results')}
            </p>

            {/* Results */}
            {sortedTerms.length > 0 ? (
                <div className="space-y-4">
                    {sortedTerms.map((term) => (
                        <SmartCard key={term.id} term={term} />
                    ))}
                </div>
            ) : (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                    <div className="p-4 bg-gray-100 rounded-full mb-4">
                        <SearchIcon className="w-8 h-8 text-gray-400" />
                    </div>
                    <p className="text-gray-500">{t('search.noResults')}</p>
                </div>
            )}
        </div>
    );
}
