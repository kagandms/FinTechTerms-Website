/**
 * In-Memory Rate Limiter with Sliding Window
 * 
 * Note: specific to serverless environments, this has limitations as memory 
 * is not shared between lambdas. For scale, use Redis (@upstash/ratelimit).
 * This implementation is a robust fallback for single-instance or low-scale deployments.
 */
export class RateLimiter {
    private timestamps: Map<string, number[]>;
    private limit: number;
    private windowMs: number;
    private cleanupInterval: number;
    private lastCleanup: number;

    constructor(limit: number, windowMs: number) {
        this.timestamps = new Map();
        this.limit = limit;
        this.windowMs = windowMs;
        this.cleanupInterval = 5 * 60 * 1000; // 5 minutes
        this.lastCleanup = Date.now();
    }

    /**
     * Check if the request is allowed
     *Returns { allowed: boolean, remaining: number, retryAfter: number }
     */
    public check(key: string): { allowed: boolean; remaining: number; retryAfter: number } {
        this.cleanup();

        const now = Date.now();
        const cutoff = now - this.windowMs;
        const history = (this.timestamps.get(key) || []).filter(t => t > cutoff);

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
            retryAfter: 0
        };
    }

    private cleanup() {
        const now = Date.now();
        if (now - this.lastCleanup < this.cleanupInterval) return;

        this.lastCleanup = now;
        const cutoff = now - this.windowMs;

        for (const [key, history] of this.timestamps.entries()) {
            const valid = history.filter(t => t > cutoff);
            if (valid.length === 0) {
                this.timestamps.delete(key);
            } else {
                this.timestamps.set(key, valid);
            }
        }
    }
}

// Singleton export for shared state (within same lambda instance)
export const globalRateLimiter = new RateLimiter(100, 60000); // 100 req/min
