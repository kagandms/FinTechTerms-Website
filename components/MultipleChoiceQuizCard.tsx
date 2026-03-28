'use client';

import React, { useEffect, useRef, useState } from 'react';
import type { Term } from '@/types';
import { useTermTranslation } from '@/hooks/useTermTranslation';
import { MarketBadge } from '@/components/TermTaxonomy';
import { useResponseTimer } from '@/hooks/useResponseTimer';
import { CheckCircle2, CircleHelp, XCircle } from 'lucide-react';
import type { MultipleChoiceOption } from '@/lib/quiz/multiple-choice';
import type { QuizAnswerRequest, QuizAnswerResult } from '@/components/quiz-answer-types';

interface MultipleChoiceQuizCardProps {
    term: Term;
    options: readonly MultipleChoiceOption[];
    onAnswer: (answer: QuizAnswerRequest) => Promise<QuizAnswerResult | void> | QuizAnswerResult | void;
    isPending?: boolean;
}

export default function MultipleChoiceQuizCard({
    term,
    options,
    onAnswer,
    isPending = false,
}: MultipleChoiceQuizCardProps) {
    const { t, currentDefinition } = useTermTranslation(term);
    const { startTimer, stopTimer } = useResponseTimer();
    const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
    const [isAnswerLocked, setIsAnswerLocked] = useState(false);
    const [correctOptionId, setCorrectOptionId] = useState<string | null>(null);
    const submittingRef = useRef(false);

    useEffect(() => {
        startTimer();
    }, [startTimer]);

    useEffect(() => {
        if (!isPending && submittingRef.current) {
            submittingRef.current = false;
        }
    }, [isPending]);

    const handleOptionSelect = async (option: MultipleChoiceOption) => {
        if (isPending || isAnswerLocked || submittingRef.current) {
            return;
        }

        submittingRef.current = true;
        setIsAnswerLocked(true);
        setSelectedOptionId(option.termId);
        setCorrectOptionId(options.find((candidate) => candidate.isCorrect)?.termId ?? null);

        try {
            const result = await Promise.resolve(onAnswer({
                isCorrect: option.isCorrect,
                responseTimeMs: stopTimer(),
                selectedOptionLabel: option.label,
                selectedOptionTermId: option.termId,
            }));

            if (!result?.keepLocked) {
                setIsAnswerLocked(false);
            }
        } catch {
            setIsAnswerLocked(false);
        } finally {
            submittingRef.current = false;
        }
    };

    const getOptionClassName = (option: MultipleChoiceOption): string => {
        if (!selectedOptionId) {
            return 'border-gray-200 bg-white text-gray-800 hover:border-primary-300 hover:bg-primary-50 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:hover:border-primary-400 dark:hover:bg-slate-800';
        }

        if (option.termId === correctOptionId) {
            return 'border-green-300 bg-green-50 text-green-900 dark:border-green-500/60 dark:bg-green-500/10 dark:text-green-100';
        }

        if (option.termId === selectedOptionId) {
            return 'border-red-300 bg-red-50 text-red-900 dark:border-red-500/60 dark:bg-red-500/10 dark:text-red-100';
        }

        return 'border-gray-200 bg-white/70 text-gray-400 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-500';
    };

    return (
        <div className="mx-auto w-full max-w-md rounded-3xl bg-white p-6 shadow-card dark:bg-slate-800">
            <div className="mb-4 flex items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1 rounded-full bg-primary-100 px-3 py-1 text-xs font-medium text-primary-700 dark:bg-primary-900/40 dark:text-primary-200">
                        <CircleHelp className="h-3.5 w-3.5" />
                        {t('quiz.multipleChoice')}
                    </span>
                    <MarketBadge market={term.regional_market} />
                </div>
            </div>

            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-gray-400 dark:text-gray-500">
                {t('quiz.whichTermMatches')}
            </p>
            <p className="mb-6 text-lg font-semibold leading-relaxed text-gray-900 dark:text-white">
                {currentDefinition}
            </p>

            <div className="space-y-3">
                {options.map((option) => (
                    <button
                        key={option.termId}
                        type="button"
                        onClick={() => void handleOptionSelect(option)}
                        disabled={isPending || isAnswerLocked}
                        className={`flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left text-sm font-medium transition-colors ${getOptionClassName(option)}`}
                    >
                        <span>{option.label}</span>
                        {selectedOptionId ? (
                            option.termId === correctOptionId ? (
                                <CheckCircle2 className="h-5 w-5 text-green-500" />
                            ) : option.termId === selectedOptionId ? (
                                <XCircle className="h-5 w-5 text-red-500" />
                            ) : null
                        ) : null}
                    </button>
                ))}
            </div>
        </div>
    );
}
