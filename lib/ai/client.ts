import type {
    AiChatMessage,
    AiChatResponse,
    AiExplainMode,
    AiQuizFeedback,
    AiQuizFeedbackResult,
    AiStudyCoachResponse,
    AiStudyCoachResult,
    AiTermExplainResponse,
    AiTermExplainResult,
} from '@/types/ai';
import type { Language } from '@/types';
import { getAiUiCopy } from '@/lib/ai-copy';

const AI_REQUEST_TIMEOUT_MS = 20_000;

interface ParsedAiRouteError {
    readonly message: string;
    readonly code: string | null;
}

interface AiClientErrorOptions {
    readonly code: string;
    readonly status: number | null;
    readonly isRecoverable: boolean;
}

const NON_RECOVERABLE_AI_ERROR_CODES = new Set([
    'UNAUTHORIZED',
    'MEMBER_REQUIRED',
    'RATE_LIMITED',
    'MEMBER_STATE_UNAVAILABLE',
]);

export class AiClientError extends Error {
    readonly code: string;
    readonly status: number | null;
    readonly isRecoverable: boolean;

    constructor(message: string, options: AiClientErrorOptions) {
        super(message);
        this.name = 'AiClientError';
        this.code = options.code;
        this.status = options.status;
        this.isRecoverable = options.isRecoverable;
    }
}

export const isRecoverableAiClientError = (error: unknown): boolean => (
    Boolean(
        error
        && typeof error === 'object'
        && 'isRecoverable' in error
        && error.isRecoverable === true
    )
);

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
): Promise<ParsedAiRouteError> => {
    try {
        const payload = await response.json() as { message?: string; code?: string | null };
        if (payload && typeof payload.message === 'string' && payload.message.trim()) {
            return {
                message: resolveLocalizedAiError(language, payload.message, payload.code ?? null),
                code: payload.code ?? null,
            };
        }
    } catch {
        // Ignore invalid JSON error bodies.
    }

    return {
        message: resolveLocalizedAiError(language, fallbackMessage, null),
        code: null,
    };
};

const isRecoverableAiRouteError = (status: number, code: string | null): boolean => {
    if (code && NON_RECOVERABLE_AI_ERROR_CODES.has(code)) {
        return false;
    }

    if (status === 401 || status === 403 || status === 429) {
        return false;
    }

    return status === 408 || status >= 500;
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
            throw new AiClientError('AI request timed out. Please try again.', {
                code: 'AI_CLIENT_TIMEOUT',
                status: null,
                isRecoverable: true,
            });
        }

        throw error;
    } finally {
        globalThis.clearTimeout(timeoutId);
    }
};

const postJson = async <T,>(input: string, body: unknown, language: Language, fallbackMessage: string): Promise<T> => {
    let response: Response;

    try {
        response = await fetchWithTimeout(input, {
            method: 'POST',
            credentials: 'same-origin',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
        });
    } catch (error) {
        if (error instanceof AiClientError) {
            throw error;
        }

        throw new AiClientError(resolveLocalizedAiError(language, fallbackMessage, null), {
            code: 'AI_CLIENT_NETWORK',
            status: null,
            isRecoverable: true,
        });
    }

    if (!response.ok) {
        const routeError = await parseAiError(response, language, fallbackMessage);
        throw new AiClientError(routeError.message, {
            code: routeError.code ?? `HTTP_${response.status}`,
            status: response.status,
            isRecoverable: isRecoverableAiRouteError(response.status, routeError.code),
        });
    }

    return await response.json() as T;
};

export const fetchQuizFeedback = async (
    input: {
        termId: string;
        language: Language;
        selectedWrongLabel?: string | null;
    }
): Promise<AiQuizFeedbackResult> => {
    const copy = getAiUiCopy(input.language);
    return await postJson<AiQuizFeedbackResult>(
        '/api/ai/quiz-feedback',
        input,
        input.language,
        copy.quizFeedbackGuestLimit
    );
};

export const fetchTermExplainResponse = async (
    input: {
        termId: string;
        language: Language;
        mode: AiExplainMode;
    }
): Promise<AiTermExplainResult> => {
    const copy = getAiUiCopy(input.language);
    return await postJson<AiTermExplainResult>(
        '/api/ai/term-explain',
        input,
        input.language,
        copy.explainGuestLimit
    );
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
): Promise<AiStudyCoachResult> => {
    const copy = getAiUiCopy(input.language);
    return await postJson<AiStudyCoachResult>(
        '/api/ai/study-coach',
        input,
        input.language,
        copy.studyCoachCompleteProfile
    );
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
