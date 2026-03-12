import * as Sentry from '@sentry/nextjs';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

type ConsoleMethod = 'warn' | 'error';

interface LoggerBaseContext {
    readonly requestId?: string;
    readonly route?: string;
    readonly userId?: string | null;
    readonly retryable?: boolean;
    readonly tags?: Record<string, string>;
    readonly error?: Error | null;
    readonly [key: string]: unknown;
}

const severityMap: Record<Exclude<LogLevel, 'debug'>, Sentry.SeverityLevel> = {
    info: 'info',
    warn: 'warning',
    error: 'error',
};

const serializeError = (error: Error | null | undefined): Record<string, unknown> | undefined => {
    if (!error) {
        return undefined;
    }

    return {
        name: error.name,
        message: error.message,
        stack: error.stack,
    };
};

const normalizeContext = (context: LoggerBaseContext | undefined): Record<string, unknown> | undefined => {
    if (!context) {
        return undefined;
    }

    const { error, ...rest } = context;
    const serializedError = serializeError(error);

    if (!serializedError) {
        return rest;
    }

    return {
        ...rest,
        error: serializedError,
    };
};

const captureWithSentry = (
    level: Exclude<LogLevel, 'debug'>,
    message: string,
    context?: LoggerBaseContext
): void => {
    const sentryError = context?.error;

    Sentry.withScope((scope) => {
        scope.setLevel(severityMap[level]);

        if (context?.requestId) {
            scope.setTag('requestId', context.requestId);
        }

        if (context?.route) {
            scope.setTag('route', context.route);
        }

        if (context?.userId) {
            scope.setUser({ id: context.userId });
        }

        if (context?.tags) {
            Object.entries(context.tags).forEach(([key, value]) => {
                scope.setTag(key, value);
            });
        }

        const { error: _error, tags: _tags, ...extras } = context ?? {};
        Object.entries(extras).forEach(([key, value]) => {
            if (value !== undefined) {
                scope.setExtra(key, value);
            }
        });

        if (sentryError) {
            Sentry.captureException(sentryError);
            return;
        }

        Sentry.captureMessage(message, severityMap[level]);
    });
};

const logToConsole = (
    method: ConsoleMethod,
    message: string,
    context?: LoggerBaseContext
): void => {
    const normalizedContext = normalizeContext(context);

    if (method === 'error') {
        if (normalizedContext) {
            console.error(message, normalizedContext);
            return;
        }

        console.error(message);
        return;
    }

    if (normalizedContext) {
        console.warn(message, normalizedContext);
        return;
    }

    console.warn(message);
};

const emitLog = (
    level: LogLevel,
    message: string,
    context?: LoggerBaseContext
): void => {
    if (level === 'debug') {
        logToConsole('warn', message, context);
        return;
    }

    captureWithSentry(level, message, context);
    logToConsole(level === 'error' ? 'error' : 'warn', message, context);
};

export const logger = {
    debug(message: string, context?: LoggerBaseContext): void {
        emitLog('debug', message, context);
    },
    info(message: string, context?: LoggerBaseContext): void {
        emitLog('info', message, context);
    },
    warn(message: string, context?: LoggerBaseContext): void {
        emitLog('warn', message, context);
    },
    error(message: string, context?: LoggerBaseContext): void {
        emitLog('error', message, context);
    },
};

export type { LoggerBaseContext };
