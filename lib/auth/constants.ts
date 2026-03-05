export const EMAIL_OTP_LENGTH = 6;
export const EMAIL_OTP_REGEX = /^\d{6}$/;

export function isValidEmailOtp(code: string): boolean {
    return EMAIL_OTP_REGEX.test(code);
}
