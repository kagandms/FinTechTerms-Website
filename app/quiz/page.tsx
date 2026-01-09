'use client';

import React, { useState, useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useSRS } from '@/contexts/SRSContext';
import QuizCard from '@/components/QuizCard';
import Link from 'next/link';
import { Trophy, ArrowRight, Heart, Sparkles, Flame, Zap, BookOpen, Star, Target } from 'lucide-react';

export default function QuizPage() {
    const { t } = useLanguage();
    const { dueTerms, submitQuizAnswer, stats, terms, favoriteTerms } = useSRS();

    const [currentIndex, setCurrentIndex] = useState(0);
    const [correctCount, setCorrectCount] = useState(0);
    const [isComplete, setIsComplete] = useState(false);
    const [sessionTerms, setSessionTerms] = useState(dueTerms);
    const [isQuickQuiz, setIsQuickQuiz] = useState(false);

    // Initialize session terms
    useEffect(() => {
        if (!isQuickQuiz) {
            setSessionTerms(dueTerms);
        }
    }, [dueTerms, isQuickQuiz]);

    const currentTerm = sessionTerms[currentIndex];

    // Start quick quiz with random 5 words
    const startQuickQuiz = () => {
        const shuffled = [...terms].sort(() => Math.random() - 0.5);
        const quizTerms = shuffled.slice(0, 5);
        setSessionTerms(quizTerms);
        setCurrentIndex(0);
        setCorrectCount(0);
        setIsComplete(false);
        setIsQuickQuiz(true);
    };

    const handleAnswer = (isCorrect: boolean) => {
        if (!currentTerm) return;

        // Submit to SRS system (only for actual favorites, not quick quiz)
        if (!isQuickQuiz) {
            submitQuizAnswer(currentTerm.id, isCorrect);
        }

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

    // Reset to normal mode
    const resetToNormal = () => {
        setIsQuickQuiz(false);
        setSessionTerms(dueTerms);
        setCurrentIndex(0);
        setCorrectCount(0);
        setIsComplete(false);
    };

    // Calculate stats
    const masteredCount = terms.filter(t => t.srs_level >= 4).length;
    const learningCount = terms.filter(t => t.srs_level > 0 && t.srs_level < 4).length;

    // No cards due - Enhanced empty state
    if (sessionTerms.length === 0 && !isComplete && !isQuickQuiz) {
        return (
            <div className="page-content px-4 py-6">
                {/* Header */}
                <header className="mb-6">
                    <h1 className="text-2xl font-bold text-gray-900">{t('quiz.title')}</h1>
                </header>

                {/* Daily Streak Card */}
                <div className="bg-gradient-to-r from-orange-500 to-amber-500 rounded-2xl p-5 text-white mb-6 shadow-lg">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="p-3 bg-white/20 rounded-full">
                                <Flame className="w-8 h-8" />
                            </div>
                            <div>
                                <p className="text-white/80 text-sm">{t('quiz.dailyStreak')}</p>
                                <p className="text-3xl font-bold">{stats.streak} {t('quiz.days')}</p>
                            </div>
                        </div>
                        {stats.streak > 0 && (
                            <div className="text-right">
                                <p className="text-white/80 text-sm">🔥</p>
                                <p className="text-sm font-medium">{t('quiz.keepItUp')}</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Quick Quiz Card */}
                <div className="bg-gradient-to-r from-primary-500 to-blue-500 rounded-2xl p-5 text-white mb-6 shadow-lg">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="p-3 bg-white/20 rounded-full">
                            <Zap className="w-6 h-6" />
                        </div>
                        <div>
                            <p className="font-bold text-lg">{t('quiz.quickQuiz')}</p>
                            <p className="text-white/80 text-sm">{t('quiz.quickQuizDesc')}</p>
                        </div>
                    </div>
                    <button
                        onClick={startQuickQuiz}
                        className="w-full py-3 bg-white text-primary-600 font-semibold rounded-xl hover:bg-gray-100 transition-colors"
                    >
                        {t('quiz.startQuickQuiz')}
                    </button>
                </div>

                {/* Statistics */}
                <div className="bg-white rounded-2xl p-5 shadow-card mb-6">
                    <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                        <Target className="w-5 h-5 text-primary-500" />
                        {t('quiz.yourStats')}
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-gray-50 rounded-xl p-4 text-center">
                            <BookOpen className="w-6 h-6 text-blue-500 mx-auto mb-2" />
                            <p className="text-2xl font-bold text-gray-900">{terms.length}</p>
                            <p className="text-xs text-gray-500">{t('quiz.totalWords')}</p>
                        </div>
                        <div className="bg-gray-50 rounded-xl p-4 text-center">
                            <Star className="w-6 h-6 text-amber-500 mx-auto mb-2" />
                            <p className="text-2xl font-bold text-gray-900">{masteredCount}</p>
                            <p className="text-xs text-gray-500">{t('quiz.mastered')}</p>
                        </div>
                        <div className="bg-gray-50 rounded-xl p-4 text-center">
                            <Sparkles className="w-6 h-6 text-purple-500 mx-auto mb-2" />
                            <p className="text-2xl font-bold text-gray-900">{learningCount}</p>
                            <p className="text-xs text-gray-500">{t('quiz.learning')}</p>
                        </div>
                        <div className="bg-gray-50 rounded-xl p-4 text-center">
                            <Heart className="w-6 h-6 text-red-500 mx-auto mb-2" />
                            <p className="text-2xl font-bold text-gray-900">{favoriteTerms.length}</p>
                            <p className="text-xs text-gray-500">{t('quiz.favorites')}</p>
                        </div>
                    </div>
                </div>

                {/* Add Favorites CTA */}
                <div className="text-center">
                    <p className="text-gray-500 text-sm mb-3">{t('quiz.orAddFavorites')}</p>
                    <Link
                        href="/search"
                        className="inline-flex items-center gap-2 text-primary-500 font-medium hover:underline"
                    >
                        <span>{t('quiz.exploreWords')}</span>
                        <ArrowRight className="w-4 h-4" />
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

                    {isQuickQuiz && (
                        <p className="text-primary-500 font-medium mb-2">{t('quiz.quickQuiz')}</p>
                    )}

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

                    <div className="flex gap-3">
                        {isQuickQuiz ? (
                            <>
                                <button
                                    onClick={startQuickQuiz}
                                    className="inline-flex items-center gap-2 bg-primary-500 text-white px-6 py-3 rounded-xl font-semibold hover:bg-primary-600 transition-colors"
                                >
                                    <Zap className="w-5 h-5" />
                                    <span>{t('quiz.quickQuiz')}</span>
                                </button>
                                <button
                                    onClick={resetToNormal}
                                    className="inline-flex items-center gap-2 bg-gray-100 text-gray-700 px-6 py-3 rounded-xl font-semibold hover:bg-gray-200 transition-colors"
                                >
                                    <span>{t('common.home')}</span>
                                </button>
                            </>
                        ) : (
                            <Link
                                href="/"
                                className="inline-flex items-center gap-2 bg-primary-500 text-white px-6 py-3 rounded-xl font-semibold hover:bg-primary-600 transition-colors"
                            >
                                <span>{t('common.home')}</span>
                                <ArrowRight className="w-5 h-5" />
                            </Link>
                        )}
                    </div>
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
                    <div className="flex items-center gap-2">
                        <h1 className="text-xl font-bold text-gray-900">
                            {t('quiz.title')}
                        </h1>
                        {isQuickQuiz && (
                            <span className="px-2 py-0.5 bg-primary-100 text-primary-600 text-xs font-medium rounded-full flex items-center gap-1">
                                <Zap className="w-3 h-3" />
                                {t('quiz.quickQuiz')}
                            </span>
                        )}
                    </div>
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
