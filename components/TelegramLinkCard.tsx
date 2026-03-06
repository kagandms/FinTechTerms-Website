'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2, Link2, ShieldCheck, Unlink2 } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useToast } from '@/contexts/ToastContext';
import { createIdempotencyKey } from '@/lib/idempotency';

interface TelegramLinkStatus {
    isLinked: boolean;
    telegram_id?: number;
    telegram_username?: string | null;
}

const readApiMessage = async (response: Response, fallbackMessage: string): Promise<string> => {
    try {
        const payload = await response.json();
        return payload?.message || payload?.error || fallbackMessage;
    } catch {
        return fallbackMessage;
    }
};

export default function TelegramLinkCard() {
    const { language: lang } = useLanguage();
    const { showToast } = useToast();
    const [token, setToken] = useState('');
    const [status, setStatus] = useState<TelegramLinkStatus | null>(null);
    const [isLoadingStatus, setIsLoadingStatus] = useState(true);
    const [isPending, setIsPending] = useState(false);

    const copy = {
        title: lang === 'tr' ? "Telegram'ı Bağla" : lang === 'ru' ? 'Привязать Telegram' : 'Link Telegram',
        subtitle: lang === 'tr' ? 'Web ve bot ilerlemesini tek hesapta birleştirin.' : lang === 'ru' ? 'Объедините прогресс сайта и бота в одном аккаунте.' : 'Merge your web and bot progress into one account.',
        helper: lang === 'tr' ? "Botta aldığınız 6 haneli kodu girin." : lang === 'ru' ? 'Введите 6-значный код из Telegram-бота.' : 'Enter the 6-digit code from the Telegram bot.',
        placeholder: lang === 'tr' ? 'Bağlantı kodu' : lang === 'ru' ? 'Код привязки' : 'Link code',
        link: lang === 'tr' ? 'Bağla' : lang === 'ru' ? 'Привязать' : 'Link',
        unlink: lang === 'tr' ? 'Bağlantıyı Kaldır' : lang === 'ru' ? 'Отвязать' : 'Unlink',
        linked: lang === 'tr' ? 'Telegram bağlı' : lang === 'ru' ? 'Telegram привязан' : 'Telegram linked',
        linkedAs: lang === 'tr' ? 'Hesap' : lang === 'ru' ? 'Аккаунт' : 'Account',
        loading: lang === 'tr' ? 'Durum yükleniyor...' : lang === 'ru' ? 'Загружаем статус...' : 'Loading status...',
        linking: lang === 'tr' ? 'Bağlanıyor...' : lang === 'ru' ? 'Привязываем...' : 'Linking...',
        unlinking: lang === 'tr' ? 'Kaldırılıyor...' : lang === 'ru' ? 'Отвязываем...' : 'Unlinking...',
        statusError: lang === 'tr' ? 'Telegram bağlantı durumu alınamadı.' : lang === 'ru' ? 'Не удалось загрузить статус Telegram.' : 'Unable to load Telegram status.',
        linkSuccess: lang === 'tr' ? 'Telegram hesabı bağlandı.' : lang === 'ru' ? 'Аккаунт Telegram привязан.' : 'Telegram account linked.',
        unlinkSuccess: lang === 'tr' ? 'Telegram bağlantısı kaldırıldı.' : lang === 'ru' ? 'Связь с Telegram удалена.' : 'Telegram account unlinked.',
        linkError: lang === 'tr' ? 'Telegram hesabı bağlanamadı.' : lang === 'ru' ? 'Не удалось привязать Telegram.' : 'Unable to link Telegram.',
        unlinkError: lang === 'tr' ? 'Telegram bağlantısı kaldırılamadı.' : lang === 'ru' ? 'Не удалось отвязать Telegram.' : 'Unable to unlink Telegram.',
    };

    const loadStatus = useCallback(async (showErrorToast = false): Promise<TelegramLinkStatus | null> => {
        setIsLoadingStatus(true);

        try {
            const response = await fetch('/api/telegram/link', {
                cache: 'no-store',
            });

            if (!response.ok) {
                throw new Error(await readApiMessage(response, copy.statusError));
            }

            const payload = await response.json() as TelegramLinkStatus;
            setStatus(payload);
            return payload;
        } catch (error) {
            console.error('TELEGRAM_LINK_STATUS_CLIENT_ERROR', error);
            setStatus({ isLinked: false });

            if (showErrorToast) {
                showToast(
                    error instanceof Error ? error.message : copy.statusError,
                    'error'
                );
            }

            return null;
        } finally {
            setIsLoadingStatus(false);
        }
    }, [copy.statusError, showToast]);

    useEffect(() => {
        loadStatus();
    }, [loadStatus]);

    const handleLink = async () => {
        if (isPending || token.length !== 6) {
            return;
        }

        setIsPending(true);

        try {
            const response = await fetch('/api/telegram/link', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    token,
                    idempotencyKey: createIdempotencyKey(),
                }),
            });

            if (!response.ok) {
                throw new Error(await readApiMessage(response, copy.linkError));
            }

            setToken('');
            showToast(copy.linkSuccess, 'success');
            await loadStatus();
        } catch (error) {
            const latestStatus = await loadStatus();
            if (latestStatus?.isLinked) {
                setToken('');
                showToast(copy.linkSuccess, 'success');
                return;
            }

            showToast(
                error instanceof Error ? error.message : copy.linkError,
                'error'
            );
        } finally {
            setIsPending(false);
        }
    };

    const handleUnlink = async () => {
        if (isPending) {
            return;
        }

        setIsPending(true);

        try {
            const response = await fetch('/api/telegram/link', {
                method: 'DELETE',
            });

            if (!response.ok) {
                throw new Error(await readApiMessage(response, copy.unlinkError));
            }

            setStatus({ isLinked: false });
            setToken('');
            showToast(copy.unlinkSuccess, 'success');
        } catch (error) {
            showToast(
                error instanceof Error ? error.message : copy.unlinkError,
                'error'
            );
        } finally {
            setIsPending(false);
        }
    };

    return (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-100 dark:border-gray-700 p-6 max-w-md w-full mx-auto relative overflow-hidden transition-all duration-300 hover:shadow-xl">
            <div className="absolute top-0 right-0 -mt-4 -mr-4 w-24 h-24 bg-blue-500 rounded-full opacity-10 blur-xl"></div>
            <div className="absolute bottom-0 left-0 -mb-4 -ml-4 w-20 h-20 bg-emerald-500 rounded-full opacity-10 blur-xl"></div>

            <div className="flex items-center gap-4 mb-6">
                <div className="flex items-center justify-center w-12 h-12 rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-500 dark:text-blue-400">
                    <ShieldCheck className="w-6 h-6" />
                </div>
                <div>
                    <h3 className="text-xl font-bold font-display text-gray-900 dark:text-white">{copy.title}</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{copy.subtitle}</p>
                </div>
            </div>

            {isLoadingStatus ? (
                <div className="flex items-center justify-center gap-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/40 px-4 py-6 text-sm text-gray-500 dark:text-gray-300">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>{copy.loading}</span>
                </div>
            ) : status?.isLinked ? (
                <div className="space-y-4">
                    <div className="rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20 p-4">
                        <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300 font-semibold">
                            <Link2 className="w-4 h-4" />
                            <span>{copy.linked}</span>
                        </div>
                        <p className="mt-2 text-sm text-gray-700 dark:text-gray-200">
                            {status.telegram_username
                                ? `${copy.linkedAs}: @${status.telegram_username}`
                                : `${copy.linkedAs}: ${status.telegram_id ?? '—'}`}
                        </p>
                    </div>

                    <button
                        type="button"
                        onClick={handleUnlink}
                        disabled={isPending}
                        className={`w-full inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 font-semibold transition-colors ${isPending
                            ? 'bg-gray-200 text-gray-400 cursor-not-allowed dark:bg-gray-700 dark:text-gray-500'
                            : 'bg-gray-100 text-gray-800 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600'
                            }`}
                    >
                        {isPending ? (
                            <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                <span>{copy.unlinking}</span>
                            </>
                        ) : (
                            <>
                                <Unlink2 className="w-4 h-4" />
                                <span>{copy.unlink}</span>
                            </>
                        )}
                    </button>
                </div>
            ) : (
                <div className="space-y-4">
                    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/40 p-4 text-sm text-gray-600 dark:text-gray-300">
                        {copy.helper}
                    </div>

                    <div className="space-y-3">
                        <input
                            type="text"
                            inputMode="numeric"
                            autoComplete="one-time-code"
                            maxLength={6}
                            value={token}
                            onChange={(event) => setToken(event.target.value.replace(/\D/g, '').slice(0, 6))}
                            disabled={isPending}
                            placeholder={copy.placeholder}
                            className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-3 text-center text-lg font-semibold tracking-[0.35em] text-gray-900 dark:text-white outline-none transition-colors focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900/40 disabled:cursor-not-allowed disabled:bg-gray-100 dark:disabled:bg-gray-800"
                        />

                        <button
                            type="button"
                            onClick={handleLink}
                            disabled={isPending || token.length !== 6}
                            className={`w-full inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 font-semibold text-white transition-colors ${isPending || token.length !== 6
                                ? 'bg-blue-300 cursor-not-allowed'
                                : 'bg-blue-500 hover:bg-blue-600'
                                }`}
                        >
                            {isPending ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    <span>{copy.linking}</span>
                                </>
                            ) : (
                                <>
                                    <Link2 className="w-4 h-4" />
                                    <span>{copy.link}</span>
                                </>
                            )}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
