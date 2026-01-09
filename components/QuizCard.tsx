'use client';

import React, { useState } from 'react';
import { Term, Language } from '@/types';
import { useLanguage } from '@/contexts/LanguageContext';
import { useSRS } from '@/contexts/SRSContext';
import { speakText, isSpeechAvailable } from '@/utils/tts';
import { getIntervalDescription } from '@/utils/srsLogic';
import { Volume2, Check, X, RotateCcw } from 'lucide-react';

interface QuizCardProps {
    term: Term;
    onAnswer: (isCorrect: boolean) => void;
    questionLanguage: Language;
    answerLanguage: Language;
}

export default function QuizCard({
    term,
    onAnswer,
    questionLanguage,
    answerLanguage
}: QuizCardProps) {
    const { t, language } = useLanguage();
    const [isFlipped, setIsFlipped] = useState(false);
    const [isSpeaking, setIsSpeaking] = useState(false);

    // Get term in specified language
    const getTermByLang = (lang: Language): string => {
        const terms: Record<Language, string> = {
            tr: term.term_tr,
            en: term.term_en,
            ru: term.term_ru,
        };
        return terms[lang];
    };

    // Get definition
    const getDefinition = (lang: Language): string => {
        const defs: Record<Language, string> = {
            tr: term.definition_tr,
            en: term.definition_en,
            ru: term.definition_ru,
        };
        return defs[lang];
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

    // Handle answer
    const handleAnswer = (isCorrect: boolean) => {
        onAnswer(isCorrect);
    };

    const questionTerm = getTermByLang(questionLanguage);
    const answerTerm = getTermByLang(answerLanguage);

    return (
        <div className="w-full max-w-md mx-auto">
            {/* Card */}
            <div
                className={`relative min-h-[320px] bg-white rounded-3xl shadow-card overflow-hidden transition-all duration-500 ${isFlipped ? 'bg-gradient-to-br from-primary-50 to-white' : ''
                    }`}
            >
                {/* Question Side */}
                <div className={`p-6 h-full flex flex-col ${isFlipped ? 'hidden' : ''}`}>
                    {/* Language Badge */}
                    <div className="flex items-center justify-between mb-4">
                        <span className="px-3 py-1 bg-gray-100 rounded-full text-xs font-medium text-gray-600 uppercase">
                            {questionLanguage}
                        </span>

                        <button
                            onClick={() => handleSpeak(questionTerm, questionLanguage)}
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
                    <div className="flex-1 flex items-center justify-center">
                        <h2 className="text-3xl font-bold text-primary-600 text-center">
                            {questionTerm}
                        </h2>
                    </div>

                    {/* Show Answer Button */}
                    <button
                        onClick={() => setIsFlipped(true)}
                        className="w-full py-4 bg-primary-500 text-white font-semibold rounded-2xl hover:bg-primary-600 transition-colors shadow-md"
                    >
                        {t('quiz.showAnswer')}
                    </button>
                </div>

                {/* Answer Side */}
                <div className={`p-6 h-full flex flex-col ${!isFlipped ? 'hidden' : ''}`}>
                    {/* Language Badge */}
                    <div className="flex items-center justify-between mb-4">
                        <span className="px-3 py-1 bg-primary-100 rounded-full text-xs font-medium text-primary-600 uppercase">
                            {answerLanguage}
                        </span>

                        <button
                            onClick={() => handleSpeak(answerTerm, answerLanguage)}
                            disabled={isSpeaking}
                            className={`p-2 rounded-full transition-all ${isSpeaking
                                    ? 'bg-accent-100 text-accent-600 animate-pulse-soft'
                                    : 'bg-gray-100 text-gray-600 hover:bg-accent-100 hover:text-accent-600'
                                }`}
                        >
                            <Volume2 className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Answer */}
                    <div className="flex-1 flex flex-col items-center justify-center text-center">
                        <h2 className="text-3xl font-bold text-primary-600 mb-3">
                            {answerTerm}
                        </h2>
                        <p className="text-gray-600 text-sm leading-relaxed">
                            {getDefinition(answerLanguage)}
                        </p>
                    </div>

                    {/* Next Review Info */}
                    <p className="text-center text-xs text-gray-400 mb-4">
                        {t('quiz.nextReview')}: {getIntervalDescription(term.srs_level + 1, language)} (✓) / 1 gün (✗)
                    </p>

                    {/* Answer Buttons */}
                    <div className="flex gap-3">
                        <button
                            onClick={() => handleAnswer(false)}
                            className="flex-1 flex items-center justify-center gap-2 py-4 bg-red-500 text-white font-semibold rounded-2xl hover:bg-red-600 transition-colors shadow-md"
                        >
                            <X className="w-5 h-5" />
                            <span>{t('quiz.didntKnow')}</span>
                        </button>

                        <button
                            onClick={() => handleAnswer(true)}
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
                    <span className="text-sm">Kartı Çevir</span>
                </button>
            )}
        </div>
    );
}
