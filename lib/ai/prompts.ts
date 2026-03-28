import 'server-only';

import { findRelevantAiTerms, formatTermContextForAi } from '@/lib/ai/grounding';
import type { AiChatMessage, AiExplainMode } from '@/types/ai';
import type { Language, Term } from '@/types';

const explainModeLabelByLanguage: Record<AiExplainMode, Record<Language, string>> = {
    simple: {
        en: 'Explain this in simpler language for a beginner.',
        tr: 'Bunu yeni başlayan biri için daha basit anlat.',
        ru: 'Объясни это проще для начинающего.',
    },
    example: {
        en: 'Explain this with a concrete example.',
        tr: 'Bunu somut bir örnekle açıkla.',
        ru: 'Объясни это на конкретном примере.',
    },
    'language-bridge': {
        en: 'Explain the TR / EN / RU bridge and how the terms connect.',
        tr: 'TR / EN / RU köprüsünü ve terimlerin nasıl bağlandığını açıkla.',
        ru: 'Объясни связь между TR / EN / RU и как термины соотносятся.',
    },
    importance: {
        en: 'Explain why this matters in real financial or technical practice.',
        tr: 'Bunun gerçek finans veya teknoloji pratiğinde neden önemli olduğunu açıkla.',
        ru: 'Объясни, почему это важно в реальной финансовой или технической практике.',
    },
};

const localizedScopeRefusal: Record<Language, string> = {
    en: 'I can only help with finance, fintech, and technology topics inside FinTechTerms.',
    tr: 'Yalnızca FinTechTerms içindeki finans, fintek ve teknoloji konularında yardımcı olabilirim.',
    ru: 'Я могу помогать только по темам финансов, финтеха и технологий внутри FinTechTerms.',
};

export const getAiScopeRefusal = (language: Language): string => localizedScopeRefusal[language];

export const buildQuizFeedbackMessages = (
    term: Term,
    language: Language,
    selectedWrongLabel?: string | null
) => {
    const wrongSelectionLine = selectedWrongLabel
        ? `The user selected or leaned toward this wrong answer: ${selectedWrongLabel}`
        : 'The user could not recall the correct term in time.';

    return [
        {
            role: 'system' as const,
            content: [
                'You are FinTechTerms quiz feedback.',
                'Use only the grounded term context.',
                'Keep every field short, memorable, and pedagogical.',
                'Do not mention policy, safety, or being an AI model.',
            ].join('\n'),
        },
        {
            role: 'user' as const,
            content: [
                formatTermContextForAi(term, language),
                wrongSelectionLine,
                'Write feedback in the selected language.',
            ].join('\n\n'),
        },
    ];
};

export const buildTermExplainMessages = (
    term: Term,
    language: Language,
    explainMode: AiExplainMode
) => [
    {
        role: 'system' as const,
        content: [
            'You are FinTechTerms term coach.',
            'Use only the grounded term context.',
            'Keep the explanation clear, compact, and trustworthy.',
            'Never invent facts or citations.',
        ].join('\n'),
    },
    {
        role: 'user' as const,
        content: [
            formatTermContextForAi(term, language),
            explainModeLabelByLanguage[explainMode][language],
            'Write the full answer in the selected language.',
        ].join('\n\n'),
    },
];

export const buildStudyCoachMessages = (
    language: Language,
    summary: {
        favorites: Array<{ label: string; category: string }>;
        recentWrongTerms: Array<{ label: string; category: string; wrongCount: number }>;
        dueToday: number;
        accuracy: number | null;
        currentStreak: number;
        mistakeQueueCount: number;
    }
) => [
    {
        role: 'system' as const,
        content: [
            'You are FinTechTerms study coach.',
            'Create a practical plan from the supplied study summary only.',
            'Keep outputs concise and actionable.',
        ].join('\n'),
    },
    {
        role: 'user' as const,
        content: JSON.stringify({
            language,
            summary,
        }, null, 2),
    },
];

export const buildScopedChatMessages = (
    language: Language,
    message: string,
    history: readonly AiChatMessage[]
) => {
    const relevantTerms = findRelevantAiTerms(message, 5);
    const groundedContext = relevantTerms.length > 0
        ? relevantTerms.map((term) => formatTermContextForAi(term, language)).join('\n\n---\n\n')
        : 'No directly matching glossary term was found. Stay within finance, fintech, or technology scope.';

    return {
        relatedTerms: relevantTerms.map((term) => term.slug),
        messages: [
            {
                role: 'system' as const,
                content: [
                    'You are Ask FinTechTerms.',
                    'Answer only finance, fintech, and technology questions.',
                    'Stay grounded in the supplied glossary context.',
                    'If the context is partial, answer conservatively.',
                    'Never provide investment, tax, or legal advice.',
                ].join('\n'),
            },
            ...history.map((entry) => ({
                role: entry.role,
                content: entry.content,
            })),
            {
                role: 'user' as const,
                content: [
                    `Selected language: ${language}`,
                    `Grounded glossary context:\n${groundedContext}`,
                    `Question: ${message}`,
                ].join('\n\n'),
            },
        ],
    };
};
