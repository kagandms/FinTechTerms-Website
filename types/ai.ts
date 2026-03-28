import type { Language } from '@/types';

export type AiExplainMode = 'simple' | 'example' | 'language-bridge' | 'importance';

export interface AiQuizFeedback {
    whyWrong: string;
    whyCorrect: string;
    memoryHook: string;
    confusedWith: string;
}

export interface AiTermExplainResponse {
    title: string;
    summary: string;
    keyPoints: string[];
    memoryHook: string;
}

export interface AiStudyCoachResponse {
    focusAreas: string[];
    todayPlan: string[];
    reason: string;
    encouragement: string;
}

export interface AiChatMessage {
    role: 'user' | 'assistant';
    content: string;
}

export interface AiChatResponse {
    answer: string;
    relatedTerms: string[];
    refused: boolean;
}

export interface AiScopeRefusal {
    answer: string;
    refused: true;
    relatedTerms: string[];
}

export interface AiRouteContext {
    language: Language;
    requestId: string;
}
