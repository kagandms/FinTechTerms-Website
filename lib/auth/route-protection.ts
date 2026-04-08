import {
    errorResponse,
    type ApiErrorResponseBody,
} from '@/lib/api-response';
import type { ReadJsonRequestResult } from '@/lib/api-response';
import { getPublicEnv } from '@/lib/env';
import type { NextResponse } from 'next/server';

interface SameOriginProtectionOptions {
    requestId: string;
    headers?: HeadersInit;
}

const INVALID_ORIGIN_CODE = 'INVALID_ORIGIN';
const INVALID_ORIGIN_MESSAGE = 'Cross-origin requests are not allowed.';

const normalizeOrigin = (value: string | null): string | null => {
    if (!value) {
        return null;
    }

    try {
        return new URL(value).origin;
    } catch {
        return null;
    }
};

const getAllowedOrigins = (request: Request): Set<string> => {
    const requestOrigin = new URL(request.url).origin;
    const publicOrigin = normalizeOrigin(getPublicEnv().siteUrl);
    return new Set([requestOrigin, publicOrigin].filter(Boolean) as string[]);
};

const getSourceOrigin = (request: Request): string | null => {
    const origin = normalizeOrigin(request.headers.get('origin'));
    if (origin) {
        return origin;
    }

    return normalizeOrigin(request.headers.get('referer'));
};

export const enforceSameOriginRoute = (
    request: Request,
    {
        requestId,
        headers,
    }: SameOriginProtectionOptions
): NextResponse<ApiErrorResponseBody> | null => {
    const sourceOrigin = getSourceOrigin(request);
    const allowedOrigins = getAllowedOrigins(request);

    if (sourceOrigin && allowedOrigins.has(sourceOrigin)) {
        return null;
    }

    return errorResponse({
        status: 403,
        code: INVALID_ORIGIN_CODE,
        message: INVALID_ORIGIN_MESSAGE,
        requestId,
        retryable: false,
        headers,
    });
};

interface RateLimitCheck {
    allowed: boolean;
    remaining: number;
    retryAfter: number;
    unavailable?: boolean;
}

interface AuthRateLimitOptions {
    requestId: string;
    headers: HeadersInit;
    code: string;
    message: string;
}

export const createAuthRateLimitError = (
    result: RateLimitCheck,
    {
        requestId,
        headers,
        code,
        message,
    }: AuthRateLimitOptions
): NextResponse<ApiErrorResponseBody> => {
    const status = result.unavailable ? 503 : 429;
    const retryable = result.unavailable || status === 429;
    const responseHeaders = {
        ...headers,
        ...(result.retryAfter > 0
            ? { 'Retry-After': String(result.retryAfter) }
            : {}),
    };

    return errorResponse({
        status,
        code,
        message,
        requestId,
        retryable,
        headers: responseHeaders,
    });
};

export const isJsonRequestValid = <T>(
    result: ReadJsonRequestResult<T>
): result is { ok: true; data: T } => result.ok;
