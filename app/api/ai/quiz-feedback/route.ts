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
import { buildQuizFeedbackFallback } from '@/lib/ai/fallbacks';
import { buildQuizFeedbackMessages } from '@/lib/ai/prompts';
import { generateStructuredAiResponse } from '@/lib/ai/openrouter';
import { resolveRequestAiAccess } from '@/lib/server-member-entitlements';

const QuizFeedbackRequestSchema = z.object({
    termId: z.string().min(1),
    language: z.enum(['tr', 'en', 'ru']),
    selectedWrongLabel: z.string().trim().min(1).max(120).nullable().optional(),
});

const QuizFeedbackResponseSchema = z.object({
    whyWrong: z.string().min(1).max(400),
    whyCorrect: z.string().min(1).max(400),
    memoryHook: z.string().min(1).max(240),
    confusedWith: z.string().min(1).max(240),
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
        const access = await resolveRequestAiAccess(request);

        if (access.unavailable) {
            return errorResponse({
                status: access.unavailable.status,
                code: access.unavailable.code,
                message: access.unavailable.message,
                requestId,
                retryable: true,
                headers: RATE_LIMIT_HEADERS,
            });
        }

        if (access.denial) {
            return errorResponse({
                status: access.denial.status,
                code: access.denial.code,
                message: access.denial.message,
                requestId,
                retryable: false,
                headers: RATE_LIMIT_HEADERS,
            });
        }

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

        const parsedBody = QuizFeedbackRequestSchema.safeParse(body);

        if (!parsedBody.success) {
            return errorResponse({
                status: 400,
                code: 'VALIDATION_ERROR',
                message: 'Quiz feedback payload is invalid.',
                requestId,
                retryable: false,
                headers: RATE_LIMIT_HEADERS,
            });
        }

        const limitCheck = await aiAssistantRouteRateLimiter.check(`quiz-feedback:${ip}`);
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

        const { termId, language, selectedWrongLabel } = parsedBody.data;
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
                route: '/api/ai/quiz-feedback',
                requestId,
                messages: buildQuizFeedbackMessages(term, language, selectedWrongLabel),
                outputContract: '{ "whyWrong": string, "whyCorrect": string, "memoryHook": string, "confusedWith": string }',
                schema: QuizFeedbackResponseSchema,
                maxTokens: 420,
                temperature: 0.2,
            });

            return successResponse({
                feedback: result.data,
                model: result.model,
                usedFallback: result.usedFallback,
                degraded: false,
            }, requestId, {
                headers: RATE_LIMIT_HEADERS,
            });
        } catch {
            return successResponse({
                feedback: buildQuizFeedbackFallback(term, language, selectedWrongLabel),
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
            code: 'AI_QUIZ_FEEDBACK_FAILED',
            message: 'Unable to generate AI quiz feedback right now.',
            retryable: true,
            status: 503,
            headers: RATE_LIMIT_HEADERS,
        });
    }
}
