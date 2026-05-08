import { NextResponse } from 'next/server';
import { isIP } from 'node:net';
import { logger } from '@/lib/logger';

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

export interface ReadJsonRequestOptions {
    requestId: string;
    message: string;
    headers?: HeadersInit;
}

export interface RegisteredRouteMetricContext {
    readonly requestId: string;
    readonly route: string;
    readonly method: string;
}

export interface UpstreamMetricOptions {
    readonly dependency: string;
    readonly requestId?: string;
    readonly route?: string;
}

export type ReadJsonRequestResult<T> =
    | { ok: true; data: T }
    | { ok: false; response: NextResponse<ApiErrorResponseBody> };

export const DEFAULT_UPSTREAM_TIMEOUT_MS = 8_000;
const ROUTE_METRIC_TTL_MS = 60_000;
const MAX_ROUTE_METRIC_ENTRIES = 1_000;

interface RouteMetricContext {
    readonly route: string;
    readonly method: string;
    readonly startedAtMs: number;
}

const routeMetricContextByRequestId = new Map<string, RouteMetricContext>();
const routeMetricContextByRequest = new WeakMap<Request, RegisteredRouteMetricContext>();

export class UpstreamTimeoutError extends Error {
    constructor(message = 'Upstream request timed out.') {
        super(message);
        this.name = 'UpstreamTimeoutError';
    }
}

const getCurrentTimeMs = (): number => Date.now();

const cleanupStaleRouteMetrics = (nowMs: number): void => {
    if (routeMetricContextByRequestId.size < MAX_ROUTE_METRIC_ENTRIES) {
        return;
    }

    for (const [requestId, context] of routeMetricContextByRequestId.entries()) {
        if (nowMs - context.startedAtMs > ROUTE_METRIC_TTL_MS) {
            routeMetricContextByRequestId.delete(requestId);
        }
    }
};

const resolveRoutePath = (request: Request): string => {
    try {
        return new URL(request.url).pathname;
    } catch {
        return 'unknown';
    }
};

const registerRouteMetricContext = (
    requestId: string,
    request: Request
): void => {
    const nowMs = getCurrentTimeMs();
    const route = resolveRoutePath(request);
    const method = request.method;

    cleanupStaleRouteMetrics(nowMs);
    routeMetricContextByRequestId.set(requestId, {
        route,
        method,
        startedAtMs: nowMs,
    });
    routeMetricContextByRequest.set(request, {
        requestId,
        route,
        method,
    });
};

const emitRoutePerformanceMetric = (
    requestId: string,
    status: number
): void => {
    const context = routeMetricContextByRequestId.get(requestId);
    if (!context) {
        return;
    }

    routeMetricContextByRequestId.delete(requestId);
    logger.performance('API_ROUTE_COMPLETED', {
        requestId,
        route: context.route,
        method: context.method,
        status,
        duration_ms: getCurrentTimeMs() - context.startedAtMs,
    });
};

export const getRegisteredRouteMetricContext = (
    request: Request
): RegisteredRouteMetricContext | null => routeMetricContextByRequest.get(request) ?? null;

export const createRequestId = (request?: Request): string => {
    const requestId = request?.headers.get('x-request-id')?.trim();
    const resolvedRequestId = requestId || crypto.randomUUID();

    if (request) {
        registerRouteMetricContext(resolvedRequestId, request);
    }

    return resolvedRequestId;
};

const normalizeIpCandidate = (value: string | null | undefined): string | null => {
    const trimmedValue = value?.trim();
    if (!trimmedValue) {
        return null;
    }

    const withoutQuotes = trimmedValue.replace(/^"+|"+$/g, '');
    const withoutForwardedPrefix = withoutQuotes.startsWith('for=')
        ? withoutQuotes.slice(4)
        : withoutQuotes;

    if (withoutForwardedPrefix.startsWith('[')) {
        const closingBracketIndex = withoutForwardedPrefix.indexOf(']');
        if (closingBracketIndex > 1) {
            const bracketedHost = withoutForwardedPrefix.slice(1, closingBracketIndex);
            return isIP(bracketedHost) ? bracketedHost : null;
        }
    }

    const ipv4HostMatch = withoutForwardedPrefix.match(/^(\d{1,3}(?:\.\d{1,3}){3})(?::\d+)?$/);
    if (ipv4HostMatch?.[1] && isIP(ipv4HostMatch[1])) {
        return ipv4HostMatch[1];
    }

    return isIP(withoutForwardedPrefix) ? withoutForwardedPrefix : null;
};

const getTrustedProxyHeaders = (): readonly string[] => {
    if (process.env.VERCEL === '1' || process.env.VERCEL_URL) {
        return ['x-real-ip'];
    }

    if (process.env.RENDER || process.env.RENDER_EXTERNAL_URL) {
        return ['x-real-ip'];
    }

    if (process.env.FLY_APP_NAME) {
        return ['fly-client-ip'];
    }

    if (process.env.FASTLY_HOSTNAME) {
        return ['fastly-client-ip', 'true-client-ip'];
    }

    return [];
};

