type SafeAuthErrorCode =
    | 'INVALID_CREDENTIALS'
    | 'EMAIL_NOT_CONFIRMED'
    | 'EMAIL_ALREADY_REGISTERED'
    | 'OTP_INVALID_OR_EXPIRED'
    | 'WEAK_PASSWORD'
    | 'RATE_LIMITED'
    | 'RATE_LIMITER_UNAVAILABLE'
    | 'AUTH_UNAVAILABLE'
    | 'AUTH_SERVICE_ERROR'
    | 'REQUEST_BLOCKED'
    | 'SESSION_EXPIRED'
    | 'NAVIGATION_FAILED'
    | 'VALIDATION_ERROR'
    | 'SIGNUP_FAILED'
    | 'GENERIC';

const exactCodeMap: Readonly<Record<string, SafeAuthErrorCode>> = {
    invalid_credentials: 'INVALID_CREDENTIALS',
    validation_error: 'VALIDATION_ERROR',
    email_not_confirmed: 'EMAIL_NOT_CONFIRMED',
    email_already_registered: 'EMAIL_ALREADY_REGISTERED',
    otp_invalid_or_expired: 'OTP_INVALID_OR_EXPIRED',
    weak_password: 'WEAK_PASSWORD',
    rate_limited: 'RATE_LIMITED',
    rate_limiter_unavailable: 'RATE_LIMITER_UNAVAILABLE',
    auth_unavailable: 'AUTH_UNAVAILABLE',
    auth_signup_failed: 'AUTH_SERVICE_ERROR',
    auth_service_error: 'AUTH_SERVICE_ERROR',
    invalid_origin: 'REQUEST_BLOCKED',
    session_expired: 'SESSION_EXPIRED',
    navigation_failed: 'NAVIGATION_FAILED',
    signup_failed: 'SIGNUP_FAILED',
    generic: 'GENERIC',
};

interface ProviderErrorPattern {
    readonly code: SafeAuthErrorCode;
    readonly fragments: readonly string[];
}

const providerErrorPatterns: readonly ProviderErrorPattern[] = [
    { code: 'INVALID_CREDENTIALS', fragments: ['invalid login credentials'] },
    { code: 'EMAIL_NOT_CONFIRMED', fragments: ['email not confirmed'] },
    {
        code: 'EMAIL_ALREADY_REGISTERED',
        fragments: ['already registered', 'user already registered'],
    },
    {
        code: 'OTP_INVALID_OR_EXPIRED',
        fragments: ['token has expired', 'invalid token', 'otp'],
    },
    { code: 'WEAK_PASSWORD', fragments: ['password should be at least', 'weak password'] },
    { code: 'RATE_LIMITED', fragments: ['rate limit'] },
    { code: 'RATE_LIMITER_UNAVAILABLE', fragments: ['temporarily unavailable'] },
    { code: 'SIGNUP_FAILED', fragments: ['unable to validate email', 'signups not allowed'] },
    {
        code: 'AUTH_SERVICE_ERROR',
        fragments: [
            'database error saving new user',
            'error saving new user',
            'unexpected_failure',
        ],
    },
    {
        code: 'SESSION_EXPIRED',
        fragments: ['session expired', 'auth session missing', 'refresh token', 'jwt expired'],
    },
    { code: 'NAVIGATION_FAILED', fragments: ['navigation failed'] },
    { code: 'REQUEST_BLOCKED', fragments: ['cross-origin requests are not allowed'] },
];

const normalizeMessage = (error: unknown): string => {
    if (typeof error === 'string') {
        return error.trim();
    }

    if (
        error
        && typeof error === 'object'
        && 'message' in error
        && typeof error.message === 'string'
    ) {
        return error.message.trim();
    }

    return '';
};

const getExactCode = (message: string): SafeAuthErrorCode | null => {
    const separatorIndex = message.indexOf('::');
    const token = separatorIndex === -1
        ? message
        : message.slice(0, separatorIndex);

    return exactCodeMap[token] ?? null;
};

const includesAnyFragment = (message: string, fragments: readonly string[]): boolean => (
    fragments.some((fragment) => message.includes(fragment))
);

const getProviderErrorCode = (message: string): SafeAuthErrorCode | null => (
    providerErrorPatterns.find((pattern) => includesAnyFragment(message, pattern.fragments))?.code ?? null
);

const getSafeAuthErrorCode = (error: unknown): SafeAuthErrorCode => {
    const message = normalizeMessage(error).toLowerCase();

    if (!message) {
        return 'GENERIC';
    }

    const exactCode = getExactCode(message);
    if (exactCode && exactCode !== 'GENERIC') {
        return exactCode;
    }

    return getProviderErrorCode(message) ?? exactCode ?? 'GENERIC';
};

