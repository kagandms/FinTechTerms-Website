import { z } from 'zod';
import {
    createRequestId,
    errorResponse,
    handleRouteError,
    successResponse,
} from '@/lib/api-response';
import { buildStudyCoachFallback } from '@/lib/ai/fallbacks';
import { aiCoachRouteRateLimiter, isRateLimiterUnavailable } from '@/lib/rate-limiter';
import { buildStudyCoachMessages } from '@/lib/ai/prompts';
import { generateStructuredAiResponse } from '@/lib/ai/openrouter';
import { resolveRequestAiAccess } from '@/lib/server-member-entitlements';

const StudyCoachRequestSchema = z.object({
    language: z.enum(['tr', 'en', 'ru']),
    favorites: z.array(z.object({
        label: z.string().min(1).max(120),
        category: z.string().min(1).max(40),
    })).max(20),
    recentWrongTerms: z.array(z.object({
        label: z.string().min(1).max(120),
        category: z.string().min(1).max(40),
        wrongCount: z.number().int().min(1).max(50),
    })).max(12),
    dueToday: z.number().int().min(0).max(500),
    accuracy: z.number().int().min(0).max(100).nullable(),
    currentStreak: z.number().int().min(0).max(3650),
    mistakeQueueCount: z.number().int().min(0).max(100),
});

const StudyCoachResponseSchema = z.object({
    focusAreas: z.array(z.string().min(1).max(180)).min(2).max(4),
    todayPlan: z.array(z.string().min(1).max(180)).min(2).max(5),
    reason: z.string().min(1).max(300),
    encouragement: z.string().min(1).max(220),
});

const RATE_LIMIT_HEADERS = {
    'X-RateLimit-Limit': '6',
    'X-RateLimit-Policy': '6;w=60',
};

export async function POST(request: Request) {
    const requestId = createRequestId(request);
    let body: unknown;

    try {
        const memberState = await resolveRequestAiAccess(request);

        if (memberState.unavailable) {
            return errorResponse({
                status: memberState.unavailable.status,
                code: memberState.unavailable.code,
                message: memberState.unavailable.message,
                requestId,
                retryable: true,
                headers: RATE_LIMIT_HEADERS,
            });
        }

        if (memberState.denial?.status === 401) {
            return errorResponse({
                status: 401,
                code: 'UNAUTHORIZED',
                message: memberState.denial.message,
                requestId,
                retryable: false,
                headers: RATE_LIMIT_HEADERS,
            });
        }

        if (memberState.denial?.status === 403) {
            return errorResponse({
                status: 403,
                code: 'MEMBER_REQUIRED',
                message: memberState.denial.message,
                requestId,
                retryable: false,
                headers: RATE_LIMIT_HEADERS,
            });
        }

        const user = memberState.user;
        if (!user) {
            return errorResponse({
                status: 401,
                code: 'UNAUTHORIZED',
                message: 'Sign in to use AI features.',
                requestId,
                retryable: false,
                headers: RATE_LIMIT_HEADERS,
            });
        }

        const limitCheck = await aiCoachRouteRateLimiter.check(user.id);
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

        const parsedBody = StudyCoachRequestSchema.safeParse(body);

        if (!parsedBody.success) {
            return errorResponse({
                status: 400,
                code: 'VALIDATION_ERROR',
                message: 'Study coach payload is invalid.',
                requestId,
                retryable: false,
                headers: RATE_LIMIT_HEADERS,
            });
        }

        try {
            const result = await generateStructuredAiResponse({
                route: '/api/ai/study-coach',
                requestId,
                messages: buildStudyCoachMessages(parsedBody.data.language, parsedBody.data),
                outputContract: '{ "focusAreas": string[], "todayPlan": string[], "reason": string, "encouragement": string }',
                schema: StudyCoachResponseSchema,
                maxTokens: 520,
                temperature: 0.25,
            });

            return successResponse({
                coach: result.data,
                model: result.model,
                usedFallback: result.usedFallback,
                degraded: false,
            }, requestId, {
                headers: RATE_LIMIT_HEADERS,
            });
        } catch {
            return successResponse({
                coach: buildStudyCoachFallback(parsedBody.data.language, parsedBody.data),
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
            code: 'AI_STUDY_COACH_FAILED',
            message: 'Unable to generate the AI study coach plan right now.',
            retryable: true,
            status: 503,
            headers: RATE_LIMIT_HEADERS,
        });
    }
}
