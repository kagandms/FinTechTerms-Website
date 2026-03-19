'use client';

import React from 'react';
import { useLanguage, languageNames, languageFlags } from '@/contexts/LanguageContext';
import { Language } from '@/types';
import { DEFAULT_LANGUAGE } from '@/lib/language';
import { ChevronDown } from 'lucide-react';

export default function LanguageSwitcher() {
    const { language, setLanguage } = useLanguage();
    const [isOpen, setIsOpen] = React.useState(false);
    const defaultLanguage: Language = DEFAULT_LANGUAGE;
    const activeLanguage = language || defaultLanguage;
    const languages = [defaultLanguage, 'en', 'tr', 'ru'].filter(
        (lang, index, allLanguages): lang is Language => allLanguages.indexOf(lang) === index
    );

    return (
        <div className="relative">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-2.5 py-2 shadow-sm transition-colors backdrop-blur-sm hover:bg-gray-50 dark:border-slate-600 dark:bg-slate-900/90 dark:hover:bg-slate-800"
            >
                <span className="text-lg">{languageFlags[activeLanguage]}</span>
                <span className="hidden sm:inline text-sm font-medium text-gray-700 dark:text-slate-100">
                    {languageNames[activeLanguage].native}
                </span>
                <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform dark:text-slate-300 ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {isOpen && (
                <>
                    {/* Backdrop */}
                    <div
                        className="fixed inset-0 z-40"
                        onClick={() => setIsOpen(false)}
                    />

                    {/* Dropdown */}
                    <div className="absolute top-full right-0 z-50 mt-2 min-w-[180px] overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg animate-fade-in dark:border-slate-600 dark:bg-slate-900">
                        {languages.map((lang) => (
                            <button
                                key={lang}
                                onClick={() => {
                                    setLanguage(lang);
                                    setIsOpen(false);
                                }}
                                className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
                                    activeLanguage === lang
                                        ? 'bg-primary-50 dark:bg-primary-500/20'
                                        : 'hover:bg-gray-50 dark:hover:bg-slate-800'
                                }`}
                            >
                                <span className="text-lg">{languageFlags[lang]}</span>
                                <div className="flex-1 text-left">
                                    <p className={`text-sm font-medium ${
                                        activeLanguage === lang
                                            ? 'text-primary-600 dark:text-primary-300'
                                            : 'text-gray-700 dark:text-slate-100'
                                    }`}>
                                        {languageNames[lang].native}
                                    </p>
                                    <p className="text-xs text-gray-400 dark:text-slate-400">
                                        {languageNames[lang].english}
                                    </p>
                                </div>
                                {activeLanguage === lang && (
                                    <div className="w-2 h-2 bg-primary-500 rounded-full" />
                                )}
                            </button>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
}
