import 'server-only';

import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { getServerEnv } from '@/lib/env';

const TEST_STUDY_SESSION_TOKEN_SECRET = 'test-study-session-token-secret';

const normalizeTokenPart = (
    value: string,
    fieldName: string
): string => {
    const normalizedValue = value.trim();

    if (normalizedValue.length === 0) {
        throw new Error(`${fieldName} is required to generate a study-session token.`);
    }

    return normalizedValue;
};

const getStudySessionTokenSecret = (): string => {
    const env = getServerEnv();

    if (env.studySessionTokenSecret) {
        return env.studySessionTokenSecret;
    }

    if (process.env.NODE_ENV === 'test') {
        return TEST_STUDY_SESSION_TOKEN_SECRET;
    }

    throw new Error(
        'Study session token generation requires STUDY_SESSION_TOKEN_SECRET.'
    );
};

export const createStudySessionToken = (
    sessionId: string,
    idempotencyKey: string
): string => (
    createHmac('sha256', getStudySessionTokenSecret())
        .update([
            normalizeTokenPart(sessionId, 'sessionId'),
            normalizeTokenPart(idempotencyKey, 'idempotencyKey'),
        ].join(':'))
        .digest('base64url')
);

export const hashStudySessionToken = (token: string): string => createHash('sha256')
    .update(token)
    .digest('hex');

export const isStudySessionTokenMatch = (
    expectedHash: string | null | undefined,
    providedToken: string | null | undefined
): boolean => {
    if (!expectedHash || !providedToken) {
        return false;
    }

    const expectedBuffer = Buffer.from(expectedHash, 'hex');
    const providedBuffer = Buffer.from(hashStudySessionToken(providedToken), 'hex');

    if (expectedBuffer.length !== providedBuffer.length) {
        return false;
    }

    return timingSafeEqual(expectedBuffer, providedBuffer);
};
