export const createIdempotencyKey = (): string => {
    if (typeof globalThis !== 'undefined' && typeof globalThis.crypto?.randomUUID === 'function') {
        return globalThis.crypto.randomUUID();
    }

    return `idempotency-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};
