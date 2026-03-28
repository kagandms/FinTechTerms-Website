'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Term, Language } from '@/types';
import { useTermTranslation } from '@/hooks/useTermTranslation';
import { ContextTagList, MarketBadge } from '@/components/TermTaxonomy';
import { getContextTagLabels } from '@/lib/termTaxonomy';
import { speakText, isSpeechAvailable } from '@/utils/tts';
import { getIntervalDescription } from '@/utils/srsLogic';
import { useResponseTimer } from '@/hooks/useResponseTimer';
import { logger } from '@/lib/logger';
import { Volume2, Check, X, RotateCcw } from 'lucide-react';
import type { QuizAnswerRequest, QuizAnswerResult } from '@/components/quiz-answer-types';

interface QuizCardProps {
    term: Term;
    onAnswer: (answer: QuizAnswerRequest) => Promise<QuizAnswerResult | void> | QuizAnswerResult | void;
    isPending?: boolean;
}

export default function QuizCard({ term, onAnswer, isPending = false }: QuizCardProps) {
    const {
        t,
        language,
        getTermByLang,
        getDefinitionByLang,
        getPhoneticByLang,
        currentTerm
    } = useTermTranslation(term);

    const [isFlipped, setIsFlipped] = useState(false);
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [selectedLang, setSelectedLang] = useState<Language>(language);

    // Timer hook for academic research
    const { startTimer, stopTimer } = useResponseTimer();
    const [recallTime, setRecallTime] = useState(0);
    const [isAnswerLocked, setIsAnswerLocked] = useState(false);
    const submittingRef = useRef(false);

    // Start timer on mount
    useEffect(() => {
        startTimer();
    }, [startTimer]);

    useEffect(() => {
        if (!isPending && submittingRef.current) {
            submittingRef.current = false;
            setIsAnswerLocked(false);
        }
    }, [isPending]);

    const handleFlip = () => {
        if (isPending || isAnswerLocked || isFlipped) return;
        const time = stopTimer();
        setRecallTime(time);
        setIsFlipped(true);
    };

    const handleAnswerClick = (isCorrect: boolean) => {
        if (isPending || isAnswerLocked || submittingRef.current) {
            return;
        }

        submittingRef.current = true;
        setIsAnswerLocked(true);

        void Promise.resolve(onAnswer({
            isCorrect,
            responseTimeMs: recallTime,
        }))
            .then((result) => {
                if (!result?.keepLocked) {
                    submittingRef.current = false;
                    setIsAnswerLocked(false);
                }
            })
            .catch(() => {
                submittingRef.current = false;
                setIsAnswerLocked(false);
            });
    };

    // Handle TTS
    const handleSpeak = async (text: string, lang: Language) => {
        if (!isSpeechAvailable()) return;

        setIsSpeaking(true);
        try {
            await speakText(text, lang);
        } catch (error) {
            logger.warn('QUIZ_CARD_TTS_FAILED', {
                route: 'QuizCard',
                error: error instanceof Error ? error : undefined,
                language: lang,
            });
        } finally {
            setIsSpeaking(false);
        }
    };

    // Handle language selection on back side
    const handleSelectLang = (lang: Language) => {
        setSelectedLang(lang);
    };

    // currentTerm is provided by useTermTranslation hook

    // All languages for display
    const allLanguages: Language[] = ['ru', 'en', 'tr'];
    const taxonomyLabels = getContextTagLabels(term.context_tags);
    const pendingLabel = t('quiz.saving');
    const controlsDisabled = isPending || isAnswerLocked;

    return (
        <div className="w-full max-w-md mx-auto">
            {/* Card */}
            <div
                className={`relative min-h-[380px] bg-white rounded-3xl shadow-card overflow-hidden transition-all duration-500 ${isFlipped ? 'bg-gradient-to-br from-primary-50 to-white' : ''
                    }`}
            >
                {/* Question Side */}
                <div className={`p-6 h-full flex flex-col ${isFlipped ? 'hidden' : ''}`}>
                    {/* Language Badge */}
                    <div className="flex items-center justify-between gap-3 mb-4">
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="px-3 py-1 bg-gray-100 rounded-full text-xs font-medium text-gray-600 uppercase">
                                {language}
                            </span>
                            <MarketBadge market={term.regional_market} />
                        </div>

                        <button
                            onClick={() => handleSpeak(currentTerm, language)}
                            disabled={isSpeaking}
                            className={`p-2 rounded-full transition-all ${isSpeaking
                                ? 'bg-accent-100 text-accent-600 animate-pulse-soft'
                                : 'bg-gray-100 text-gray-600 hover:bg-accent-100 hover:text-accent-600'
                                }`}
                        >
                            <Volume2 className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Question Term */}
                    <div className="flex-1 flex flex-col items-center justify-center py-8">
                        <h2 className="text-3xl font-bold text-primary-600 text-center">
                            {currentTerm}
                        </h2>
                        {getPhoneticByLang(language) && (
                            <p className="text-sm text-gray-500 font-mono mt-1">
                                {getPhoneticByLang(language)}
                            </p>
                        )}
                    </div>

                    {/* Show Answer Button - with more spacing */}
                    <div className="mt-6">
                        <button
                            onClick={handleFlip}
                            disabled={controlsDisabled}
                            className={`w-full py-4 text-white font-semibold rounded-2xl transition-colors shadow-md ${controlsDisabled
                                ? 'bg-primary-300 cursor-not-allowed'
                                : 'bg-primary-500 hover:bg-primary-600'
                                }`}
                        >
                            {controlsDisabled ? pendingLabel : t('quiz.showAnswer')}
                        </button>
                    </div>
                </div>

                {/* Answer Side */}
                <div className={`p-6 h-full flex flex-col ${!isFlipped ? 'hidden' : ''}`}>
                    {/* Language Badge - shows selected language */}
                    <div className="flex items-center justify-between gap-3 mb-4">
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="px-3 py-1 bg-primary-100 rounded-full text-xs font-medium text-primary-600 uppercase">
                                {selectedLang}
                            </span>
                            <MarketBadge market={term.regional_market} />
                        </div>

                        <button
                            onClick={() => handleSpeak(getTermByLang(selectedLang), selectedLang)}
                            disabled={isSpeaking}
                            className={`p-2 rounded-full transition-all ${isSpeaking
                                ? 'bg-accent-100 text-accent-600 animate-pulse-soft'
                                : 'bg-gray-100 text-gray-600 hover:bg-accent-100 hover:text-accent-600'
                                }`}
                        >
                            <Volume2 className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Answer - Main Term in selected language */}
                    <div className="flex-1 flex flex-col items-center justify-center text-center">
                        <h2 className="text-3xl font-bold text-primary-600 mb-1">
                            {getTermByLang(selectedLang)}
                        </h2>
                        {getPhoneticByLang(selectedLang) && (
                            <p className="text-sm text-gray-500 font-mono mb-3">
                                {getPhoneticByLang(selectedLang)}
                            </p>
                        )}

                        {/* Definition in SELECTED language - dynamically changes */}
                        <p className="text-gray-600 text-sm leading-relaxed mb-4 min-h-[60px]">
                            {getDefinitionByLang(selectedLang)}
                        </p>

                        {/* All 3 languages - clickable */}
                        <div className="w-full bg-gray-50 rounded-xl p-3 space-y-2">
                            <p className="text-xs text-gray-400 mb-2">{t('card.listen')} / {t('quiz.changeLanguage')}</p>
                            {allLanguages.map(lang => (
                                <div
                                    key={lang}
                                    role="button"
                                    tabIndex={0}
                                    onClick={() => handleSelectLang(lang)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' || e.key === ' ') {
                                            handleSelectLang(lang);
                                        }
                                    }}
                                    className={`w-full flex items-center cursor-pointer justify-between px-3 py-2 rounded-lg transition-all ${lang === selectedLang
                                        ? 'bg-primary-100 ring-2 ring-primary-300'
                                        : 'bg-white hover:bg-gray-100'
                                        }`}
                                >
                                    <span className="text-xs font-semibold text-gray-500 uppercase w-8">
                                        {lang}
                                    </span>
                                    <span className={`font-medium flex-1 text-left ${lang === selectedLang ? 'text-primary-600' : 'text-gray-700'}`}>
                                        {getTermByLang(lang)}
                                    </span>
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleSpeak(getTermByLang(lang), lang);
                                        }}
                                        className="p-1 text-gray-400 hover:text-primary-500 transition-colors"
                                    >
                                        <Volume2 className="w-4 h-4" />
                                    </button>
                                </div>
                            ))}
                        </div>

                        {taxonomyLabels.length > 0 ? (
                            <div className="w-full mt-4">
                                <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-gray-400">
                                    {t('taxonomy.context')}
                                </p>
                                <ContextTagList contextTags={term.context_tags} maxItems={4} />
                            </div>
                        ) : null}
                    </div>

                    {/* Next Review Info */}
                    <p className="text-center text-xs text-gray-400 mb-4 mt-3">
                        {t('quiz.nextReview')}: {getIntervalDescription(term.srs_level + 1, language)} (✓) / 1 {t('common.day')} (✗)
                    </p>

                    {/* Answer Buttons */}
                    <div className="flex gap-3">
                        <button
                            onClick={() => handleAnswerClick(false)}
                            disabled={controlsDisabled}
                            data-testid="quiz-answer-btn"
                            className={`flex-1 flex items-center justify-center gap-2 py-4 text-white font-semibold rounded-2xl transition-colors shadow-md ${controlsDisabled
                                ? 'bg-red-300 cursor-not-allowed'
                                : 'bg-red-500 hover:bg-red-600'
                                }`}
                        >
                            <X className="w-5 h-5" />
                            <span>{t('quiz.didntKnow')}</span>
                        </button>

                        <button
                            onClick={() => handleAnswerClick(true)}
                            disabled={controlsDisabled}
                            data-testid="quiz-answer-btn"
                            className={`flex-1 flex items-center justify-center gap-2 py-4 text-white font-semibold rounded-2xl transition-colors shadow-md ${controlsDisabled
                                ? 'bg-green-300 cursor-not-allowed'
                                : 'bg-green-500 hover:bg-green-600'
                                }`}
                        >
                            <Check className="w-5 h-5" />
                            <span>{t('quiz.knew')}</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* Flip Back Button */}
            {isFlipped && (
                <button
                    onClick={() => setIsFlipped(false)}
                    disabled={controlsDisabled}
                    className={`mt-4 mx-auto flex items-center gap-2 transition-colors ${controlsDisabled
                        ? 'text-gray-300 cursor-not-allowed'
                        : 'text-gray-500 hover:text-gray-700'
                        }`}
                >
                    <RotateCcw className="w-4 h-4" />
                    <span className="text-sm">{t('quiz.flipCard')}</span>
                </button>
            )}
        </div>
    );
}
