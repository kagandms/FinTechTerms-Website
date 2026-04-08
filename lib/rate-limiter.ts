import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { logger } from '@/lib/logger';

export interface RateLimiterResult {
    allowed: boolean;
    remaining: number;
    retryAfter: number;
    unavailable?: boolean;
}

type DistributedWindow = Parameters<typeof Ratelimit.slidingWindow>[1];

interface AsyncRateLimiter {
    check(key: string): Promise<RateLimiterResult>;
    reset(): void;
}

interface RateLimiterOptions {
    strictInProduction?: boolean;
}

const RATE_LIMITER_UNAVAILABLE_RETRY_AFTER_SECONDS = 60;
const rateLimiterWarnings = new Set<string>();

const isProductionRuntime = (): boolean => process.env.NODE_ENV === 'production';

const logRateLimiterWarningOnce = (warningKey: string, message: string): void => {
    if (rateLimiterWarnings.has(warningKey)) {
        return;
    }

    rateLimiterWarnings.add(warningKey);
    logger.error(message, {
        route: 'rate-limiter',
        retryable: true,
    });
};

class MemoryRateLimiter implements AsyncRateLimiter {
    private timestamps: Map<string, number[]>;
    private limit: number;
    private windowMs: number;
    private cleanupInterval: number;
    private lastCleanup: number;

    constructor(limit: number, windowMs: number) {
        this.timestamps = new Map();
        this.limit = limit;
        this.windowMs = windowMs;
        this.cleanupInterval = 5 * 60 * 1000;
        this.lastCleanup = Date.now();
    }

    async check(key: string): Promise<RateLimiterResult> {
        this.cleanup();

        const now = Date.now();
        const cutoff = now - this.windowMs;
        const history = (this.timestamps.get(key) || []).filter((timestamp) => timestamp > cutoff);

        if (history.length >= this.limit) {
            const oldestInWindow = history[0] ?? now;
            const retryAfter = Math.ceil((oldestInWindow + this.windowMs - now) / 1000);
            return { allowed: false, remaining: 0, retryAfter };
        }

        history.push(now);
        this.timestamps.set(key, history);

        return {
            allowed: true,
            remaining: this.limit - history.length,
            retryAfter: 0,
            unavailable: false,
        };
    }

    reset(): void {
        this.timestamps.clear();
        this.lastCleanup = Date.now();
    }

    private cleanup(): void {
        const now = Date.now();
        if (now - this.lastCleanup < this.cleanupInterval) {
            return;
        }

        this.lastCleanup = now;
        const cutoff = now - this.windowMs;

        for (const [key, history] of this.timestamps.entries()) {
            const valid = history.filter((timestamp) => timestamp > cutoff);
            if (valid.length === 0) {
                this.timestamps.delete(key);
                continue;
            }

            this.timestamps.set(key, valid);
        }
    }
}

class DistributedRateLimiter implements AsyncRateLimiter {
    private readonly ratelimit: Ratelimit;
    private readonly fallback: MemoryRateLimiter;
    private readonly prefix: string;
    private readonly strictInProduction: boolean;

    constructor(
        prefix: string,
        limit: number,
        window: DistributedWindow,
        windowMs: number,
        options: RateLimiterOptions = {}
    ) {
        this.prefix = prefix;
        this.fallback = new MemoryRateLimiter(limit, windowMs);
        this.strictInProduction = options.strictInProduction ?? false;
        this.ratelimit = new Ratelimit({
            redis: new Redis({
                url: process.env.UPSTASH_REDIS_REST_URL!,
                token: process.env.UPSTASH_REDIS_REST_TOKEN!,
            }),
            limiter: Ratelimit.slidingWindow(limit, window),
            analytics: true,
            prefix,
        });
    }

    async check(key: string): Promise<RateLimiterResult> {
        try {
            const result = await this.ratelimit.limit(`${this.prefix}:${key}`);
            const retryAfter = result.success
                ? 0
                : Math.max(1, Math.ceil((result.reset - Date.now()) / 1000));

            return {
                allowed: result.success,
                remaining: result.remaining,
                retryAfter,
                unavailable: false,
            };
        } catch {
            if (this.strictInProduction && isProductionRuntime()) {
                logRateLimiterWarningOnce(
                    `${this.prefix}:runtime-unavailable`,
                    'RATE_LIMITER_RUNTIME_UNAVAILABLE'
                );
                return {
                    allowed: false,
                    remaining: 0,
                    retryAfter: RATE_LIMITER_UNAVAILABLE_RETRY_AFTER_SECONDS,
                    unavailable: true,
                };
            }

            return await this.fallback.check(key);
        }
    }

