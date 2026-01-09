'use client';

import React, { useState } from 'react';
import { Term, Language } from '@/types';
import { useLanguage } from '@/contexts/LanguageContext';
import { useSRS } from '@/contexts/SRSContext';
import { useAuth } from '@/contexts/AuthContext';
import { speakText, isSpeechAvailable } from '@/utils/tts';
import { getMasteryLevel } from '@/utils/srsLogic';
import Link from 'next/link';
import {
    Volume2,
    Heart,
    BookOpen,
    Cpu,
    TrendingUp,
    ChevronDown,
    ChevronUp,
    AlertCircle,
} from 'lucide-react';

interface SmartCardProps {
    term: Term;
    showFullDetails?: boolean;
}

const categoryIcons: Record<Term['category'], React.ReactNode> = {
    Fintech: <TrendingUp className="w-4 h-4" />,
    Economics: <BookOpen className="w-4 h-4" />,
    'Computer Science': <Cpu className="w-4 h-4" />,
};

const categoryColors: Record<Term['category'], string> = {
    Fintech: 'bg-accent-100 text-accent-700 border-accent-200',
    Economics: 'bg-blue-100 text-blue-700 border-blue-200',
    'Computer Science': 'bg-purple-100 text-purple-700 border-purple-200',
};

export default function SmartCard({ term, showFullDetails = false }: SmartCardProps) {
    const { language, t } = useLanguage();
    const { toggleFavorite, isFavorite, favoritesRemaining } = useSRS();
    const { isAuthenticated } = useAuth();
    const [isExpanded, setIsExpanded] = useState(showFullDetails);
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [showLimitWarning, setShowLimitWarning] = useState(false);

    const favorite = isFavorite(term.id);

    // Get term in each language
    const getTermByLang = (lang: Language): string => {
        const terms: Record<Language, string> = {
            tr: term.term_tr,
            en: term.term_en,
            ru: term.term_ru,
        };
        return terms[lang];
    };

    // Get phonetic for current language
    const getPhonetic = (): string | undefined => {
        const phonetics: Record<Language, string | undefined> = {
            tr: term.phonetic_tr,
            en: term.phonetic_en,
            ru: term.phonetic_ru,
        };
        return phonetics[language];
    };

    // Get definition in current language
    const getDefinition = (): string => {
        const defs: Record<Language, string> = {
            tr: term.definition_tr,
            en: term.definition_en,
            ru: term.definition_ru,
        };
        return defs[language];
    };

    // Get example sentence
    const getExample = (): string => {
        const examples: Record<Language, string> = {
            tr: term.example_sentence_tr,
            en: term.example_sentence_en,
            ru: term.example_sentence_ru,
        };
        return examples[language];
    };

    // Handle TTS
    const handleSpeak = async (text: string, lang: Language) => {
        if (!isSpeechAvailable()) return;

        setIsSpeaking(true);
        try {
            await speakText(text, lang);
        } catch (error) {
            console.error('TTS error:', error);
        } finally {
            setIsSpeaking(false);
        }
    };

    // Handle favorite toggle with limit check
    const handleToggleFavorite = () => {
        const result = toggleFavorite(term.id);
        if (result.limitReached) {
            setShowLimitWarning(true);
            setTimeout(() => setShowLimitWarning(false), 5000);
        }
    };

    return (
        <div className="bg-white rounded-2xl shadow-card hover:shadow-card-hover transition-all duration-300 overflow-hidden border border-gray-100">
            {/* Limit Warning */}
            {showLimitWarning && (
                <div className="bg-amber-50 border-b border-amber-100 px-4 py-3 flex items-start gap-3 animate-fade-in">
                    <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                    <div>
                        <p className="text-sm text-amber-700">{t('card.favoriteLimit')}</p>
                        <Link
                            href="/profile"
                            className="text-sm font-medium text-primary-500 hover:underline"
                        >
                            {t('auth.login')} →
                        </Link>
                    </div>
                </div>
            )}

            {/* Header */}
            <div className="p-4 pb-2">
                {/* Category Badge */}
                <div className="flex items-center justify-between mb-3">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${categoryColors[term.category]}`}>
                        {categoryIcons[term.category]}
                        {t(`categories.${term.category}`)}
                    </span>

                    {/* Mastery Level or Favorites Remaining */}
                    {term.times_reviewed > 0 ? (
                        <span className="text-xs text-gray-500">
                            {getMasteryLevel(term.srs_level, language)}
                        </span>
                    ) : !isAuthenticated && favoritesRemaining < 10 && (
                        <span className="text-xs text-amber-600">
                            {favoritesRemaining} {language === 'tr' ? 'hak' : language === 'ru' ? 'осталось' : 'left'}
                        </span>
                    )}
                </div>

                {/* Main Term */}
                <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                        <h3 className="text-xl font-bold text-primary-500 mb-1">
                            {getTermByLang(language)}
                        </h3>
                        {getPhonetic() && (
                            <p className="text-sm text-gray-500 font-mono">
                                {getPhonetic()}
                            </p>
                        )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => handleSpeak(getTermByLang(language), language)}
                            disabled={isSpeaking || !isSpeechAvailable()}
                            className={`p-2 rounded-full transition-all duration-200 ${isSpeaking
                                ? 'bg-accent-100 text-accent-600 animate-pulse-soft'
                                : 'bg-gray-100 text-gray-600 hover:bg-accent-100 hover:text-accent-600'
                                }`}
                            title={t('card.listen')}
                        >
                            <Volume2 className="w-5 h-5" />
                        </button>

                        <button
                            onClick={handleToggleFavorite}
                            className={`p-2 rounded-full transition-all duration-200 ${favorite
                                ? 'bg-red-100 text-red-500'
                                : 'bg-gray-100 text-gray-400 hover:bg-red-50 hover:text-red-400'
                                }`}
                            title={favorite ? t('card.removeFavorite') : t('card.addFavorite')}
                        >
                            <Heart className={`w-5 h-5 ${favorite ? 'fill-current' : ''}`} />
                        </button>
                    </div>
                </div>

                {/* Translations */}
                <div className="mt-3 flex flex-wrap gap-2">
                    {(['en', 'ru', 'tr'] as Language[])
                        .filter(l => l !== language)
                        .map(lang => (
                            <button
                                key={lang}
                                onClick={() => handleSpeak(getTermByLang(lang), lang)}
                                className="inline-flex items-center gap-1 px-2 py-1 bg-gray-50 rounded-lg text-sm text-gray-600 hover:bg-gray-100 transition-colors"
                            >
                                <span className="text-xs opacity-60">{lang.toUpperCase()}</span>
                                <span className="font-medium">{getTermByLang(lang)}</span>
                            </button>
                        ))}
                </div>
            </div>

            {/* Definition - Always visible */}
            <div className="px-4 py-3 bg-gray-50 border-t border-gray-100">
                <p className="text-sm text-gray-700 leading-relaxed">
                    {getDefinition()}
                </p>
            </div>

            {/* Expandable Section */}
            <div>
                <button
                    onClick={() => setIsExpanded(!isExpanded)}
                    className="w-full px-4 py-2 flex items-center justify-center gap-1 text-sm text-gray-500 hover:text-primary-500 hover:bg-gray-50 transition-colors"
                >
                    {isExpanded ? (
                        <>
                            <ChevronUp className="w-4 h-4" />
                            <span>{language === 'tr' ? 'Daha az' : language === 'ru' ? 'Меньше' : 'Less'}</span>
                        </>
                    ) : (
                        <>
                            <ChevronDown className="w-4 h-4" />
                            <span>{t('card.example')}</span>
                        </>
                    )}
                </button>

                {isExpanded && (
                    <div className="px-4 pb-4 animate-fade-in">
                        <div className="p-3 bg-primary-50 rounded-lg border border-primary-100">
                            <p className="text-sm text-primary-700 italic">
                                "{getExample()}"
                            </p>
                        </div>

                        {/* Analytics Preview (for academic purposes) */}
                        {term.times_reviewed > 0 && (
                            <div className="mt-3 flex items-center gap-4 text-xs text-gray-500">
                                <span>{language === 'tr' ? 'Zorluk' : language === 'ru' ? 'Сложность' : 'Difficulty'}: {term.difficulty_score.toFixed(1)}/5</span>
                                <span>{language === 'tr' ? 'Başarı' : language === 'ru' ? 'Успех' : 'Success'}: %{Math.round(term.retention_rate * 100)}</span>
                                <span>{language === 'tr' ? 'Tekrar' : language === 'ru' ? 'Повторов' : 'Reviews'}: {term.times_reviewed}x</span>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