const canTrustForwardedFor = (): boolean => (
    Boolean(process.env.VERCEL === '1' || process.env.VERCEL_URL)
    || Boolean(process.env.RENDER || process.env.RENDER_EXTERNAL_URL)
    || Boolean(process.env.FLY_APP_NAME)
    || Boolean(process.env.FASTLY_HOSTNAME)
);

const getTrustedHeaderIp = (request: Request): string | null => {
    const trustedHeaders = getTrustedProxyHeaders();

    for (const headerName of trustedHeaders) {
        const headerIp = normalizeIpCandidate(request.headers.get(headerName));
        if (headerIp) {
            return headerIp;
        }
    }

    return null;
};

const getForwardedForIp = (request: Request): string | null => {
    if (!canTrustForwardedFor()) {
        return null;
    }

    const forwardedFor = request.headers.get('x-forwarded-for');
    if (!forwardedFor) {
        return null;
    }

    const forwardedEntries = forwardedFor
        .split(',')
        .map((entry) => normalizeIpCandidate(entry))
        .filter((entry): entry is string => Boolean(entry));

    if (forwardedEntries.length === 0) {
        return null;
    }

    return forwardedEntries[0] ?? null;
};

export const getClientIp = (request: Request): string => {
    const requestIp = normalizeIpCandidate((request as Request & { ip?: string | null }).ip);
    if (requestIp) {
        return requestIp;
    }

    const trustedHeaderIp = getTrustedHeaderIp(request);
    if (trustedHeaderIp) {
        return trustedHeaderIp;
    }

    return getForwardedForIp(request) || 'unknown';
};

export const getDeviceFingerprint = (request: Request): string | null => {
    const fingerprint = request.headers.get('x-device-fingerprint')?.trim()
        || request.headers.get('x-device-id')?.trim();

    return fingerprint || null;
};

export const createTimeoutFetch = (
    timeoutMs = DEFAULT_UPSTREAM_TIMEOUT_MS,
    metricOptions?: UpstreamMetricOptions
): typeof fetch => {
    return async (input, init = {}) => {
        const startedAtMs = getCurrentTimeMs();
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
        const upstreamSignal = init.signal;
        const relayAbort = () => controller.abort();
        const emitUpstreamMetric = (
            status: number | null,
            outcome: 'success' | 'error' | 'timeout'
        ): void => {
            if (!metricOptions) {
                return;
            }

            logger.performance('UPSTREAM_REQUEST_COMPLETED', {
                dependency: metricOptions.dependency,
                requestId: metricOptions.requestId,
                route: metricOptions.route,
                status,
                outcome,
                duration_ms: getCurrentTimeMs() - startedAtMs,
                timeout_ms: timeoutMs,
            });
        };

        if (upstreamSignal) {
            if (upstreamSignal.aborted) {
                relayAbort();
            } else {
                upstreamSignal.addEventListener('abort', relayAbort, { once: true });
            }
        }

        try {
            const response = await fetch(input, {
                ...init,
                signal: controller.signal,
            });
            emitUpstreamMetric(response.status, 'success');
            return response;
        } catch (error) {
            if (error instanceof Error && error.name === 'AbortError') {
                emitUpstreamMetric(null, 'timeout');
                throw new UpstreamTimeoutError(
                    `Upstream request timed out after ${timeoutMs}ms.`
                );
            }

            emitUpstreamMetric(null, 'error');
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
) => {
    const status = init.status ?? 200;
    emitRoutePerformanceMetric(requestId, status);
    return NextResponse.json(data, {
        ...init,
        headers: withRequestIdHeaders(requestId, init.headers),
    });
};

export const errorResponse = ({
    status,
    code,
    message,
    requestId,
    retryable,
    headers,
}: ErrorResponseOptions) => {
    emitRoutePerformanceMetric(requestId, status);
    return NextResponse.json<ApiErrorResponseBody>(
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
};

export const readJsonRequest = async <T>(
    request: Request,
    {
        requestId,
        message,
        headers,
    }: ReadJsonRequestOptions
): Promise<ReadJsonRequestResult<T>> => {
    try {
        return {
            ok: true,
            data: await request.json() as T,
        };
    } catch {
        return {
            ok: false,
            response: errorResponse({
                status: 400,
                code: 'INVALID_JSON',
                message,
                requestId,
                retryable: false,
                headers,
            }),
        };
    }
};

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
        logger.error(`${logLabel}_TIMEOUT`, {
            requestId,
            route: logLabel,
            error,
            retryable: true,
        });
        return errorResponse({
            status: 504,
            code: timeoutCode,
            message: timeoutMessage,
            requestId,
            retryable: true,
            headers,
        });
    }

    logger.error(logLabel, {
        requestId,
        route: logLabel,
        error: error instanceof Error ? error : undefined,
        retryable,
    });
    return errorResponse({
        status,
        code,
        message,
        requestId,
        retryable,
        headers,
    });
};
