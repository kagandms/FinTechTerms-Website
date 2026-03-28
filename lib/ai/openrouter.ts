import 'server-only';

import { z } from 'zod';
import { createTimeoutFetch } from '@/lib/api-response';
import { getServerEnv, hasConfiguredAiEnv } from '@/lib/env';
import { logger } from '@/lib/logger';

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const DEFAULT_AI_TIMEOUT_MS = 10_000;

interface OpenRouterMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
}

interface GenerateStructuredAiResponseOptions<T> {
    route: string;
    requestId: string;
    messages: readonly OpenRouterMessage[];
    outputContract: string;
    schema: z.ZodType<T>;
    maxTokens?: number;
    temperature?: number;
}

interface OpenRouterErrorPayload {
    error?: {
        message?: string;
        code?: number | string;
        metadata?: unknown;
    };
}

interface GenerateStructuredAiResponseResult<T> {
    data: T;
    model: string;
    usedFallback: boolean;
}

const isFallbackWorthyStatus = (status: number): boolean => status === 429 || status >= 500;

const readMessageContent = (payload: unknown): string => {
    if (!payload || typeof payload !== 'object') {
        return '';
    }

    const content = (payload as { choices?: Array<{ message?: { content?: unknown } }> }).choices?.[0]?.message?.content;

    if (typeof content === 'string') {
        return content;
    }

    if (Array.isArray(content)) {
        return content
            .map((entry) => (
                entry
                && typeof entry === 'object'
                && 'text' in entry
                && typeof entry.text === 'string'
                    ? entry.text
                    : ''
            ))
            .join('\n')
            .trim();
    }

    return '';
};

const extractJsonObject = (value: string): string => {
    const trimmedValue = value.trim();

    if (!trimmedValue) {
        return '';
    }

    const fencedMatch = trimmedValue.match(/```(?:json)?\s*([\s\S]*?)```/i);
    const unfencedValue = fencedMatch?.[1]?.trim() ?? trimmedValue;
    const firstBraceIndex = unfencedValue.indexOf('{');
    const lastBraceIndex = unfencedValue.lastIndexOf('}');

    if (firstBraceIndex === -1 || lastBraceIndex === -1 || lastBraceIndex <= firstBraceIndex) {
        return '';
    }

    return unfencedValue.slice(firstBraceIndex, lastBraceIndex + 1);
};

export const generateStructuredAiResponse = async <T>(
    options: GenerateStructuredAiResponseOptions<T>
): Promise<GenerateStructuredAiResponseResult<T>> => {
    const env = getServerEnv();

    if (!hasConfiguredAiEnv(env) || !env.aiPrimaryModel) {
        throw new Error('AI runtime is not configured.');
    }

    const models = [env.aiPrimaryModel, ...env.aiFallbackModels].filter(Boolean);
    const fetchWithTimeout = createTimeoutFetch(DEFAULT_AI_TIMEOUT_MS);
    let lastError: Error | null = null;

    for (const [index, model] of models.entries()) {
        try {
            const response = await fetchWithTimeout(OPENROUTER_URL, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${env.openRouterApiKey}`,
                    'Content-Type': 'application/json',
                    'HTTP-Referer': env.openRouterReferer ?? 'https://fintechterms.com',
                    'X-Title': env.openRouterAppName ?? 'FinTechTerms',
                },
                body: JSON.stringify({
                    model,
                    messages: [
                        {
                            role: 'system',
                            content: [
                                'Return only valid JSON. Do not use markdown fences.',
                                `Output contract: ${options.outputContract}`,
                            ].join('\n'),
                        },
                        ...options.messages,
                    ],
                    temperature: options.temperature ?? 0.2,
                    max_tokens: options.maxTokens ?? 500,
                }),
            });

            const rawText = await response.text();
            const rawPayload = rawText ? JSON.parse(rawText) as OpenRouterErrorPayload : {};

            if (!response.ok) {
                const upstreamMessage = rawPayload.error?.message || `OpenRouter request failed with status ${response.status}.`;
                const nextError = new Error(upstreamMessage);

                if (isFallbackWorthyStatus(response.status) && index < models.length - 1) {
                    lastError = nextError;
                    continue;
                }

                throw nextError;
            }

            const content = readMessageContent(rawPayload);
            const jsonPayload = extractJsonObject(content);

            if (!jsonPayload) {
                throw new Error(`Model ${model} returned a non-JSON response.`);
            }

            const parsed = options.schema.safeParse(JSON.parse(jsonPayload));

            if (!parsed.success) {
                throw new Error(`Model ${model} returned invalid structured output.`);
            }

            return {
                data: parsed.data,
                model,
                usedFallback: index > 0,
            };
        } catch (error) {
            const nextError = error instanceof Error ? error : new Error('Unknown AI upstream failure.');
            logger.warn('AI_OPENROUTER_MODEL_FAILED', {
                route: options.route,
                requestId: options.requestId,
                model,
                error: nextError,
            });
            lastError = nextError;

            if (index === models.length - 1) {
                break;
            }
        }
    }

    throw lastError ?? new Error('AI response generation failed.');
};
