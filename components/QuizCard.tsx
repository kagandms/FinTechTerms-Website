'use client';

import React, { useState } from 'react';
import { Term, Language } from '@/types';
import { useLanguage } from '@/contexts/LanguageContext';
import { speakText, isSpeechAvailable } from '@/utils/tts';
import { getIntervalDescription } from '@/utils/srsLogic';
import { Volume2, Check, X, RotateCcw } from 'lucide-react';

interface QuizCardProps {
    term: Term;
    onAnswer: (isCorrect: boolean) => void;
}

export default function QuizCard({ term, onAnswer }: QuizCardProps) {
    const { t, language } = useLanguage();
    const [isFlipped, setIsFlipped] = useState(false);
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [selectedLang, setSelectedLang] = useState<Language>(language);

    // Get term in specified language
    const getTermByLang = (lang: Language): string => {
        const terms: Record<Language, string> = {
            tr: term.term_tr,
            en: term.term_en,
            ru: term.term_ru,
        };
        return terms[lang];
    };

    // Get definition in specified language
    const getDefinitionByLang = (lang: Language): string => {
        const defs: Record<Language, string> = {
            tr: term.definition_tr,
            en: term.definition_en,
            ru: term.definition_ru,
        };
        return defs[lang];
    };

    // Get phonetic (pronunciation) in specified language
    const getPhoneticByLang = (lang: Language): string | undefined => {
        const phonetics: Record<Language, string | undefined> = {
            tr: term.phonetic_tr,
            en: term.phonetic_en,
            ru: term.phonetic_ru,
        };
        return phonetics[lang];
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

    // Handle language selection on back side
    const handleSelectLang = (lang: Language) => {
        setSelectedLang(lang);
    };

    // Get current language term
    const currentTerm = getTermByLang(language);

    // All languages for display
    const allLanguages: Language[] = ['tr', 'en', 'ru'];

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
                    <div className="flex items-center justify-between mb-4">
                        <span className="px-3 py-1 bg-gray-100 rounded-full text-xs font-medium text-gray-600 uppercase">
                            {language}
                        </span>

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
                            onClick={() => setIsFlipped(true)}
                            className="w-full py-4 bg-primary-500 text-white font-semibold rounded-2xl hover:bg-primary-600 transition-colors shadow-md"
                        >
                            {t('quiz.showAnswer')}
                        </button>
                    </div>
                </div>

                {/* Answer Side */}
                <div className={`p-6 h-full flex flex-col ${!isFlipped ? 'hidden' : ''}`}>
                    {/* Language Badge - shows selected language */}
                    <div className="flex items-center justify-between mb-4">
                        <span className="px-3 py-1 bg-primary-100 rounded-full text-xs font-medium text-primary-600 uppercase">
                            {selectedLang}
                        </span>

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
                            <p className="text-xs text-gray-400 mb-2">{t('card.listen')} / {language === 'tr' ? 'Dili Değiştir' : language === 'ru' ? 'Сменить язык' : 'Change Language'}</p>
                            {allLanguages.map(lang => (
                                <button
                                    key={lang}
                                    onClick={() => handleSelectLang(lang)}
                                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg transition-all ${lang === selectedLang
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
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleSpeak(getTermByLang(lang), lang);
                                        }}
                                        className="p-1 text-gray-400 hover:text-primary-500 transition-colors"
                                    >
                                        <Volume2 className="w-4 h-4" />
                                    </button>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Next Review Info */}
                    <p className="text-center text-xs text-gray-400 mb-4 mt-3">
                        {t('quiz.nextReview')}: {getIntervalDescription(term.srs_level + 1, language)} (✓) / 1 {t('common.day')} (✗)
                    </p>

                    {/* Answer Buttons */}
                    <div className="flex gap-3">
                        <button
                            onClick={() => onAnswer(false)}
                            className="flex-1 flex items-center justify-center gap-2 py-4 bg-red-500 text-white font-semibold rounded-2xl hover:bg-red-600 transition-colors shadow-md"
                        >
                            <X className="w-5 h-5" />
                            <span>{t('quiz.didntKnow')}</span>
                        </button>

                        <button
                            onClick={() => onAnswer(true)}
                            className="flex-1 flex items-center justify-center gap-2 py-4 bg-green-500 text-white font-semibold rounded-2xl hover:bg-green-600 transition-colors shadow-md"
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
                    className="mt-4 mx-auto flex items-center gap-2 text-gray-500 hover:text-gray-700 transition-colors"
                >
                    <RotateCcw className="w-4 h-4" />
                    <span className="text-sm">{t('quiz.flipCard')}</span>
                </button>
            )}
        </div>
    );
}
