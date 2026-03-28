import { z } from 'zod';
import {
    createRequestId,
    errorResponse,
    getClientIp,
    handleRouteError,
    successResponse,
} from '@/lib/api-response';
import { aiAssistantRouteRateLimiter, isRateLimiterUnavailable } from '@/lib/rate-limiter';
import { getAiCatalogTermById } from '@/lib/ai/grounding';
import { buildTermExplainFallback } from '@/lib/ai/fallbacks';
import { buildTermExplainMessages } from '@/lib/ai/prompts';
import { generateStructuredAiResponse } from '@/lib/ai/openrouter';

const TermExplainRequestSchema = z.object({
    termId: z.string().min(1),
    language: z.enum(['tr', 'en', 'ru']),
    mode: z.enum(['simple', 'example', 'language-bridge', 'importance']),
});

const TermExplainResponseSchema = z.object({
    title: z.string().min(1).max(120),
    summary: z.string().min(1).max(500),
    keyPoints: z.array(z.string().min(1).max(180)).min(2).max(4),
    memoryHook: z.string().min(1).max(240),
});

const RATE_LIMIT_HEADERS = {
    'X-RateLimit-Limit': '12',
    'X-RateLimit-Policy': '12;w=60',
};

export async function POST(request: Request) {
    const requestId = createRequestId(request);
    const ip = getClientIp(request);
    let body: unknown;

    try {
        try {
            body = await request.json();
        } catch {
            return errorResponse({
                status: 400,
                code: 'INVALID_JSON',
                message: 'Invalid JSON payload.',
                requestId,
                retryable: false,
                headers: RATE_LIMIT_HEADERS,
            });
        }

        const parsedBody = TermExplainRequestSchema.safeParse(body);

        if (!parsedBody.success) {
            return errorResponse({
                status: 400,
                code: 'VALIDATION_ERROR',
                message: 'Term explain payload is invalid.',
                requestId,
                retryable: false,
                headers: RATE_LIMIT_HEADERS,
            });
        }

        const limitCheck = await aiAssistantRouteRateLimiter.check(`term-explain:${ip}`);
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

        const { termId, language, mode } = parsedBody.data;
        const term = getAiCatalogTermById(termId);

        if (!term) {
            return errorResponse({
                status: 404,
                code: 'TERM_NOT_FOUND',
                message: 'The requested term could not be found.',
                requestId,
                retryable: false,
                headers: RATE_LIMIT_HEADERS,
            });
        }

        try {
            const result = await generateStructuredAiResponse({
                route: '/api/ai/term-explain',
                requestId,
                messages: buildTermExplainMessages(term, language, mode),
                outputContract: '{ "title": string, "summary": string, "keyPoints": string[], "memoryHook": string }',
                schema: TermExplainResponseSchema,
                maxTokens: 500,
                temperature: 0.25,
            });

            return successResponse({
                explanation: result.data,
                model: result.model,
                usedFallback: result.usedFallback,
                degraded: false,
            }, requestId, {
                headers: RATE_LIMIT_HEADERS,
            });
        } catch {
            return successResponse({
                explanation: buildTermExplainFallback(term, language, mode),
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
            code: 'AI_TERM_EXPLAIN_FAILED',
            message: 'Unable to generate the AI explanation right now.',
            retryable: true,
            status: 503,
            headers: RATE_LIMIT_HEADERS,
        });
    }
}
