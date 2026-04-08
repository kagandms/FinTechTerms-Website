type SafeAuthErrorCode =
    | 'INVALID_CREDENTIALS'
    | 'EMAIL_NOT_CONFIRMED'
    | 'EMAIL_ALREADY_REGISTERED'
    | 'OTP_INVALID_OR_EXPIRED'
    | 'WEAK_PASSWORD'
    | 'RATE_LIMITED'
    | 'SESSION_EXPIRED'
    | 'NAVIGATION_FAILED'
    | 'GENERIC';

const normalizeMessage = (error: unknown): string => {
    if (typeof error === 'string') {
        return error.trim();
    }

    if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') {
        return error.message.trim();
    }

    return '';
};

const getSafeAuthErrorCode = (error: unknown): SafeAuthErrorCode => {
    const message = normalizeMessage(error).toLowerCase();

    if (!message) {
        return 'GENERIC';
    }

    if (message === 'invalid_credentials') {
        return 'INVALID_CREDENTIALS';
    }

    if (message === 'email_not_confirmed') {
        return 'EMAIL_NOT_CONFIRMED';
    }

    if (message === 'email_already_registered') {
        return 'EMAIL_ALREADY_REGISTERED';
    }

    if (message === 'otp_invalid_or_expired') {
        return 'OTP_INVALID_OR_EXPIRED';
    }

    if (message === 'weak_password') {
        return 'WEAK_PASSWORD';
    }

    if (message === 'rate_limited') {
        return 'RATE_LIMITED';
    }

    if (message === 'session_expired') {
        return 'SESSION_EXPIRED';
    }

    if (message === 'navigation_failed') {
        return 'NAVIGATION_FAILED';
    }

    if (message.includes('invalid login credentials')) {
        return 'INVALID_CREDENTIALS';
    }

    if (message.includes('email not confirmed')) {
        return 'EMAIL_NOT_CONFIRMED';
    }

    if (
        message.includes('already registered')
        || message.includes('user already registered')
    ) {
        return 'EMAIL_ALREADY_REGISTERED';
    }

    if (
        message.includes('token has expired')
        || message.includes('invalid token')
        || message.includes('otp')
    ) {
        return 'OTP_INVALID_OR_EXPIRED';
    }

    if (
        message.includes('password should be at least')
        || message.includes('weak password')
    ) {
        return 'WEAK_PASSWORD';
    }

    if (message.includes('rate limit')) {
        return 'RATE_LIMITED';
    }

    if (
        message.includes('session expired')
        || message.includes('auth session missing')
        || message.includes('refresh token')
        || message.includes('jwt expired')
    ) {
        return 'SESSION_EXPIRED';
    }

    if (message.includes('navigation failed')) {
        return 'NAVIGATION_FAILED';
    }

    return 'GENERIC';
};

const localizedMessages: Record<'tr' | 'en' | 'ru', Record<SafeAuthErrorCode, string>> = {
    tr: {
        INVALID_CREDENTIALS: 'E-posta veya şifre hatalı.',
        EMAIL_NOT_CONFIRMED: 'E-posta adresi henüz doğrulanmadı.',
        EMAIL_ALREADY_REGISTERED: 'Bu e-posta adresi zaten kayıtlı.',
        OTP_INVALID_OR_EXPIRED: 'Girdiğiniz kod hatalı veya süresi dolmuş.',
        WEAK_PASSWORD: 'Şifre daha güçlü olmalıdır.',
        RATE_LIMITED: 'Çok fazla deneme yaptınız. Lütfen biraz bekleyin.',
        SESSION_EXPIRED: 'Oturum süresi doldu. Lütfen tekrar deneyin.',
        NAVIGATION_FAILED: 'Yönlendirme tamamlanamadı. Lütfen tekrar deneyin.',
        GENERIC: 'İstek şu anda tamamlanamadı. Lütfen tekrar deneyin.',
    },
    en: {
        INVALID_CREDENTIALS: 'Invalid email or password.',
        EMAIL_NOT_CONFIRMED: 'Email address not confirmed.',
        EMAIL_ALREADY_REGISTERED: 'This email is already registered.',
        OTP_INVALID_OR_EXPIRED: 'The code is invalid or has expired.',
        WEAK_PASSWORD: 'Password should be stronger.',
        RATE_LIMITED: 'Too many attempts. Please wait.',
        SESSION_EXPIRED: 'Session expired. Please try again.',
        NAVIGATION_FAILED: 'Navigation could not be completed. Please try again.',
        GENERIC: 'The request could not be completed right now. Please try again.',
    },
    ru: {
        INVALID_CREDENTIALS: 'Неверный e-mail или пароль.',
        EMAIL_NOT_CONFIRMED: 'E-mail адрес не подтвержден.',
        EMAIL_ALREADY_REGISTERED: 'Этот e-mail уже зарегистрирован.',
        OTP_INVALID_OR_EXPIRED: 'Введенный код неверен или истек его срок действия.',
        WEAK_PASSWORD: 'Пароль должен быть надежнее.',
        RATE_LIMITED: 'Слишком много попыток. Пожалуйста, подождите.',
        SESSION_EXPIRED: 'Сессия истекла. Повторите попытку.',
        NAVIGATION_FAILED: 'Не удалось выполнить переход. Повторите попытку.',
        GENERIC: 'Сейчас не удалось выполнить запрос. Попробуйте еще раз.',
    },
};

const normalizeLanguage = (language: string): 'tr' | 'en' | 'ru' => {
    if (['tr', 'en', 'ru'].includes(language)) {
        return language as 'tr' | 'en' | 'ru';
    }

    return 'en';
};

export const getLocalizedAuthError = (
    error: unknown,
    language: string
): string => {
    const safeLanguage = normalizeLanguage(language);
    const errorCode = getSafeAuthErrorCode(error);
    return localizedMessages[safeLanguage][errorCode];
};

export { getSafeAuthErrorCode };
