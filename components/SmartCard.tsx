'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Term, Language } from '@/types';
import { useTermTranslation } from '@/hooks/useTermTranslation';
import { useSRS } from '@/contexts/SRSContext';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { speakText, isSpeechAvailable } from '@/utils/tts';
import { getMasteryLevel } from '@/utils/srsLogic';
import Link from 'next/link';
import { ContextTagList, MarketBadge } from '@/components/TermTaxonomy';
import { formatTranslation } from '@/lib/i18n';
import { logger } from '@/lib/logger';
import { fetchTermExplainResponse } from '@/lib/ai/client';
import { getAiUiCopy } from '@/lib/ai-copy';
import {
    createDefaultAiGuestTeaserUsage,
    getAiGuestTeaserUsage,
    getCachedTermExplainResponse,
    incrementAiGuestTeaserUsage,
    setCachedTermExplainResponse,
} from '@/utils/ai-session';
import type { AiExplainMode, AiTermExplainResponse } from '@/types/ai';
import {
    Volume2,
    Heart,
    BookOpen,
    Cpu,
    TrendingUp,
    ChevronDown,
    ChevronUp,
    AlertCircle,
    Sparkles,
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
    Fintech: 'bg-accent-100 text-accent-700 border-accent-200 dark:bg-amber-100 dark:text-amber-950 dark:border-amber-200',
    Finance: 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-100 dark:text-emerald-950 dark:border-emerald-200',
    Technology: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-100 dark:text-slate-900 dark:border-slate-200',
};

