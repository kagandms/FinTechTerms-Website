'use client';

import React, { useState, useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useSRS } from '@/contexts/SRSContext';
import QuizCard from '@/components/QuizCard';
import { Language } from '@/types';
import Link from 'next/link';
import { Trophy, ArrowRight, Heart, Sparkles } from 'lucide-react';

export default function QuizPage() {
    const { t, language } = useLanguage();
    const { dueTerms, submitQuizAnswer, stats } = useSRS();

    const [currentIndex, setCurrentIndex] = useState(0);
    const [correctCount, setCorrectCount] = useState(0);
    const [isComplete, setIsComplete] = useState(false);
    const [sessionTerms, setSessionTerms] = useState(dueTerms);

    // Determine question and answer languages
    // Question in user's language, answer in others randomly
    const getLanguages = (): { question: Language; answer: Language } => {
        const others: Language[] = (['tr', 'en', 'ru'] as Language[]).filter(l => l !== language);
        const randomOther = others[Math.floor(Math.random() * others.length)] ?? 'en';
        return { question: language, answer: randomOther };
    };

    const [languages] = useState(getLanguages);

    // Initialize session terms
    useEffect(() => {
        setSessionTerms(dueTerms);
    }, [dueTerms]);

    const currentTerm = sessionTerms[currentIndex];

    const handleAnswer = (isCorrect: boolean) => {
        if (!currentTerm) return;

        // Submit to SRS system
        submitQuizAnswer(currentTerm.id, isCorrect);

        if (isCorrect) {
            setCorrectCount(c => c + 1);
        }

        // Move to next or complete
        if (currentIndex + 1 >= sessionTerms.length) {
            setIsComplete(true);
        } else {
            setCurrentIndex(i => i + 1);
        }
    };

    // No cards due
    if (sessionTerms.length === 0 && !isComplete) {
        return (
            <div className="page-content px-4 py-6">
                <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
                    <div className="p-4 bg-primary-100 rounded-full mb-4">
                        <Heart className="w-10 h-10 text-primary-500" />
                    </div>
                    <h2 className="text-xl font-bold text-gray-900 mb-2">
                        {t('quiz.noCards')}
                    </h2>
                    <p className="text-gray-500 mb-6 max-w-xs">
                        {t('home.addToFavorites')}
                    </p>
                    <Link
                        href="/search"
                        className="inline-flex items-center gap-2 bg-primary-500 text-white px-6 py-3 rounded-xl font-semibold hover:bg-primary-600 transition-colors"
                    >
                        <span>Kelime Keşfet</span>
                        <ArrowRight className="w-5 h-5" />
                    </Link>
                </div>
            </div>
        );
    }

    // Quiz complete
    if (isComplete) {
        const accuracy = Math.round((correctCount / sessionTerms.length) * 100);

        return (
            <div className="page-content px-4 py-6">
                <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
                    <div className="p-4 bg-accent-100 rounded-full mb-4 animate-pulse-soft">
                        <Trophy className="w-12 h-12 text-accent-500" />
                    </div>

                    <h2 className="text-2xl font-bold text-gray-900 mb-2">
                        {t('quiz.complete')}
                    </h2>

                    <div className="bg-white rounded-2xl p-6 shadow-card w-full max-w-sm mt-4 mb-6">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="text-center">
                                <p className="text-3xl font-bold text-green-500">{correctCount}</p>
                                <p className="text-sm text-gray-500">{t('quiz.knew')}</p>
                            </div>
                            <div className="text-center">
                                <p className="text-3xl font-bold text-red-500">{sessionTerms.length - correctCount}</p>
                                <p className="text-sm text-gray-500">{t('quiz.didntKnow')}</p>
                            </div>
                        </div>

                        <div className="mt-4 pt-4 border-t border-gray-100">
                            <div className="flex items-center justify-center gap-2">
                                <Sparkles className="w-5 h-5 text-accent-500" />
                                <span className="text-2xl font-bold text-gray-900">%{accuracy}</span>
                                <span className="text-gray-500">{t('profile.accuracy')}</span>
                            </div>
                        </div>
                    </div>

                    <Link
                        href="/"
                        className="inline-flex items-center gap-2 bg-primary-500 text-white px-6 py-3 rounded-xl font-semibold hover:bg-primary-600 transition-colors"
                    >
                        <span>{t('common.home')}</span>
                        <ArrowRight className="w-5 h-5" />
                    </Link>
                </div>
            </div>
        );
    }

    // Active quiz
    return (
        <div className="page-content px-4 py-6">
            {/* Header */}
            <header className="mb-6">
                <div className="flex items-center justify-between mb-2">
                    <h1 className="text-xl font-bold text-gray-900">
                        {t('quiz.title')}
                    </h1>
                    <span className="text-sm text-gray-500">
                        {currentIndex + 1} / {sessionTerms.length}
                    </span>
                </div>

                {/* Progress Bar */}
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                        className="progress-bar h-full rounded-full"
                        style={{ width: `${((currentIndex) / sessionTerms.length) * 100}%` }}
                    />
                </div>
            </header>

            {/* Quiz Card */}
            {currentTerm && (
                <QuizCard
                    term={currentTerm}
                    onAnswer={handleAnswer}
                    questionLanguage={languages.question}
                    answerLanguage={languages.answer}
                />
            )}

            {/* Correct Streak */}
            {correctCount > 0 && (
                <div className="mt-6 flex items-center justify-center gap-2 text-green-600">
                    <Sparkles className="w-5 h-5" />
                    <span className="font-medium">
                        {t('quiz.correctStreak')}: {correctCount}
                    </span>
                </div>
            )}
        </div>
    );
}
