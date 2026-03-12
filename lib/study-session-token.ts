import 'server-only';

import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

const STUDY_SESSION_TOKEN_LENGTH = 32;

const encodeHex = (buffer: Buffer): string => buffer.toString('hex');

export const createStudySessionToken = (): string => (
    encodeHex(randomBytes(STUDY_SESSION_TOKEN_LENGTH))
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
