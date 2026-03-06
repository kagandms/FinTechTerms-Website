'use client';

import React, { useState, useEffect } from 'react';
import { Search, X, Filter } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useSRS } from '@/contexts/SRSContext';
import { Term, Category } from '@/types';

interface SearchBarProps {
    onResults: (results: Term[]) => void;
    onClear?: () => void;
}

const categories: Category[] = ['Fintech', 'Finance', 'Technology'];

export default function SearchBar({ onResults, onClear }: SearchBarProps) {
    const { t } = useLanguage();
    const { terms } = useSRS();
    const [query, setQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
    const [showFilters, setShowFilters] = useState(false);

    // Cross-language search
    useEffect(() => {
        const searchQuery = query.toLowerCase().trim();

        let filtered = terms;

        // Filter by category first
        if (selectedCategory) {
            filtered = filtered.filter(term => term.category === selectedCategory);
        }

        // Then filter by search query
        if (searchQuery) {
            filtered = filtered.filter(term =>
                term.term_en.toLowerCase().includes(searchQuery) ||
                term.term_ru.toLowerCase().includes(searchQuery) ||
                term.term_tr.toLowerCase().includes(searchQuery) ||
                term.definition_en.toLowerCase().includes(searchQuery) ||
                term.definition_ru.toLowerCase().includes(searchQuery) ||
                term.definition_tr.toLowerCase().includes(searchQuery)
            );
        }

        onResults(filtered);
    }, [query, selectedCategory, terms, onResults]);

    const handleClear = () => {
        setQuery('');
        setSelectedCategory(null);
        onClear?.();
    };

    return (
        <div className="space-y-3" role="search" aria-label="Term search">
            {/* Search Input */}
            <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Search className="w-5 h-5 text-gray-400 dark:text-gray-300" />
                </div>

                <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder={t('search.placeholder')}
                    aria-label={t('search.placeholder')}
                    className="w-full pl-12 pr-20 py-3.5 bg-white border border-gray-200 rounded-2xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all duration-200 shadow-sm dark:bg-gray-800 dark:border-gray-700 dark:text-white dark:placeholder-gray-400"
                />

                <div className="absolute inset-y-0 right-0 flex items-center gap-1 pr-2">
                    {(query || selectedCategory) && (
                        <button
                            onClick={handleClear}
                            className="p-2 text-gray-400 hover:text-gray-600 dark:text-gray-300 dark:hover:text-white transition-colors"
                            aria-label="Clear search"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    )}

                    <button
                        onClick={() => setShowFilters(!showFilters)}
                        className={`p-2 rounded-xl transition-all duration-200 ${showFilters || selectedCategory
                            ? 'bg-primary-100 text-primary-600 dark:bg-primary-900/30 dark:text-primary-300'
                            : 'text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:text-gray-300 dark:hover:bg-gray-700 dark:hover:text-white'
                            }`}
                        aria-label="Toggle category filters"
                        aria-expanded={showFilters}
                    >
                        <Filter className="w-5 h-5" />
                    </button>
                </div>
            </div>

            {/* Category Filters */}
            {showFilters && (
                <div className="flex flex-wrap gap-2 animate-fade-in">
                    <button
                        onClick={() => setSelectedCategory(null)}
                        className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 ${!selectedCategory
                            ? 'bg-primary-500 text-white shadow-md'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700'
                            }`}
                    >
                        {t('search.allTerms')}
                    </button>

                    {categories.map((cat) => (
                        <button
                            key={cat}
                            onClick={() => setSelectedCategory(cat)}
                            className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 ${selectedCategory === cat
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
