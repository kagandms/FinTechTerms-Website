import { NextResponse } from 'next/server';

export interface ApiErrorResponseBody {
    code: string;
    message: string;
    requestId: string;
    retryable: boolean;
}

export interface ErrorResponseOptions {
    status: number;
    code: string;
    message: string;
    requestId: string;
    retryable: boolean;
    headers?: HeadersInit;
}

export interface HandleRouteErrorOptions {
    requestId: string;
    code?: string;
    message?: string;
    retryable?: boolean;
    status?: number;
    timeoutCode?: string;
    timeoutMessage?: string;
    headers?: HeadersInit;
    logLabel?: string;
}

export const DEFAULT_UPSTREAM_TIMEOUT_MS = 8_000;

export class UpstreamTimeoutError extends Error {
    constructor(message = 'Upstream request timed out.') {
        super(message);
        this.name = 'UpstreamTimeoutError';
    }
}

export const createRequestId = (request?: Request): string => {
    const requestId = request?.headers.get('x-request-id')?.trim();
    return requestId || crypto.randomUUID();
};

export const getClientIp = (request: Request): string => {
    const forwardedFor = request.headers.get('x-forwarded-for');
    if (forwardedFor) {
        const firstIp = forwardedFor.split(',')[0]?.trim();
        if (firstIp) {
            return firstIp;
        }
    }

    const requestIp = (request as Request & { ip?: string | null }).ip?.trim();
    if (requestIp) {
        return requestIp;
    }

    return request.headers.get('x-real-ip')?.trim() || 'unknown';
};

export const getDeviceFingerprint = (request: Request): string | null => {
    const fingerprint = request.headers.get('x-device-fingerprint')?.trim()
        || request.headers.get('x-device-id')?.trim();

    return fingerprint || null;
};

export const createTimeoutFetch = (
    timeoutMs = DEFAULT_UPSTREAM_TIMEOUT_MS
): typeof fetch => {
    return async (input, init = {}) => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
        const upstreamSignal = init.signal;
        const relayAbort = () => controller.abort();

        if (upstreamSignal) {
            if (upstreamSignal.aborted) {
                relayAbort();
            } else {
                upstreamSignal.addEventListener('abort', relayAbort, { once: true });
            }
        }

        try {
            return await fetch(input, {
                ...init,
                signal: controller.signal,
            });
        } catch (error) {
            if (error instanceof Error && error.name === 'AbortError') {
                throw new UpstreamTimeoutError(
                    `Upstream request timed out after ${timeoutMs}ms.`
                );
            }

            throw error;
        } finally {
            clearTimeout(timeoutId);
            if (upstreamSignal) {
                upstreamSignal.removeEventListener('abort', relayAbort);
            }
        }
    };
};

export const isUpstreamTimeoutError = (error: unknown): error is UpstreamTimeoutError =>
    error instanceof UpstreamTimeoutError
    || (error instanceof Error && error.name === 'UpstreamTimeoutError');

const withRequestIdHeaders = (
    requestId: string,
    headers?: HeadersInit
): Headers => {
    const nextHeaders = new Headers(headers);
    nextHeaders.set('X-Request-Id', requestId);
    return nextHeaders;
};

export const successResponse = <T>(
    data: T,
    requestId: string,
    init: ResponseInit = {}
) => NextResponse.json(data, {
    ...init,
    headers: withRequestIdHeaders(requestId, init.headers),
});

export const errorResponse = ({
    status,
    code,
    message,
    requestId,
    retryable,
    headers,
}: ErrorResponseOptions) => NextResponse.json<ApiErrorResponseBody>(
    {
        code,
        message,
        requestId,
        retryable,
    },
    {
        status,
        headers: withRequestIdHeaders(requestId, headers),
    }
);

export const handleRouteError = (
    error: unknown,
    {
        requestId,
        code = 'INTERNAL_ERROR',
        message = 'Unexpected server error.',
        retryable = true,
        status = 500,
        timeoutCode = 'UPSTREAM_TIMEOUT',
        timeoutMessage = 'Upstream request timed out.',
        headers,
        logLabel = 'API_ROUTE_ERROR',
    }: HandleRouteErrorOptions
) => {
    if (isUpstreamTimeoutError(error)) {
        console.error(`${logLabel}_TIMEOUT`, error);
        return errorResponse({
            status: 504,
            code: timeoutCode,
            message: timeoutMessage,
            requestId,
            retryable: true,
            headers,
        });
    }

    console.error(logLabel, error);
    return errorResponse({
        status,
        code,
        message,
        requestId,
        retryable,
        headers,
    });
};
