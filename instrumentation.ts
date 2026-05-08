import * as Sentry from '@sentry/nextjs';
import { assertProductionRuntimeEnv } from '@/lib/server-env';

const TRACE_PROPAGATION_FETCH_PATCHED = Symbol.for('fintechterms.trace-propagation-fetch-patched');
const TRACE_PROPAGATION_HEADERS = [
    'sentry-trace',
    'baggage',
    'traceparent',
] as const;
const OPENROUTER_ORIGIN = 'https://openrouter.ai';

type TracePropagationHeader = typeof TRACE_PROPAGATION_HEADERS[number];
type TracePropagatingFetch = typeof fetch & {
    readonly [TRACE_PROPAGATION_FETCH_PATCHED]?: true;
};

const parseOrigin = (value: string | null | undefined): string | null => {
    if (!value) {
        return null;
    }

    try {
        return new URL(value).origin;
    } catch {
        return null;
    }
};

const resolveTracePropagationOrigins = (): readonly string[] => (
    Array.from(new Set([
        parseOrigin(process.env.NEXT_PUBLIC_SITE_URL),
        parseOrigin(process.env.NEXT_PUBLIC_SUPABASE_URL),
        parseOrigin(OPENROUTER_ORIGIN),
    ].filter((origin): origin is string => Boolean(origin))))
);

const resolveFetchUrl = (input: Parameters<typeof fetch>[0]): URL | null => {
    const rawUrl = typeof input === 'string'
        ? input
        : input instanceof URL
            ? input.href
            : input.url;

    try {
        return new URL(rawUrl);
    } catch {
        return null;
    }
};

const shouldPropagateTrace = (input: Parameters<typeof fetch>[0]): boolean => {
    const url = resolveFetchUrl(input);
    if (!url || !['http:', 'https:'].includes(url.protocol)) {
        return false;
    }

    return resolveTracePropagationOrigins().includes(url.origin);
};

const readTraceHeader = (
    traceData: ReturnType<typeof Sentry.getTraceData>,
    headerName: TracePropagationHeader
): string | undefined => {
    const value = traceData[headerName];
    return value && value.trim().length > 0 ? value : undefined;
};

const appendTraceHeaders = (headers: Headers): Headers => {
    const traceData = Sentry.getTraceData({ propagateTraceparent: true });

    TRACE_PROPAGATION_HEADERS.forEach((headerName) => {
        const value = readTraceHeader(traceData, headerName);
        if (value && !headers.has(headerName)) {
            headers.set(headerName, value);
        }
    });

    return headers;
};

const resolveInitialHeaders = (
    input: Parameters<typeof fetch>[0],
    init: Parameters<typeof fetch>[1]
): HeadersInit | undefined => {
    if (init?.headers) {
        return init.headers;
    }

    return input instanceof Request ? input.headers : undefined;
};

/**
 * Builds a fetch init object carrying the active distributed trace headers.
 *
 * @param input - The original fetch input.
 * @param init - The original fetch init.
 * @returns Fetch init with trace headers for configured downstream origins.
 */
export const createTracePropagationInit = (
    input: Parameters<typeof fetch>[0],
    init?: Parameters<typeof fetch>[1]
): Parameters<typeof fetch>[1] => {
    if (!shouldPropagateTrace(input)) {
        return init;
    }

    const headers = appendTraceHeaders(new Headers(resolveInitialHeaders(input, init)));
    return {
        ...(init ?? {}),
        headers,
    };
};

/**
 * Patches global fetch once so server-side calls propagate the current trace.
 */
export const registerTracePropagation = (): void => {
    const currentFetch = globalThis.fetch as TracePropagatingFetch | undefined;
    if (!currentFetch || currentFetch[TRACE_PROPAGATION_FETCH_PATCHED]) {
        return;
    }

    const tracePropagatingFetch = ((
        input: Parameters<typeof fetch>[0],
        init?: Parameters<typeof fetch>[1]
    ): ReturnType<typeof fetch> => currentFetch(input, createTracePropagationInit(input, init))) as TracePropagatingFetch;

    Object.defineProperty(tracePropagatingFetch, TRACE_PROPAGATION_FETCH_PATCHED, {
        value: true,
    });

    globalThis.fetch = tracePropagatingFetch;
};

export async function register(): Promise<void> {
    assertProductionRuntimeEnv();

    if (process.env.NEXT_RUNTIME === 'nodejs') {
        await import('./sentry.server.config');
    }

    if (process.env.NEXT_RUNTIME === 'edge') {
        await import('./sentry.edge.config');
    }

    registerTracePropagation();
}

export const onRequestError = Sentry.captureRequestError;
