import type {
    AiChatMessage,
    AiChatResponse,
    AiExplainMode,
    AiQuizFeedback,
    AiStudyCoachResponse,
    AiTermExplainResponse,
} from '@/types/ai';
import type { Language } from '@/types';
import { getSupabaseClient } from '@/lib/supabase';
import { getAiUiCopy } from '@/lib/ai-copy';

const AI_REQUEST_TIMEOUT_MS = 10_000;

const resolveLocalizedAiError = (
    language: Language,
    fallbackMessage: string,
    errorCode?: string | null
): string => {
    const copy = getAiUiCopy(language);

    if (errorCode === 'UNAUTHORIZED') {
        if (language === 'tr') return 'Devam etmek için giriş yap.';
        if (language === 'ru') return 'Войдите, чтобы продолжить.';
        return 'Sign in to continue.';
    }

    if (errorCode === 'MEMBER_REQUIRED') {
        return copy.memberRequired;
    }

    return fallbackMessage || copy.genericError;
};

const parseAiError = async (
    response: Response,
    language: Language,
    fallbackMessage: string
): Promise<string> => {
    try {
        const payload = await response.json() as { message?: string; code?: string | null };
        if (payload && typeof payload.message === 'string' && payload.message.trim()) {
            return resolveLocalizedAiError(language, payload.message, payload.code ?? null);
        }
    } catch {
        // Ignore invalid JSON error bodies.
    }

    return resolveLocalizedAiError(language, fallbackMessage, null);
};

const fetchWithTimeout = async (
    input: string,
    init: RequestInit
): Promise<Response> => {
    const controller = new AbortController();
    const timeoutId = globalThis.setTimeout(() => {
        controller.abort();
    }, AI_REQUEST_TIMEOUT_MS);

    try {
        return await fetch(input, {
            ...init,
            signal: controller.signal,
        });
    } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
            throw new Error('AI request timed out. Please try again.');
        }

        throw error;
    } finally {
        globalThis.clearTimeout(timeoutId);
    }
};

const postJson = async <T,>(input: string, body: unknown, language: Language, fallbackMessage: string): Promise<T> => {
    const {
        data: { session },
    } = await getSupabaseClient().auth.getSession();

    const response = await fetchWithTimeout(input, {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
            'Content-Type': 'application/json',
            ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify(body),
    });

    if (!response.ok) {
        throw new Error(await parseAiError(response, language, fallbackMessage));
    }

    return await response.json() as T;
};

export const fetchQuizFeedback = async (
    input: {
        termId: string;
        language: Language;
        selectedWrongLabel?: string | null;
    }
): Promise<AiQuizFeedback> => {
    const copy = getAiUiCopy(input.language);
    const payload = await postJson<{ feedback: AiQuizFeedback }>(
        '/api/ai/quiz-feedback',
        input,
        input.language,
        copy.quizFeedbackGuestLimit
    );

    return payload.feedback;
};

export const fetchTermExplainResponse = async (
    input: {
        termId: string;
        language: Language;
        mode: AiExplainMode;
    }
): Promise<AiTermExplainResponse> => {
    const copy = getAiUiCopy(input.language);
    const payload = await postJson<{ explanation: AiTermExplainResponse }>(
        '/api/ai/term-explain',
        input,
        input.language,
        copy.explainGuestLimit
    );

    return payload.explanation;
};

export const fetchStudyCoachResponse = async (
    input: {
        language: Language;
        favorites: Array<{ label: string; category: string }>;
        recentWrongTerms: Array<{ label: string; category: string; wrongCount: number }>;
        dueToday: number;
        accuracy: number | null;
        currentStreak: number;
        mistakeQueueCount: number;
    }
): Promise<AiStudyCoachResponse> => {
    const copy = getAiUiCopy(input.language);
    const payload = await postJson<{ coach: AiStudyCoachResponse }>(
        '/api/ai/study-coach',
        input,
        input.language,
        copy.studyCoachCompleteProfile
    );

    return payload.coach;
};

export const fetchAiChatResponse = async (
    input: {
        language: Language;
        message: string;
        history: AiChatMessage[];
    }
): Promise<AiChatResponse> => {
    const copy = getAiUiCopy(input.language);

    return await postJson<AiChatResponse>(
        '/api/ai/chat',
        input,
        input.language,
        copy.chatGuestLimit
    );
};