export default function SmartCard({ term, showFullDetails = false }: SmartCardProps) {
    const {
        language,
        t,
        getTermByLang, // used in the language switcher buttons below
        getPhoneticByLang,
        currentTerm,
        currentPhonetic,
        currentDefinition,
        currentExample
    } = useTermTranslation(term);
    const { toggleFavorite, isFavorite, isFavoriteUpdating, favoritesRemaining } = useSRS();
    const { entitlements, isAuthenticated, isLoading: isAuthLoading, requiresProfileCompletion } = useAuth();
    const { showToast } = useToast();
    const [isExpanded, setIsExpanded] = useState(showFullDetails);
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [showLimitWarning, setShowLimitWarning] = useState(false);
    const limitWarningTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const favorite = isFavorite(term.id);
    const isPending = isFavoriteUpdating(term.id);
    const isFavoriteActionDisabled = isPending || isAuthLoading;
    const favoriteLimitHref = requiresProfileCompletion ? '/profile?complete=1' : '/profile';
    const favoriteLimitActionLabel = requiresProfileCompletion ? t('profile.edit') : t('auth.login');
    const aiCopy = getAiUiCopy(language);
    const hasFullAiAccess = isAuthenticated && entitlements.canUseAdvancedAnalytics;
    const [isAiExplainOpen, setIsAiExplainOpen] = useState(false);
    const [aiExplainStatus, setAiExplainStatus] = useState<'idle' | 'loading' | 'ready' | 'locked' | 'error'>('idle');
    const [aiExplainError, setAiExplainError] = useState<string | null>(null);
    const [aiExplainMode, setAiExplainMode] = useState<AiExplainMode | null>(null);
    const [aiExplainResponse, setAiExplainResponse] = useState<AiTermExplainResponse | null>(null);
    const [guestAiUsage, setGuestAiUsage] = useState(createDefaultAiGuestTeaserUsage);

    useEffect(() => () => {
        if (limitWarningTimeoutRef.current) {
            clearTimeout(limitWarningTimeoutRef.current);
        }
    }, []);

    useEffect(() => {
        setGuestAiUsage(getAiGuestTeaserUsage());
    }, []);

    // Handle TTS
    const handleSpeak = async (text: string, lang: Language) => {
        if (!isSpeechAvailable()) return;

        setIsSpeaking(true);
        try {
            await speakText(text, lang);
        } catch (error) {
            logger.warn('SMART_CARD_TTS_FAILED', {
                route: 'SmartCard',
                error: error instanceof Error ? error : undefined,
                language: lang,
            });
        } finally {
            setIsSpeaking(false);
        }
    };

    // Handle favorite toggle with limit check and toast
    const handleToggleFavorite = async () => {
        if (isFavoriteActionDisabled) {
            return;
        }

        const result = await toggleFavorite(term.id);

        if (result.limitReached) {
            setShowLimitWarning(true);
            if (limitWarningTimeoutRef.current) {
                clearTimeout(limitWarningTimeoutRef.current);
            }
            limitWarningTimeoutRef.current = setTimeout(() => {
                setShowLimitWarning(false);
                limitWarningTimeoutRef.current = null;
            }, 5000);
            showToast(
                t('smartCard.favoriteLimitWarning'),
                'warning'
            );
            return;
        }

        if (!result.success) {
            showToast(
                result.error
                    || t('smartCard.favoriteUpdateError'),
                result.authExpired ? 'warning' : 'error'
            );
            return;
        }

        showToast(
            result.isFavorite
                ? t('smartCard.favoriteAdded')
                : t('smartCard.favoriteRemoved'),
            result.isFavorite ? 'success' : 'info'
        );
    };

    const handleAiExplain = async (mode: AiExplainMode) => {
        const cacheKey = `${term.id}:${language}:${mode}`;
        const cachedResponse = getCachedTermExplainResponse(cacheKey);

        setIsAiExplainOpen(true);
        setAiExplainMode(mode);
        setAiExplainError(null);

        if (cachedResponse) {
            setAiExplainResponse(cachedResponse);
            setAiExplainStatus('ready');
            return;
        }

        const canUseGuestTeaser = guestAiUsage.termExplainCount < 1;
        const shouldFetchExplanation = hasFullAiAccess || canUseGuestTeaser;

        if (!shouldFetchExplanation) {
            setAiExplainResponse(null);
            setAiExplainStatus('locked');
            return;
        }

        setAiExplainStatus('loading');
        setAiExplainResponse(null);

        try {
            const response = await fetchTermExplainResponse({
                termId: term.id,
                language,
                mode,
            });

            if (!hasFullAiAccess) {
                setGuestAiUsage(incrementAiGuestTeaserUsage('term-explain'));
            }

            setCachedTermExplainResponse(cacheKey, response);
            setAiExplainResponse(response);
            setAiExplainStatus('ready');
        } catch (error) {
            setAiExplainStatus('error');
            setAiExplainError(error instanceof Error ? error.message : aiCopy.genericError);
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
                            href={favoriteLimitHref}
                            className="text-sm font-medium text-primary-500 hover:underline"
                        >
                            {favoriteLimitActionLabel} →
                        </Link>
                    </div>
                </div>
            )}

            {/* Header */}
            <div className="p-4 pb-2">
                {/* Category Badge */}
                <div className="flex items-center justify-between gap-3 mb-3">
                    <div className="flex flex-wrap items-center gap-2">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${categoryColors[term.category]}`}>
                            {categoryIcons[term.category]}
                            {t(`categories.${term.category}`)}
                        </span>
                        <MarketBadge market={term.regional_market} />
                    </div>

                    {/* Mastery Level or Favorites Remaining */}
                    {term.times_reviewed > 0 ? (
                        <span className="text-xs text-gray-500 dark:text-gray-300">
                            {getMasteryLevel(term.srs_level, language)}
                        </span>
                    ) : !isAuthenticated && favoritesRemaining < 10 && (
                        <span className="text-xs text-amber-600 dark:text-amber-300">
                            {formatTranslation(t('smartCard.favoritesRemaining'), { count: favoritesRemaining })}
                        </span>
                    )}
                </div>

                {/* Primary term follows the selected UI language */}
                <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                        <h3 className="text-2xl font-bold text-primary-500 dark:text-primary-300 mb-1 leading-tight">
                            {currentTerm}
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
                            onClick={() => handleSpeak(currentTerm, language)}
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
                            disabled={isFavoriteActionDisabled}
                            data-testid="favorite-button"
                            className={`p-2 rounded-full transition-all duration-200 ${isFavoriteActionDisabled
                                ? 'bg-gray-100 text-gray-300 cursor-not-allowed'
                                : favorite
                                    ? 'bg-red-100 text-red-500'
                                    : 'bg-gray-100 text-gray-400 hover:bg-red-50 hover:text-red-400'
                                }`}
                            title={favorite ? t('card.removeFavorite') : t('card.addFavorite')}
                            aria-label={`${favorite ? t('card.removeFavorite') : t('card.addFavorite')}: ${currentTerm}`}
                            aria-pressed={favorite}
                        >
                            <Heart className={`w-5 h-5 ${favorite ? 'fill-current' : ''}`} aria-hidden="true" />
                        </button>

                        <button
                            onClick={() => setIsAiExplainOpen((value) => !value)}
                            className={`p-2 rounded-full transition-all duration-200 ${isAiExplainOpen
                                ? 'bg-primary-100 text-primary-600 dark:bg-primary-900/40 dark:text-primary-300'
                                : 'bg-gray-100 text-gray-500 hover:bg-primary-50 hover:text-primary-500 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
                                }`}
                            title={aiCopy.explainLabel}
                            aria-label={`${aiCopy.explainLabel}: ${currentTerm}`}
                        >
                            <Sparkles className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Secondary translations show the remaining languages */}
                <div className="mt-3 flex flex-wrap gap-2">
                    {(['tr', 'en', 'ru'] as Language[])
                        .filter((candidateLanguage) => candidateLanguage !== language)
                        .map((lang) => (
                        <button
                            key={lang}
                            onClick={() => handleSpeak(getTermByLang(lang), lang)}
                            className="inline-flex items-center gap-1 rounded-lg border border-gray-100 bg-gray-50 px-2 py-1 text-sm text-gray-500 transition-colors hover:bg-gray-100 dark:border-slate-500/70 dark:bg-slate-700 dark:text-slate-100 dark:hover:bg-slate-600"
                        >
                            <span className="text-xs opacity-60">{lang.toUpperCase()}</span>
                            <span className="font-medium">{getTermByLang(lang)}</span>
                        </button>
                    ))}
                </div>

                {!hasFullAiAccess ? (
                    <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50/90 px-4 py-3 text-sm text-slate-700 shadow-sm dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-200">
                        <p className="font-medium">{t('smartCard.aiPreviewHint')}</p>
                        <div className="mt-2 flex flex-wrap gap-2">
                            <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100">
                                {t('membership.items.aiFeedback')}
                            </span>
                            <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100">
                                {t('membership.items.studyCoach')}
                            </span>
                        </div>
                    </div>
                ) : null}

                {isAiExplainOpen ? (
                    <div className="mt-4 rounded-2xl border border-primary-100 bg-primary-50 p-4 dark:border-primary-900/40 dark:bg-primary-900/20">
                        <div className="flex flex-wrap gap-2">
                            {(['simple', 'example', 'language-bridge', 'importance'] as AiExplainMode[]).map((mode) => (
                                <button
                                    key={mode}
                                    type="button"
                                    onClick={() => void handleAiExplain(mode)}
                                    className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${aiExplainMode === mode
                                        ? 'bg-primary-500 text-white'
                                        : 'bg-white text-primary-600 hover:bg-primary-100 dark:bg-slate-800 dark:text-primary-200 dark:hover:bg-slate-700'
                                        }`}
                                >
                                    {aiCopy.explainModes[mode]}
                                </button>
                            ))}
                        </div>

                        {aiExplainStatus === 'loading' ? (
                            <p className="mt-3 text-sm text-gray-600 dark:text-gray-300">{aiCopy.explainLoading}</p>
                        ) : null}

                        {aiExplainStatus === 'locked' ? (
                            <div className="mt-3 space-y-3">
                                <p className="text-sm text-gray-600 dark:text-gray-300">{aiCopy.explainGuestLimit}</p>
                                <Link
                                    href={favoriteLimitHref}
                                    className="inline-flex items-center gap-2 rounded-xl bg-primary-500 px-4 py-2.5 font-semibold text-white transition-colors hover:bg-primary-600"
                                >
                                    <span>{favoriteLimitActionLabel}</span>
                                </Link>
                            </div>
                        ) : null}

                        {aiExplainStatus === 'error' && aiExplainError ? (
                            <p className="mt-3 text-sm text-red-600 dark:text-red-300">{aiExplainError}</p>
                        ) : null}

                        {aiExplainStatus === 'ready' && aiExplainResponse ? (
                            <div className="mt-4 space-y-3 text-sm leading-6 text-gray-700 dark:text-gray-200">
                                <div>
                                    <p className="font-semibold text-gray-900 dark:text-white">{aiExplainResponse.title}</p>
                                    <p>{aiExplainResponse.summary}</p>
                                </div>
                                <ul className="space-y-2">
                                    {aiExplainResponse.keyPoints.map((point) => (
                                        <li key={point} className="rounded-xl bg-white/80 px-3 py-2 dark:bg-slate-800/80">
                                            {point}
                                        </li>
                                    ))}
                                </ul>
                                <div>
                                    <p className="font-semibold text-gray-900 dark:text-white">{aiCopy.memoryHook}</p>
                                    <p>{aiExplainResponse.memoryHook}</p>
                                </div>
                            </div>
                        ) : null}
                    </div>
                ) : null}
            </div>

            {/* Definition - Always visible */}
            <div className="px-4 py-3 bg-gray-50 dark:bg-gray-700/30 border-t border-gray-100 dark:border-gray-700/50">
                <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                    {currentDefinition}
                </p>
                <ContextTagList
                    contextTags={term.context_tags}
                    maxItems={showFullDetails ? 8 : 4}
                    className="mt-3"
                />
            </div>

            {/* Expandable Section */}
            <div>
                <button
                    onClick={() => setIsExpanded(!isExpanded)}
                    className="w-full px-4 py-2 flex items-center justify-center gap-1 text-sm text-gray-500 dark:text-gray-400 hover:text-primary-500 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors"
                    aria-expanded={isExpanded}
                    aria-label={isExpanded ? t('smartCard.showLess') : t('smartCard.showExampleSentence')}
                >
                    {isExpanded ? (
                        <>
                            <ChevronUp className="w-4 h-4" />
                            <span>{t('smartCard.less')}</span>
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
                        <div className="p-3 bg-primary-50 dark:bg-gray-700/60 rounded-lg border border-primary-100 dark:border-gray-600">
                            <p className="text-sm text-primary-700 dark:text-gray-200 italic">
                                &quot;{currentExample}&quot;
                            </p>
                        </div>

                        {/* Analytics Preview (for academic purposes) */}
                        {term.times_reviewed > 0 && (
                            <div className="mt-3 flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
                                <span>{t('smartCard.difficulty')}: {term.difficulty_score.toFixed(1)}/5</span>
                                <span>{t('smartCard.success')}: %{Math.round(term.retention_rate * 100)}</span>
                                <span>{t('smartCard.reviews')}: {term.times_reviewed}x</span>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </article>
    );
}
