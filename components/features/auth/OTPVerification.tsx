import React from 'react';
import { Mail, ShieldCheck } from 'lucide-react';
import { OTPVerificationProps } from './types';

export const OTPVerification: React.FC<OTPVerificationProps> = ({
    otpCode, setOtpCode, authError, setAuthError, verifyOTP,
    pendingVerificationEmail, resendOTP, resendCooldown, startCooldown,
    onClose, language, t
}) => {
    const title = language === 'tr' ? 'E-posta Doğrulama'
        : language === 'ru' ? 'Подтверждение e-mail'
            : 'Email Verification';

    const description = language === 'tr'
        ? 'Lütfen e-postanıza gelen 8 haneli kodu girin:'
        : language === 'ru'
            ? 'Введите 8-значный код, отправленный на вашу почту:'
            : 'Enter the 8-digit code sent to your email:';

    const verifyLabel = language === 'tr' ? 'Doğrula'
        : language === 'ru' ? 'Подтвердить'
            : 'Verify';

    const codeError = language === 'tr' ? 'En az 6 haneli kodu girin'
        : language === 'ru' ? 'Введите минимум 6-значный код'
            : 'Enter at least 6-digit code';

    const resendLabel = resendCooldown > 0
        ? (language === 'tr' ? `Tekrar gönder (${resendCooldown}s)` : language === 'ru' ? `Отправить снова (${resendCooldown}с)` : `Resend (${resendCooldown}s)`)
        : (language === 'tr' ? 'Kodu Tekrar Gönder' : language === 'ru' ? 'Отправить код снова' : 'Resend Code');

    const codeSent = language === 'tr' ? '✅ Kod gönderildi!' : language === 'ru' ? '✅ Код отправлен!' : '✅ Code sent!';

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
                <input
                    type="text"
                    maxLength={8}
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 8))}
                    className="w-full px-4 py-4 text-center text-2xl font-mono tracking-[0.3em] border border-gray-200 dark:border-gray-600 rounded-xl dark:bg-gray-700 dark:text-white focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 outline-none transition-all"
                    placeholder="000000"
                    autoFocus
                />
                {authError && <p className="text-sm text-red-500 text-center">{authError}</p>}

                <button
                    onClick={async () => {
                        if (otpCode.length < 6) return setAuthError(codeError);
                        const res = await verifyOTP(pendingVerificationEmail!, otpCode);
                        if (res.success) {
                            onClose();
                            setOtpCode('');
                        } else {
                            setAuthError(res.error || 'Invalid code');
                        }
                    }}
                    className="w-full py-3 bg-primary-500 text-white font-semibold rounded-xl hover:bg-primary-600 active:scale-[0.98] transition-all shadow-md shadow-primary-500/20"
                >
                    {verifyLabel}
                </button>

                <button
                    onClick={async () => {
                        if (resendCooldown > 0) return;
                        const res = await resendOTP(pendingVerificationEmail!);
                        if (res.success) {
                            startCooldown();
                            setAuthError(codeSent);
                        }
                    }}
                    disabled={resendCooldown > 0}
                    className="w-full text-sm text-gray-500 dark:text-gray-300 hover:text-gray-700 dark:hover:text-white transition-colors disabled:opacity-50"
                >
                    {resendLabel}
                </button>
            </div>
        </>
    );
};
