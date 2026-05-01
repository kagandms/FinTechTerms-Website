export const PASSWORD_RECOVERY_COOKIE_NAME = 'ftt_password_recovery';
export const PASSWORD_RECOVERY_COOKIE_MAX_AGE_SECONDS = 15 * 60;

interface PasswordRecoveryCookieOptions {
    readonly httpOnly: boolean;
    readonly maxAge: number;
    readonly path: string;
    readonly sameSite: 'lax';
    readonly secure: boolean;
}

/**
 * Returns the short-lived marker cookie used to distinguish reset-token flows from profile edits.
 */
export const getPasswordRecoveryCookieOptions = (): PasswordRecoveryCookieOptions => ({
    httpOnly: true,
    maxAge: PASSWORD_RECOVERY_COOKIE_MAX_AGE_SECONDS,
    path: '/',
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
});

/**
 * Returns an expired marker cookie so successful password updates close the reset-token window.
 */
export const getExpiredPasswordRecoveryCookieOptions = (): PasswordRecoveryCookieOptions => ({
    ...getPasswordRecoveryCookieOptions(),
    maxAge: 0,
});