const localizedMessages: Record<'tr' | 'en' | 'ru', Record<SafeAuthErrorCode, string>> = {
    tr: {
        INVALID_CREDENTIALS: 'E-posta veya şifre hatalı.',
        EMAIL_NOT_CONFIRMED: 'E-posta adresi henüz doğrulanmadı.',
        EMAIL_ALREADY_REGISTERED: 'Bu e-posta adresi zaten kayıtlı.',
        OTP_INVALID_OR_EXPIRED: 'Girdiğiniz kod hatalı veya süresi dolmuş.',
        WEAK_PASSWORD: 'Şifre daha güçlü olmalıdır.',
        RATE_LIMITED: 'Çok fazla deneme yaptınız. Lütfen biraz bekleyin.',
        RATE_LIMITER_UNAVAILABLE: 'Kimlik doğrulama servisi geçici olarak kullanılamıyor. Lütfen birkaç dakika sonra tekrar deneyin.',
        AUTH_UNAVAILABLE: 'Kimlik doğrulama servisi geçici olarak kullanılamıyor. Lütfen birkaç dakika sonra tekrar deneyin.',
        AUTH_SERVICE_ERROR: 'Kayıt servisi şu anda isteği tamamlayamadı. Lütfen biraz sonra tekrar deneyin.',
        REQUEST_BLOCKED: 'Güvenlik nedeniyle istek engellendi. Sayfayı yenileyip tekrar deneyin.',
        SESSION_EXPIRED: 'Oturum süresi doldu. Lütfen tekrar deneyin.',
        NAVIGATION_FAILED: 'Yönlendirme tamamlanamadı. Lütfen tekrar deneyin.',
        VALIDATION_ERROR: 'Lütfen bilgilerinizi kontrol edip tekrar deneyin.',
        SIGNUP_FAILED: 'Kayıt işlemi başarısız oldu. Lütfen bilgilerinizi kontrol edip tekrar deneyin.',
        GENERIC: 'İstek şu anda tamamlanamadı. Lütfen tekrar deneyin.',
    },
    en: {
        INVALID_CREDENTIALS: 'Invalid email or password.',
        EMAIL_NOT_CONFIRMED: 'Email address not confirmed.',
        EMAIL_ALREADY_REGISTERED: 'This email is already registered.',
        OTP_INVALID_OR_EXPIRED: 'The code is invalid or has expired.',
        WEAK_PASSWORD: 'Password should be stronger.',
        RATE_LIMITED: 'Too many attempts. Please wait.',
        RATE_LIMITER_UNAVAILABLE: 'Authentication service is temporarily unavailable. Please try again in a few minutes.',
        AUTH_UNAVAILABLE: 'Authentication service is temporarily unavailable. Please try again in a few minutes.',
        AUTH_SERVICE_ERROR: 'Registration service could not complete this request. Please try again shortly.',
        REQUEST_BLOCKED: 'The request was blocked for security. Refresh the page and try again.',
        SESSION_EXPIRED: 'Session expired. Please try again.',
        NAVIGATION_FAILED: 'Navigation could not be completed. Please try again.',
        VALIDATION_ERROR: 'Please check your information and try again.',
        SIGNUP_FAILED: 'Sign-up failed. Please check your information and try again.',
        GENERIC: 'The request could not be completed right now. Please try again.',
    },
    ru: {
        INVALID_CREDENTIALS: 'Неверный e-mail или пароль.',
        EMAIL_NOT_CONFIRMED: 'E-mail адрес не подтвержден.',
        EMAIL_ALREADY_REGISTERED: 'Этот e-mail уже зарегистрирован.',
        OTP_INVALID_OR_EXPIRED: 'Введенный код неверен или истек его срок действия.',
        WEAK_PASSWORD: 'Пароль должен быть надежнее.',
        RATE_LIMITED: 'Слишком много попыток. Пожалуйста, подождите.',
        RATE_LIMITER_UNAVAILABLE: 'Служба аутентификации временно недоступна. Повторите попытку через несколько минут.',
        AUTH_UNAVAILABLE: 'Служба аутентификации временно недоступна. Повторите попытку через несколько минут.',
        AUTH_SERVICE_ERROR: 'Служба регистрации не смогла выполнить запрос. Повторите попытку немного позже.',
        REQUEST_BLOCKED: 'Запрос был заблокирован из соображений безопасности. Обновите страницу и повторите попытку.',
        SESSION_EXPIRED: 'Сессия истекла. Повторите попытку.',
        NAVIGATION_FAILED: 'Не удалось выполнить переход. Повторите попытку.',
        VALIDATION_ERROR: 'Пожалуйста, проверьте свои данные и повторите попытку.',
        SIGNUP_FAILED: 'Регистрация не удалась. Пожалуйста, проверьте свои данные и повторите попытку.',
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
