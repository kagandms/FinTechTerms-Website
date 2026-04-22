import { getLocalizedAuthError, getSafeAuthErrorCode } from '@/lib/auth/error-messages';

describe('auth error messages', () => {
    it('maps known provider errors to stable codes', () => {
        expect(getSafeAuthErrorCode('Invalid login credentials')).toBe('INVALID_CREDENTIALS');
        expect(getSafeAuthErrorCode('Token has expired or is invalid')).toBe('OTP_INVALID_OR_EXPIRED');
        expect(getSafeAuthErrorCode('Rate limit exceeded')).toBe('RATE_LIMITED');
        expect(getSafeAuthErrorCode('EMAIL_ALREADY_REGISTERED')).toBe('EMAIL_ALREADY_REGISTERED');
        expect(getSafeAuthErrorCode('GENERIC::Database error saving new user')).toBe('AUTH_SERVICE_ERROR');
    });

    it('localizes protected request and auth service failures', () => {
        expect(getLocalizedAuthError('INVALID_ORIGIN', 'en')).toBe(
            'The request was blocked for security. Refresh the page and try again.'
        );
        expect(getLocalizedAuthError('AUTH_SERVICE_ERROR', 'tr')).toBe(
            'Kayıt servisi şu anda isteği tamamlayamadı. Lütfen biraz sonra tekrar deneyin.'
        );
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
