import type {
    AiChatMessage,
    AiTermExplainResponse,
} from '@/types/ai';

export type AiGuestTeaserKey = 'quiz-feedback' | 'term-explain' | 'chat-message';

interface AiGuestTeaserUsageState {
    quizFeedbackCount: number;
    termExplainCount: number;
    chatMessageCount: number;
}

interface CachedTermExplainEntry {
    expiresAt: number;
    payload: AiTermExplainResponse;
}

const AI_GUEST_USAGE_STORAGE_KEY = 'fintechterms_ai_guest_usage';
const AI_TERM_EXPLAIN_CACHE_KEY = 'fintechterms_ai_term_explain_cache';
const AI_CHAT_HISTORY_KEY = 'fintechterms_ai_chat_history';
const TERM_EXPLAIN_CACHE_TTL_MS = 5 * 60 * 1000;

const createDefaultUsageState = (): AiGuestTeaserUsageState => ({
    quizFeedbackCount: 0,
    termExplainCount: 0,
    chatMessageCount: 0,
});

const isSessionStorageAvailable = (): boolean => {
    try {
        const key = '__ai_session_storage_test__';
        window.sessionStorage.setItem(key, key);
        window.sessionStorage.removeItem(key);
        return true;
    } catch {
        return false;
    }
};

const readJsonValue = <T,>(key: string): T | null => {
    if (typeof window === 'undefined' || !isSessionStorageAvailable()) {
        return null;
    }

    const rawValue = window.sessionStorage.getItem(key);
    if (!rawValue) {
        return null;
    }

    try {
        return JSON.parse(rawValue) as T;
    } catch {
        return null;
    }
};

const writeJsonValue = (key: string, value: unknown): void => {
    if (typeof window === 'undefined' || !isSessionStorageAvailable()) {
        return;
    }

    window.sessionStorage.setItem(key, JSON.stringify(value));
};

export const getAiGuestTeaserUsage = (): AiGuestTeaserUsageState => (
    readJsonValue<AiGuestTeaserUsageState>(AI_GUEST_USAGE_STORAGE_KEY)
    ?? createDefaultUsageState()
);

export const incrementAiGuestTeaserUsage = (key: AiGuestTeaserKey): AiGuestTeaserUsageState => {
    const currentState = getAiGuestTeaserUsage();
    const nextState: AiGuestTeaserUsageState = {
        quizFeedbackCount: currentState.quizFeedbackCount,
        termExplainCount: currentState.termExplainCount,
        chatMessageCount: currentState.chatMessageCount,
    };

    if (key === 'quiz-feedback') {
        nextState.quizFeedbackCount += 1;
    }

    if (key === 'term-explain') {
        nextState.termExplainCount += 1;
    }

    if (key === 'chat-message') {
        nextState.chatMessageCount += 1;
    }

    writeJsonValue(AI_GUEST_USAGE_STORAGE_KEY, nextState);
    return nextState;
};

export const getCachedTermExplainResponse = (
    cacheKey: string
): AiTermExplainResponse | null => {
    const cache = readJsonValue<Record<string, CachedTermExplainEntry>>(AI_TERM_EXPLAIN_CACHE_KEY);
    const entry = cache?.[cacheKey];

    if (!entry || entry.expiresAt <= Date.now()) {
        return null;
    }

    return entry.payload;
};

export const setCachedTermExplainResponse = (
    cacheKey: string,
    payload: AiTermExplainResponse
): void => {
    const existingCache = readJsonValue<Record<string, CachedTermExplainEntry>>(AI_TERM_EXPLAIN_CACHE_KEY) ?? {};
    const nextCache = {
        ...existingCache,
        [cacheKey]: {
            expiresAt: Date.now() + TERM_EXPLAIN_CACHE_TTL_MS,
            payload,
        },
    };

    writeJsonValue(AI_TERM_EXPLAIN_CACHE_KEY, nextCache);
};

export const getAiChatHistory = (): AiChatMessage[] => (
    readJsonValue<AiChatMessage[]>(AI_CHAT_HISTORY_KEY) ?? []
);

export const saveAiChatHistory = (messages: readonly AiChatMessage[]): void => {
    writeJsonValue(AI_CHAT_HISTORY_KEY, messages);
};

export const clearAiChatHistory = (): void => {
    if (typeof window === 'undefined' || !isSessionStorageAvailable()) {
        return;
    }

    window.sessionStorage.removeItem(AI_CHAT_HISTORY_KEY);
};
