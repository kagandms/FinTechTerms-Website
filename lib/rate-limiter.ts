import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

interface RateLimiterResult {
    allowed: boolean;
    remaining: number;
    retryAfter: number;
}

type DistributedWindow = Parameters<typeof Ratelimit.slidingWindow>[1];

interface AsyncRateLimiter {
    check(key: string): Promise<RateLimiterResult>;
    reset(): void;
}

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

    constructor(prefix: string, limit: number, window: DistributedWindow, windowMs: number) {
        this.prefix = prefix;
        this.fallback = new MemoryRateLimiter(limit, windowMs);
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
            };
        } catch {
            return await this.fallback.check(key);
        }
    }

    reset(): void {
        this.fallback.reset();
    }
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
    distributedWindow: DistributedWindow
): AsyncRateLimiter => (
    hasUpstashConfig()
        ? new DistributedRateLimiter(prefix, limit, distributedWindow, windowMs)
        : new MemoryRateLimiter(limit, windowMs)
);

export const apiRouteRateLimiter = createRateLimiter('api-route', 100, 60000, '60 s');
export const quizMutationRateLimiter = createRateLimiter('quiz-write', 20, 10000, '10 s');
export const favoritesMutationRateLimiter = createRateLimiter('favorite-write', 10, 10000, '10 s');
export const studySessionRouteRateLimiter = createRateLimiter('study-session', 30, 60000, '60 s');
export const telegramLinkRateLimiter = createRateLimiter('telegram-link', 5, 10 * 60 * 1000, '10 m');

export const globalRateLimiter = apiRouteRateLimiter;
