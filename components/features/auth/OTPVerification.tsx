import React from 'react';
import { Mail } from 'lucide-react';
import { OTPVerificationProps } from './types';

export const OTPVerification: React.FC<OTPVerificationProps> = ({
    otpCode, setOtpCode, authError, setAuthError, verifyOTP,
    pendingVerificationEmail, resendOTP, resendCooldown, startCooldown,
    onClose, language, t
}) => {
    return (
        <>
            <div className="flex items-center gap-3 mb-6">
                <Mail className="w-6 h-6 text-primary-500" />
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                    {language === 'tr' ? 'E-posta Doğrulama' : 'Email Verification'}
                </h3>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                {pendingVerificationEmail}
            </p>

            <div className="space-y-4">
                <input
                    type="text"
                    maxLength={8}
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 8))}
                    className="w-full px-4 py-4 text-center text-2xl font-mono border rounded-xl dark:bg-gray-700 dark:text-white"
                    placeholder="00000000"
                />
                {authError && <p className="text-sm text-red-500">{authError}</p>}

                <button
                    onClick={async () => {
                        if (otpCode.length !== 8) return setAuthError('Enter 8-digit code');
                        const res = await verifyOTP(pendingVerificationEmail!, otpCode);
                        if (res.success) {
                            onClose();
                            setOtpCode('');
                        } else {
                            setAuthError(res.error || 'Invalid code');
                        }
                    }}
                    className="w-full py-3 bg-primary-500 text-white font-semibold rounded-xl hover:bg-primary-600 transition-colors"
                >
                    {language === 'tr' ? 'Doğrula' : 'Verify'}
                </button>

                <button
                    onClick={async () => {
                        if (resendCooldown > 0) return;
                        const res = await resendOTP(pendingVerificationEmail!);
                        if (res.success) {
                            startCooldown();
                            setAuthError('✅ Code sent!');
                        }
                    }}
                    disabled={resendCooldown > 0}
                    className="w-full text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
                >
                    {resendCooldown > 0 ? `Resend (${resendCooldown}s)` : 'Resend Code'}
                </button>
            </div>
        </>
    );
};
