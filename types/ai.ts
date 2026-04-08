import type { Language } from '@/types';

export type AiExplainMode = 'simple' | 'example' | 'language-bridge' | 'importance';

export interface AiQuizFeedback {
    whyWrong: string;
    whyCorrect: string;
    memoryHook: string;
    confusedWith: string;
}

export interface AiResponseMeta {
    model: string | null;
    usedFallback: boolean;
    degraded: boolean;
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
    model: string | null;
    usedFallback: boolean;
    degraded: boolean;
}

export interface AiScopeRefusal {
    answer: string;
    refused: true;
    relatedTerms: string[];
}

export interface AiQuizFeedbackResult extends AiResponseMeta {
    feedback: AiQuizFeedback;
}

export interface AiTermExplainResult extends AiResponseMeta {
    explanation: AiTermExplainResponse;
}

export interface AiStudyCoachResult extends AiResponseMeta {
    coach: AiStudyCoachResponse;
}

export interface AiRouteContext {
    language: Language;
    requestId: string;
}
