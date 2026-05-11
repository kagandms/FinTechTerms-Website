import 'server-only';

import { createHash } from 'node:crypto';
import { z } from 'zod';
import { createTimeoutFetch } from '@/lib/api-response';
import { getServerEnv, hasConfiguredAiEnv } from '@/lib/server-env';
import { logger } from '@/lib/logger';

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const DEFAULT_AI_TIMEOUT_MS = 8_000;
const DEFAULT_AI_LATENCY_BUDGET_MS = 9_000;
const MAX_AI_RESPONSE_CACHE_ENTRIES = 100;

interface OpenRouterMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
}

interface AiResponseCacheOptions {
    key: string;
    ttlMs: number;
}

interface GenerateStructuredAiResponseOptions<T> {
    route: string;
    requestId: string;
    messages: readonly OpenRouterMessage[];
    outputContract: string;
    schema: z.ZodType<T>;
    maxTokens?: number;
    temperature?: number;
    latencyBudgetMs?: number;
    cache?: AiResponseCacheOptions;
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
    cacheStatus: 'disabled' | 'hit' | 'miss';
}

const isFallbackWorthyStatus = (status: number): boolean => status === 429 || status >= 500;
const responseCache = new Map<string, {
    expiresAt: number;
    model: string;
    data: unknown;
}>();

export class AiLatencyBudgetExceededError extends Error {
    constructor(message = 'AI latency budget exceeded.') {
        super(message);
        this.name = 'AiLatencyBudgetExceededError';
    }
}

const getCurrentTimeMs = (): number => Date.now();

const buildResponseCacheKey = (options: GenerateStructuredAiResponseOptions<unknown>): string | null => {
    if (!options.cache) {
        return null;
    }

    return createHash('sha256')
        .update(JSON.stringify({
            route: options.route,
            key: options.cache.key,
            outputContract: options.outputContract,
        }))
        .digest('hex');
};

const readCachedResponse = <T,>(
    options: GenerateStructuredAiResponseOptions<T>,
    cacheKey: string
): GenerateStructuredAiResponseResult<T> | null => {
    const cachedResponse = responseCache.get(cacheKey);
    if (!cachedResponse) {
        return null;
    }

    if (cachedResponse.expiresAt <= getCurrentTimeMs()) {
        responseCache.delete(cacheKey);
        return null;
    }

    logger.performance('AI_OPENROUTER_CACHE_HIT', {
        route: options.route,
        requestId: options.requestId,
        cacheKey,
    });

    return {
        data: cachedResponse.data as T,
        model: cachedResponse.model,
        usedFallback: false,
        cacheStatus: 'hit',
    };
};

const writeCachedResponse = <T,>(
    options: GenerateStructuredAiResponseOptions<T>,
    cacheKey: string,
    result: GenerateStructuredAiResponseResult<T>
): void => {
    if (!options.cache) {
        return;
    }

    if (responseCache.size >= MAX_AI_RESPONSE_CACHE_ENTRIES) {
        const oldestCacheKey = responseCache.keys().next().value as string | undefined;
        if (oldestCacheKey) {
            responseCache.delete(oldestCacheKey);
        }
    }

    responseCache.set(cacheKey, {
        expiresAt: getCurrentTimeMs() + options.cache.ttlMs,
        model: result.model,
        data: result.data,
    });
};

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
    const startedAtMs = getCurrentTimeMs();
    const latencyBudgetMs = options.latencyBudgetMs ?? DEFAULT_AI_LATENCY_BUDGET_MS;
    const cacheKey = buildResponseCacheKey(options);

    if (!hasConfiguredAiEnv(env) || !env.aiPrimaryModel) {
        throw new Error('AI runtime is not configured.');
    }

    if (cacheKey) {
        const cachedResponse = readCachedResponse(options, cacheKey);
        if (cachedResponse) {
            return cachedResponse;
        }

        logger.performance('AI_OPENROUTER_CACHE_MISS', {
            route: options.route,
            requestId: options.requestId,
            cacheKey,
        });
    }

    const models = [env.aiPrimaryModel, ...env.aiFallbackModels].filter(Boolean);
    let lastError: Error | null = null;

    for (const [index, model] of models.entries()) {
        const elapsedMs = getCurrentTimeMs() - startedAtMs;
        const remainingBudgetMs = latencyBudgetMs - elapsedMs;
        if (remainingBudgetMs <= 0) {
            logger.performance('AI_OPENROUTER_LATENCY_BUDGET_EXCEEDED', {
                route: options.route,
                requestId: options.requestId,
                duration_ms: elapsedMs,
                latency_budget_ms: latencyBudgetMs,
            });
            throw new AiLatencyBudgetExceededError();
        }

        const fetchWithTimeout = createTimeoutFetch(Math.min(DEFAULT_AI_TIMEOUT_MS, remainingBudgetMs), {
            dependency: 'openrouter',
            route: options.route,
            requestId: options.requestId,
        });

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

            const result = {
                data: parsed.data,
                model,
                usedFallback: index > 0,
                cacheStatus: cacheKey ? 'miss' as const : 'disabled' as const,
            };

            if (result.usedFallback) {
                logger.performance('AI_OPENROUTER_MODEL_FALLBACK_USED', {
                    route: options.route,
                    requestId: options.requestId,
                    primaryModel: models[0],
                    servedModel: model,
                    fallbackIndex: index,
                    duration_ms: getCurrentTimeMs() - startedAtMs,
                });
            }

            if (cacheKey) {
                writeCachedResponse(options, cacheKey, result);
            }

            return result;
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
