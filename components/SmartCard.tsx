'use client';

import React, { useState } from 'react';
import { Term, Language } from '@/types';
import { useTermTranslation } from '@/hooks/useTermTranslation';
import { useSRS } from '@/contexts/SRSContext';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
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
    Finance: <BookOpen className="w-4 h-4" />,
    Technology: <Cpu className="w-4 h-4" />,
};

const categoryColors: Record<Term['category'], string> = {
    Fintech: 'bg-accent-100 text-accent-700 border-accent-200',
    Finance: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    Technology: 'bg-slate-100 text-slate-700 border-slate-200',
};

export default function SmartCard({ term, showFullDetails = false }: SmartCardProps) {
    const {
        language,
        t,
        getTermByLang, // used in the language switcher buttons below
        currentTerm,
        currentPhonetic,
        currentDefinition,
        currentExample
    } = useTermTranslation(term);
    const { toggleFavorite, isFavorite, favoritesRemaining } = useSRS();
    const { isAuthenticated } = useAuth();
    const { showToast } = useToast();
    const [isExpanded, setIsExpanded] = useState(showFullDetails);
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [showLimitWarning, setShowLimitWarning] = useState(false);

    const favorite = isFavorite(term.id);

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

    // Handle favorite toggle with limit check and toast
    const handleToggleFavorite = () => {
        const wasFavorite = favorite;
        const result = toggleFavorite(term.id);

        if (result.limitReached) {
            setShowLimitWarning(true);
            setTimeout(() => setShowLimitWarning(false), 5000);
            showToast(
                language === 'tr'
                    ? 'Favori limiti doldu! Giriş yaparak sınırsız ekleyin.'
                    : language === 'ru'
                        ? 'Лимит избранного! Войдите для неограниченного добавления.'
                        : 'Favorite limit reached! Sign in for unlimited.',
                'warning'
            );
        } else if (result.success) {
            showToast(
                wasFavorite
                    ? (language === 'tr' ? 'Favorilerden çıkarıldı' : language === 'ru' ? 'Удалено из избранного' : 'Removed from favorites')
                    : (language === 'tr' ? 'Favorilere eklendi ❤️' : language === 'ru' ? 'Добавлено в избранное ❤️' : 'Added to favorites ❤️'),
                wasFavorite ? 'info' : 'success'
            );
        }
    };

    return (
        <article aria-label={currentTerm} className="bg-white dark:bg-gray-800 rounded-2xl shadow-card hover:shadow-card-hover transition-all duration-300 overflow-hidden border border-gray-100 dark:border-gray-700">
            {/* Limit Warning */}
            {showLimitWarning && (
                <div className="bg-amber-50 dark:bg-amber-900/20 border-b border-amber-100 dark:border-amber-800 px-4 py-3 flex items-start gap-3 animate-fade-in">
                    <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                    <div>
                        <p className="text-sm text-amber-700 dark:text-amber-400">{t('card.favoriteLimit')}</p>
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
                        <h3 className="text-xl font-bold text-primary-500 dark:text-primary-300 mb-1">
                            {getTermByLang(language)}
                        </h3>
                        {currentPhonetic && (
                            <p className="text-sm text-gray-500 dark:text-gray-400 font-mono">
                                {currentPhonetic}
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
                            aria-label={`${t('card.listen')}: ${currentTerm}`}
                        >
                            <Volume2 className="w-5 h-5" aria-hidden="true" />
                        </button>

                        <button
                            onClick={handleToggleFavorite}
                            className={`p-2 rounded-full transition-all duration-200 ${favorite
                                ? 'bg-red-100 text-red-500'
                                : 'bg-gray-100 text-gray-400 hover:bg-red-50 hover:text-red-400'
                                }`}
                            title={favorite ? t('card.removeFavorite') : t('card.addFavorite')}
                            aria-label={`${favorite ? t('card.removeFavorite') : t('card.addFavorite')}: ${currentTerm}`}
                            aria-pressed={favorite}
                        >
                            <Heart className={`w-5 h-5 ${favorite ? 'fill-current' : ''}`} aria-hidden="true" />
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
                                className="inline-flex items-center gap-1 px-2 py-1 bg-gray-50 dark:bg-gray-700/50 rounded-lg text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors border border-gray-100 dark:border-gray-600"
                            >
                                <span className="text-xs opacity-60">{lang.toUpperCase()}</span>
                                <span className="font-medium">{getTermByLang(lang)}</span>
                            </button>
                        ))}
                </div>
            </div>

            {/* Definition - Always visible */}
            <div className="px-4 py-3 bg-gray-50 dark:bg-gray-700/30 border-t border-gray-100 dark:border-gray-700/50">
                <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                    {currentDefinition}
                </p>
            </div>

            {/* Expandable Section */}
            <div>
                <button
                    onClick={() => setIsExpanded(!isExpanded)}
                    className="w-full px-4 py-2 flex items-center justify-center gap-1 text-sm text-gray-500 dark:text-gray-400 hover:text-primary-500 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors"
                    aria-expanded={isExpanded}
                    aria-label={isExpanded ? (language === 'tr' ? 'Daha az göster' : 'Show less') : (language === 'tr' ? 'Örnek cümleyi göster' : 'Show example')}
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
                        <div className="p-3 bg-primary-50 dark:bg-primary-900/20 rounded-lg border border-primary-100 dark:border-primary-800/50">
                            <p className="text-sm text-primary-700 dark:text-primary-300 italic">
                                &quot;{currentExample}&quot;
                            </p>
                        </div>

                        {/* Analytics Preview (for academic purposes) */}
                        {term.times_reviewed > 0 && (
                            <div className="mt-3 flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
                                <span>{language === 'tr' ? 'Zorluk' : language === 'ru' ? 'Сложность' : 'Difficulty'}: {term.difficulty_score.toFixed(1)}/5</span>
                                <span>{language === 'tr' ? 'Başarı' : language === 'ru' ? 'Успех' : 'Success'}: %{Math.round(term.retention_rate * 100)}</span>
                                <span>{language === 'tr' ? 'Tekrar' : language === 'ru' ? 'Повторов' : 'Reviews'}: {term.times_reviewed}x</span>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </article>
    );
}
