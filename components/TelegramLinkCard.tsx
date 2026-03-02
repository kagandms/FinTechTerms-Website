'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function TelegramLinkCard() {
    const [token, setToken] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const router = useRouter();

    const handleLink = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setSuccess(null);

        // Basic frontend validation
        if (!token || token.length !== 6 || !/^\d+$/.test(token)) {
            setError('Lütfen 6 haneli geçerli bir kod girin.');
            return;
        }

        setLoading(true);

        try {
            const res = await fetch('/api/telegram/link', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ token }),
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || 'Bilinmeyen bir hata oluştu.');
            }

            setSuccess(data.message || 'Telegram hesabınız başarıyla bağlandı!');
            setToken('');

            // Optionally refresh the page or user session data
            router.refresh();

        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-100 dark:border-gray-700 p-6 max-w-md w-full mx-auto relative overflow-hidden transition-all duration-300 hover:shadow-xl">
            {/* Background decorative flair */}
            <div className="absolute top-0 right-0 -mt-4 -mr-4 w-24 h-24 bg-blue-500 rounded-full opacity-10 blur-xl"></div>
            <div className="absolute bottom-0 left-0 -mb-4 -ml-4 w-20 h-20 bg-emerald-500 rounded-full opacity-10 blur-xl"></div>

            <div className="flex items-center gap-4 mb-6">
                <div className="flex items-center justify-center w-12 h-12 rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-500 dark:text-blue-400">
                    <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69.01-.03.01-.14-.08-.19-.09-.05-.21-.02-.3.01-.13.04-2.18 1.4-6.17 4.1-.59.4-1.12.6-1.59.59-.51-.01-1.49-.29-2.22-.52-.89-.28-1.6-.43-1.54-.91.03-.25.38-.51 1.05-.78 4.11-1.79 6.85-2.97 8.23-3.54 3.92-1.64 4.74-1.92 5.27-1.92.12 0 .38.03.52.14.12.09.15.22.16.33.01.07.01.15 0 .21z" />
                    </svg>
                </div>
                <div>
                    <h3 className="text-xl font-bold font-display text-gray-900 dark:text-white">Telegram'ı Bağla</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">İlerlemelerinizi tek bir hesapta birleştirin.</p>
                </div>
            </div>

            <form onSubmit={handleLink} className="space-y-4">
                <div>
                    <label htmlFor="telegram-code" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Bot'tan Alınan 6 Haneli Kod
                    </label>
                    <div className="relative">
                        <input
                            id="telegram-code"
                            type="text"
                            maxLength={6}
                            disabled={loading || !!success}
                            value={token}
                            onChange={(e) => setToken(e.target.value.replace(/\D/g, ''))} // Numeric only
                            placeholder="Örn: 049583"
                            className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none font-mono tracking-widest text-center text-lg disabled:opacity-50"
                        />
                    </div>
                </div>

                {error && (
                    <div className="p-3 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 rounded-lg flex items-start gap-2 animate-in fade-in slide-in-from-top-1">
                        <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span>{error}</span>
                    </div>
                )}

                {success && (
                    <div className="p-3 text-sm text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800 rounded-lg flex items-start gap-2 animate-in fade-in slide-in-from-top-1">
                        <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span>{success}</span>
                    </div>
                )}

                <button
                    type="submit"
                    disabled={loading || !!success || token.length !== 6}
                    className="w-full flex items-center justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-gray-300 disabled:text-gray-500 dark:disabled:bg-gray-700 dark:disabled:text-gray-400 transition-colors disabled:cursor-not-allowed"
                >
                    {loading ? (
                        <>
                            <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-current" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            İşleniyor...
                        </>
                    ) : (
                        success ? 'Hesap Bağlandı ✓' : 'Profili Birleştir'
                    )}
                </button>

                {!success && (
                    <p className="text-xs text-center text-gray-500 dark:text-gray-400 mt-4">
                        Kod almak için Telegram botumuza gidin ve <code className="bg-gray-100 dark:bg-gray-700 px-1 py-0.5 rounded text-blue-600 dark:text-blue-400">/link</code> yazın.
                    </p>
                )}
            </form>
        </div>
    );
}
