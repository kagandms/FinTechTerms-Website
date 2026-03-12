export type SafeUserError = { code: string; message: string };

const SAFE_MESSAGES: Record<string, string> = {
    '23505': 'This username is already taken. Please choose another.',
    '23514': 'The value you entered is not allowed.',
    '42501': 'You do not have permission to perform this action.',
};

export function toSafeUserError(raw: unknown): SafeUserError {
    if (typeof raw === 'object' && raw !== null && 'code' in raw && typeof raw.code === 'string') {
        return {
            code: raw.code,
            message: SAFE_MESSAGES[raw.code] ?? 'Something went wrong. Please try again.',
        };
    }

    return {
        code: 'UNKNOWN',
        message: 'Something went wrong. Please try again.',
    };
}