    reset(): void {
        this.fallback.reset();
    }
}

class UnavailableRateLimiter implements AsyncRateLimiter {
    private readonly prefix: string;

    constructor(prefix: string) {
        this.prefix = prefix;
    }

    async check(): Promise<RateLimiterResult> {
        logRateLimiterWarningOnce(
            `${this.prefix}:config-unavailable`,
            'RATE_LIMITER_CONFIG_UNAVAILABLE'
        );

        return {
            allowed: false,
            remaining: 0,
            retryAfter: RATE_LIMITER_UNAVAILABLE_RETRY_AFTER_SECONDS,
            unavailable: true,
        };
    }

    reset(): void {}
}

const hasUpstashConfig = (): boolean => (
    typeof process.env.UPSTASH_REDIS_REST_URL === 'string'
    && process.env.UPSTASH_REDIS_REST_URL.trim().length > 0
    && typeof process.env.UPSTASH_REDIS_REST_TOKEN === 'string'
    && process.env.UPSTASH_REDIS_REST_TOKEN.trim().length > 0
);

const createRateLimiter = (
    prefix: string,
    limit: number,
    windowMs: number,
    distributedWindow: DistributedWindow,
    options: RateLimiterOptions = {}
): AsyncRateLimiter => {
    if (hasUpstashConfig()) {
        return new DistributedRateLimiter(prefix, limit, distributedWindow, windowMs, options);
    }

    if (options.strictInProduction && isProductionRuntime()) {
        return new UnavailableRateLimiter(prefix);
    }

    return new MemoryRateLimiter(limit, windowMs);
};

export const apiRouteRateLimiter = createRateLimiter('api-route', 100, 60000, '60 s', {
    strictInProduction: true,
});
export const quizMutationRateLimiter = createRateLimiter('quiz-write', 20, 10000, '10 s', {
    strictInProduction: true,
});
export const favoritesMutationRateLimiter = createRateLimiter('favorite-write', 10, 10000, '10 s', {
    strictInProduction: true,
});
export const profileMutationRateLimiter = createRateLimiter('profile-write', 10, 10 * 60 * 1000, '10 m', {
    strictInProduction: true,
});
export const studySessionRouteRateLimiter = createRateLimiter('study-session', 30, 60000, '60 s', {
    strictInProduction: true,
});
export const aiAssistantRouteRateLimiter = createRateLimiter('ai-assistant', 12, 60000, '60 s', {
    strictInProduction: true,
});
export const aiCoachRouteRateLimiter = createRateLimiter('ai-coach', 6, 60000, '60 s', {
    strictInProduction: true,
});
export const analyticsExportRouteRateLimiter = createRateLimiter('analytics-export', 12, 60000, '60 s', {
    strictInProduction: true,
});
export const analyticsExportDownloadRateLimiter = createRateLimiter('analytics-export-download', 2, 60000, '60 s', {
    strictInProduction: true,
});
export const telegramLinkRateLimiter = createRateLimiter('telegram-link', 5, 10 * 60 * 1000, '10 m');
export const authLoginRateLimiter = createRateLimiter('auth-login', 10, 10 * 60 * 1000, '10 m', {
    strictInProduction: true,
});
export const authSignupRateLimiter = createRateLimiter('auth-signup', 5, 10 * 60 * 1000, '10 m', {
    strictInProduction: true,
});
export const authResetPasswordRateLimiter = createRateLimiter('auth-reset-password', 5, 10 * 60 * 1000, '10 m', {
    strictInProduction: true,
});
export const authResendOtpRateLimiter = createRateLimiter('auth-resend-otp', 5, 10 * 60 * 1000, '10 m', {
    strictInProduction: true,
});
export const authVerifyOtpRateLimiter = createRateLimiter('auth-verify-otp', 10, 10 * 60 * 1000, '10 m', {
    strictInProduction: true,
});

export const globalRateLimiter = apiRouteRateLimiter;

export const isRateLimiterUnavailable = (result: RateLimiterResult): boolean =>
    result.unavailable === true;
