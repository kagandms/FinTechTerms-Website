import { getLocalizedAuthError, getSafeAuthErrorCode } from '@/lib/auth/error-messages';

describe('auth error messages', () => {
    it('maps known provider errors to stable codes', () => {
        expect(getSafeAuthErrorCode('Invalid login credentials')).toBe('INVALID_CREDENTIALS');
        expect(getSafeAuthErrorCode('Token has expired or is invalid')).toBe('OTP_INVALID_OR_EXPIRED');
        expect(getSafeAuthErrorCode('Rate limit exceeded')).toBe('RATE_LIMITED');
    });

    it('falls back to a generic localized message for unknown errors', () => {
        expect(getLocalizedAuthError('Unexpected upstream failure: db-123', 'en')).toBe(
            'The request could not be completed right now. Please try again.'
        );
        expect(getLocalizedAuthError('Unexpected upstream failure: db-123', 'tr')).toBe(
            'İstek şu anda tamamlanamadı. Lütfen tekrar deneyin.'
        );
    });
});
