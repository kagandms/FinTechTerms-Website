import React, { useEffect, useRef, useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { OTPVerificationProps } from './types';
import { EMAIL_OTP_LENGTH, isValidEmailOtp } from '@/lib/auth/constants';

export const OTPVerification: React.FC<OTPVerificationProps> = ({
    otpCode, setOtpCode, authError, setAuthError, verifyOTP,
    pendingVerificationEmail, resendOTP, resendCooldown, startCooldown,
    onClose, language, showToast
}) => {
    const [isVerifying, setIsVerifying] = useState(false);
    const [isResending, setIsResending] = useState(false);
    const inputRefs = useRef<Array<HTMLInputElement | null>>([]);

    const title = language === 'tr' ? 'E-posta Doğrulama'
        : language === 'ru' ? 'Подтверждение e-mail'
            : 'Email Verification';

    const description = language === 'tr'
        ? `Lütfen e-postanıza gelen ${EMAIL_OTP_LENGTH} haneli kodu girin:`
        : language === 'ru'
            ? `Введите ${EMAIL_OTP_LENGTH}-значный код, отправленный на вашу почту:`
            : `Enter the ${EMAIL_OTP_LENGTH}-digit code sent to your email:`;

    const verifyLabel = language === 'tr' ? 'Doğrula'
        : language === 'ru' ? 'Подтвердить'
            : 'Verify';

    const codeError = language === 'tr'
        ? `${EMAIL_OTP_LENGTH} haneli doğrulama kodunu girin`
        : language === 'ru'
            ? `Введите ${EMAIL_OTP_LENGTH}-значный код`
            : `Enter a ${EMAIL_OTP_LENGTH}-digit code`;

    const resendLabel = resendCooldown > 0
        ? (language === 'tr' ? `Tekrar gönder (${resendCooldown}s)` : language === 'ru' ? `Отправить снова (${resendCooldown}с)` : `Resend (${resendCooldown}s)`)
        : (language === 'tr' ? 'Kodu Tekrar Gönder' : language === 'ru' ? 'Отправить код снова' : 'Resend Code');

    const codeSent = language === 'tr' ? '✅ Yeni doğrulama kodu gönderildi!' : language === 'ru' ? '✅ Новый код отправлен!' : '✅ New code sent!';
    const otpSuccess = language === 'tr' ? 'Kod doğrulandı.' : language === 'ru' ? 'Код подтвержден.' : 'Code verified.';
    const otpUnexpected = language === 'tr' ? 'Doğrulama sırasında beklenmeyen hata oluştu.' : language === 'ru' ? 'Непредвиденная ошибка при подтверждении.' : 'Unexpected verification error.';

    const emptyCode = () => Array.from({ length: EMAIL_OTP_LENGTH }, () => '');
    const [codeChars, setCodeChars] = useState<string[]>(
        Array.from({ length: EMAIL_OTP_LENGTH }, (_, i) => otpCode[i] || '')
    );

    useEffect(() => {
        if (!otpCode) {
            setCodeChars(emptyCode());
        }
    }, [otpCode]);

    useEffect(() => {
        if (!pendingVerificationEmail) {
            setIsVerifying(false);
        }
    }, [pendingVerificationEmail]);

    const normalizedCode = codeChars.join('');

    const updateCode = (index: number, nextChar: string) => {
        const nextDigits = [...codeChars];
        nextDigits[index] = nextChar;
        setCodeChars(nextDigits);
        setOtpCode(nextDigits.join(''));
        setAuthError('');
    };

    const handleDigitChange = (index: number, value: string) => {
        const digit = value.replace(/\D/g, '').slice(-1);
        updateCode(index, digit);

        if (digit && index < EMAIL_OTP_LENGTH - 1) {
            inputRefs.current[index + 1]?.focus();
        }
    };

    const handleKeyDown = (index: number, event: React.KeyboardEvent<HTMLInputElement>) => {
        if (event.key === 'Backspace' && !codeChars[index] && index > 0) {
            inputRefs.current[index - 1]?.focus();
        }

        if (event.key === 'ArrowLeft' && index > 0) {
            inputRefs.current[index - 1]?.focus();
        }

        if (event.key === 'ArrowRight' && index < EMAIL_OTP_LENGTH - 1) {
            inputRefs.current[index + 1]?.focus();
        }
    };

    const handlePaste = (event: React.ClipboardEvent<HTMLInputElement>) => {
        event.preventDefault();
        const pasted = event.clipboardData.getData('text').replace(/\D/g, '').slice(0, EMAIL_OTP_LENGTH);
        if (!pasted) return;

        const next = Array.from({ length: EMAIL_OTP_LENGTH }, (_, i) => pasted[i] || '');
        setCodeChars(next);
        setOtpCode(next.join(''));
        setAuthError('');
        inputRefs.current[Math.min(pasted.length, EMAIL_OTP_LENGTH) - 1]?.focus();
    };

    const handleVerify = async () => {
        if (!pendingVerificationEmail) {
            const msg = language === 'tr' ? 'Doğrulama e-postası bulunamadı.' : language === 'ru' ? 'E-mail для подтверждения не найден.' : 'Verification email not found.';
            setAuthError(msg);
            showToast(msg, 'error');
            return;
        }

        if (!isValidEmailOtp(normalizedCode)) {
            setAuthError(codeError);
            showToast(codeError, 'error');
            return;
        }

        setIsVerifying(true);
        setAuthError('');

        try {
            const res = await verifyOTP(pendingVerificationEmail, normalizedCode);

            if (!res.success) {
                const msg = res.error || (language === 'tr' ? 'Geçersiz kod' : language === 'ru' ? 'Неверный код' : 'Invalid code');
                setAuthError(msg);
                showToast(msg, 'error');
                return;
            }

            showToast(otpSuccess, 'success');
            setAuthError('');
            setCodeChars(emptyCode());
            setOtpCode('');
            await Promise.resolve(onClose());
        } catch (error: any) {
            const msg = error?.message || otpUnexpected;
            setAuthError(msg);
            showToast(msg, 'error');
        } finally {
            setIsVerifying(false);
        }
    };

    const handleResend = async () => {
        if (resendCooldown > 0 || isResending) return;

        if (!pendingVerificationEmail) {
            const msg = language === 'tr' ? 'Doğrulama e-postası bulunamadı.' : language === 'ru' ? 'E-mail для подтверждения не найден.' : 'Verification email not found.';
            setAuthError(msg);
            showToast(msg, 'error');
            return;
        }

        setIsResending(true);
        setAuthError('');

        try {
            const res = await resendOTP(pendingVerificationEmail);
            if (!res.success) {
                const msg = res.error || (language === 'tr' ? 'Kod gönderilemedi.' : language === 'ru' ? 'Не удалось отправить код.' : 'Failed to send code.');
                setAuthError(msg);
                showToast(msg, 'error');
                return;
            }

            setOtpCode('');
            setCodeChars(emptyCode());
            startCooldown();
            showToast(codeSent, 'success');
        } catch (error: any) {
            const msg = error?.message || (language === 'tr' ? 'Kod gönderilirken hata oluştu.' : language === 'ru' ? 'Ошибка при отправке кода.' : 'Error sending code.');
            setAuthError(msg);
            showToast(msg, 'error');
        } finally {
            setIsResending(false);
        }
    };

    return (
        <>
            <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 bg-primary-100 dark:bg-primary-900/30 rounded-full flex items-center justify-center">
                    <ShieldCheck className="w-5 h-5 text-primary-500" />
                </div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                    {title}
                </h3>
            </div>

            <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                {description}
            </p>
            <p className="text-sm font-medium text-primary-500 dark:text-white mb-4 truncate">
                {pendingVerificationEmail}
            </p>

            <div className="space-y-4">
                <div className="grid grid-cols-6 gap-2">
                    {codeChars.map((digit, index) => (
                        <input
                            key={`otp-${index}`}
                            ref={(el) => {
                                inputRefs.current[index] = el;
                            }}
                            type="text"
                            inputMode="numeric"
                            autoComplete="one-time-code"
                            maxLength={1}
                            value={digit}
                            onChange={(e) => handleDigitChange(index, e.target.value)}
                            onKeyDown={(e) => handleKeyDown(index, e)}
                            onPaste={handlePaste}
                            className="h-12 w-full rounded-xl border border-gray-200 text-center text-xl font-semibold dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 outline-none transition-all"
                            disabled={isVerifying || isResending}
                            autoFocus={index === 0}
                            aria-label={`${index + 1}. OTP digit`}
                        />
                    ))}
                </div>

                {authError && <p className="text-sm text-red-500 text-center">{authError}</p>}

                <button
                    onClick={handleVerify}
                    disabled={isVerifying || isResending}
                    className="w-full py-3 bg-primary-500 text-white font-semibold rounded-xl hover:bg-primary-600 active:scale-[0.98] transition-all shadow-md shadow-primary-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                >
                    {isVerifying
                        ? (language === 'tr' ? 'Doğrulanıyor...' : language === 'ru' ? 'Проверка...' : 'Verifying...')
                        : verifyLabel}
                </button>

                <button
                    onClick={handleResend}
                    disabled={resendCooldown > 0 || isResending || isVerifying}
                    className="w-full text-sm text-gray-500 dark:text-gray-300 hover:text-gray-700 dark:hover:text-white transition-colors disabled:opacity-50"
                >
                    {isResending
                        ? (language === 'tr' ? 'Gönderiliyor...' : language === 'ru' ? 'Отправка...' : 'Sending...')
                        : resendLabel}
                </button>
            </div>
        </>
    );
};
