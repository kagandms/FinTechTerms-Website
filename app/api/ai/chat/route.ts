import { z } from 'zod';
import {
    createRequestId,
    errorResponse,
    getClientIp,
    handleRouteError,
    successResponse,
} from '@/lib/api-response';
import { buildChatFallback } from '@/lib/ai/fallbacks';
import { aiAssistantRouteRateLimiter, isRateLimiterUnavailable } from '@/lib/rate-limiter';
import { buildScopedChatMessages, getAiScopeRefusal } from '@/lib/ai/prompts';
import { generateStructuredAiResponse } from '@/lib/ai/openrouter';
import { isAiDomainQuestion } from '@/lib/ai/grounding';

const ChatRequestSchema = z.object({
    language: z.enum(['tr', 'en', 'ru']),
    message: z.string().trim().min(2).max(500),
    history: z.array(z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string().trim().min(1).max(1000),
    })).max(6),
});

const ChatResponseSchema = z.object({
    answer: z.string().min(1).max(1200),
});

const RATE_LIMIT_HEADERS = {
    'X-RateLimit-Limit': '12',
    'X-RateLimit-Policy': '12;w=60',
};

export async function POST(request: Request) {
    const requestId = createRequestId(request);
    const ip = getClientIp(request);

    try {
        const parsedBody = ChatRequestSchema.safeParse(await request.json());

        if (!parsedBody.success) {
            return errorResponse({
                status: 400,
                code: 'VALIDATION_ERROR',
                message: 'Chat payload is invalid.',
                requestId,
                retryable: false,
                headers: RATE_LIMIT_HEADERS,
            });
        }

        const limitCheck = await aiAssistantRouteRateLimiter.check(`chat:${ip}`);
        if (isRateLimiterUnavailable(limitCheck)) {
            return errorResponse({
                status: 503,
                code: 'RATE_LIMITER_UNAVAILABLE',
                message: 'AI rate limiting is temporarily unavailable.',
                requestId,
                retryable: true,
                headers: RATE_LIMIT_HEADERS,
            });
        }

        if (!limitCheck.allowed) {
            return errorResponse({
                status: 429,
                code: 'RATE_LIMITED',
                message: 'Too many AI requests. Please try again shortly.',
                requestId,
                retryable: true,
                headers: {
                    ...RATE_LIMIT_HEADERS,
                    'Retry-After': String(limitCheck.retryAfter),
                },
            });
        }

        const { language, message, history } = parsedBody.data;

        if (!isAiDomainQuestion(message)) {
            return successResponse({
                answer: getAiScopeRefusal(language),
                relatedTerms: [],
                refused: true,
                model: null,
                usedFallback: false,
            }, requestId, {
                headers: RATE_LIMIT_HEADERS,
            });
        }

        const chatPrompt = buildScopedChatMessages(language, message, history);

        try {
            const result = await generateStructuredAiResponse({
                route: '/api/ai/chat',
                requestId,
                messages: chatPrompt.messages,
                outputContract: '{ "answer": string }',
                schema: ChatResponseSchema,
                maxTokens: 650,
                temperature: 0.3,
            });

            return successResponse({
                answer: result.data.answer,
                relatedTerms: chatPrompt.relatedTerms,
                refused: false,
                model: result.model,
                usedFallback: result.usedFallback,
                degraded: false,
            }, requestId, {
                headers: RATE_LIMIT_HEADERS,
            });
        } catch {
            const fallback = buildChatFallback(language, message);

            return successResponse({
                ...fallback,
                model: null,
                usedFallback: true,
                degraded: true,
            }, requestId, {
                headers: RATE_LIMIT_HEADERS,
            });
        }
    } catch (error) {
        return handleRouteError(error, {
            requestId,
            code: 'AI_CHAT_FAILED',
            message: 'Unable to answer right now.',
            retryable: true,
            status: 503,
            headers: RATE_LIMIT_HEADERS,
        });
    }
}
