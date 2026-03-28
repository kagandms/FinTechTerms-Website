import type {
    AiChatMessage,
    AiChatResponse,
    AiExplainMode,
    AiQuizFeedback,
    AiStudyCoachResponse,
    AiTermExplainResponse,
} from '@/types/ai';
import type { Language } from '@/types';

const parseAiError = async (response: Response, fallbackMessage: string): Promise<string> => {
    try {
        const payload = await response.json();
        if (payload && typeof payload.message === 'string' && payload.message.trim()) {
            return payload.message;
        }
    } catch {
        // Ignore invalid JSON error bodies.
    }

    return fallbackMessage;
};

const postJson = async <T,>(input: string, body: unknown, fallbackMessage: string): Promise<T> => {
    const response = await fetch(input, {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
    });

    if (!response.ok) {
        throw new Error(await parseAiError(response, fallbackMessage));
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
    const payload = await postJson<{ feedback: AiQuizFeedback }>(
        '/api/ai/quiz-feedback',
        input,
        'Unable to generate AI quiz feedback right now.'
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
    const payload = await postJson<{ explanation: AiTermExplainResponse }>(
        '/api/ai/term-explain',
        input,
        'Unable to generate the AI explanation right now.'
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
    const payload = await postJson<{ coach: AiStudyCoachResponse }>(
        '/api/ai/study-coach',
        input,
        'Unable to generate the AI study coach plan right now.'
    );

    return payload.coach;
};

export const fetchAiChatResponse = async (
    input: {
        language: Language;
        message: string;
        history: AiChatMessage[];
    }
): Promise<AiChatResponse> => (
    await postJson<AiChatResponse>(
        '/api/ai/chat',
        input,
        'Unable to answer right now.'
    )
);
