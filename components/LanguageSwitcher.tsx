'use client';

import React from 'react';
import { useLanguage, languageNames, languageFlags } from '@/contexts/LanguageContext';
import { Language } from '@/types';
import { ChevronDown, Globe } from 'lucide-react';

export default function LanguageSwitcher() {
    const { language, setLanguage } = useLanguage();
    const [isOpen, setIsOpen] = React.useState(false);

    const languages: Language[] = ['tr', 'en', 'ru'];

    return (
        <div className="relative">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors shadow-sm"
            >
                <Globe className="w-4 h-4 text-gray-500" />
                <span className="text-lg">{languageFlags[language]}</span>
                <span className="text-sm font-medium text-gray-700">
                    {languageNames[language].native}
                </span>
                <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {isOpen && (
                <>
                    {/* Backdrop */}
                    <div
                        className="fixed inset-0 z-40"
                        onClick={() => setIsOpen(false)}
                    />

                    {/* Dropdown */}
                    <div className="absolute top-full right-0 mt-2 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden z-50 min-w-[160px] animate-fade-in">
                        {languages.map((lang) => (
                            <button
                                key={lang}
                                onClick={() => {
                                    setLanguage(lang);
                                    setIsOpen(false);
                                }}
                                className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors ${language === lang ? 'bg-primary-50' : ''
                                    }`}
                            >
                                <span className="text-lg">{languageFlags[lang]}</span>
                                <div className="flex-1 text-left">
                                    <p className={`text-sm font-medium ${language === lang ? 'text-primary-600' : 'text-gray-700'
                                        }`}>
                                        {languageNames[lang].native}
                                    </p>
                                    <p className="text-xs text-gray-400">
                                        {languageNames[lang].english}
                                    </p>
                                </div>
                                {language === lang && (
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
