'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Bell, BellOff, Clock, Check } from 'lucide-react';
import { useToast } from '@/contexts/ToastContext';
import { logger } from '@/lib/logger';

interface NotificationSettingsProps {
    language: 'tr' | 'en' | 'ru';
}

const translations = {
    tr: {
        title: 'Açık Uygulama Hatırlatması',
        description: 'Seçtiğin saatte yalnızca uygulama tarayıcıda açıkken çalışan bir hatırlatma planla.',
        enable: 'Açık Uygulama Hatırlatmasını Aç',
        disable: 'Açık Uygulama Hatırlatmasını Kapat',
        selectTime: 'Hatırlatma Saati',
        saved: 'Kaydedildi!',
        denied: 'Bildirim izni reddedildi. Tarayıcı ayarlarından izin verin.',
        notSupported: 'Bu tarayıcı bildirimleri desteklemiyor.',
        permissionNeeded: 'Bildirim izni gerekli',
        active: 'Açık Sekmede Aktif',
        inactive: 'Pasif',
        storageError: 'Kayıtlı veri bozuk olduğu için bildirim ayarları sıfırlandı.',
        savingError: 'Bildirim ayarları kaydedilemedi.',
        limitationTitle: 'Arka plan bildirimi değil',
        openAppOnly: 'Bu özellik push tabanlı bir arka plan bildirimi değildir. Yalnızca bu uygulama açıkken çalışır. Sekme kapalıysa, tarayıcı arka plandaysa veya cihaz uykuya geçerse hatırlatma gönderilmez.',
    },
    en: {
        title: 'Open-App Reminder',
        description: 'Schedule a reminder that works only while this app stays open in your browser.',
        enable: 'Enable Open-App Reminder',
        disable: 'Disable Open-App Reminder',
        selectTime: 'Reminder Time',
        saved: 'Saved!',
        denied: 'Notification permission denied. Please enable it in browser settings.',
        notSupported: 'This browser does not support notifications.',
        permissionNeeded: 'Notification permission required',
        active: 'Active In Open Tab',
        inactive: 'Inactive',
        storageError: 'Notification settings were reset because saved data was invalid.',
        savingError: 'Notification settings could not be saved.',
        limitationTitle: 'Not a background push notification',
        openAppOnly: 'This feature is not a background push notification. It only works while the app is open. If the tab is closed, the browser is backgrounded, or the device sleeps, no reminder will be sent.',
    },
    ru: {
        title: 'Напоминание в открытом приложении',
        description: 'Запланируйте напоминание, которое работает только пока приложение открыто в браузере.',
        enable: 'Включить напоминание в открытом приложении',
        disable: 'Отключить напоминание в открытом приложении',
        selectTime: 'Время напоминания',
        saved: 'Сохранено!',
        denied: 'Разрешение на уведомления отклонено. Включите в настройках браузера.',
        notSupported: 'Этот браузер не поддерживает уведомления.',
        permissionNeeded: 'Требуется разрешение на уведомления',
        active: 'Активно в открытой вкладке',
        inactive: 'Неактивно',
        storageError: 'Настройки уведомлений были сброшены из-за повреждённых данных.',
        savingError: 'Не удалось сохранить настройки уведомлений.',
        limitationTitle: 'Это не фоновый push',
        openAppOnly: 'Эта функция не является фоновым push-уведомлением. Она работает только пока приложение открыто. Если вкладка закрыта, браузер в фоне или устройство спит, напоминание не придет.',
    },
};

export const NOTIFICATION_SETTINGS_STORAGE_KEY = 'ftt_notification_settings';
const DEFAULT_NOTIFICATION_CONFIG: NotificationConfig = { enabled: false, hour: 9, minute: 0 };

interface NotificationConfig {
    enabled: boolean;
    hour: number;
    minute: number;
}

const LAST_SENT_NOTIFICATION_DATE_KEY = 'ftt_last_notification_date';

function readStoredConfig(): { config: NotificationConfig; error: string | null } {
    if (typeof window === 'undefined') {
        return { config: DEFAULT_NOTIFICATION_CONFIG, error: null };
    }

    try {
        const stored = localStorage.getItem(NOTIFICATION_SETTINGS_STORAGE_KEY);
        if (!stored) {
            return { config: DEFAULT_NOTIFICATION_CONFIG, error: null };
        }

        const parsed = JSON.parse(stored) as Partial<NotificationConfig>;
        const hour = typeof parsed.hour === 'number' ? parsed.hour : DEFAULT_NOTIFICATION_CONFIG.hour;
        const minute = typeof parsed.minute === 'number' ? parsed.minute : DEFAULT_NOTIFICATION_CONFIG.minute;
        const enabled = typeof parsed.enabled === 'boolean' ? parsed.enabled : DEFAULT_NOTIFICATION_CONFIG.enabled;

        return {
            config: { enabled, hour, minute },
            error: null,
        };
    } catch (error) {
        logger.error('NOTIFICATION_SETTINGS_PARSE_ERROR', {
            route: 'NotificationSettings',
            error: error instanceof Error ? error : undefined,
        });
    }

    return {
        config: DEFAULT_NOTIFICATION_CONFIG,
        error: 'NOTIFICATION_SETTINGS_PARSE_ERROR',
    };
}

function saveConfig(config: NotificationConfig): boolean {
    if (typeof window === 'undefined') {
        return false;
    }

    try {
        localStorage.setItem(NOTIFICATION_SETTINGS_STORAGE_KEY, JSON.stringify(config));
        return true;
    } catch (error) {
        logger.error('NOTIFICATION_SETTINGS_SAVE_ERROR', {
            route: 'NotificationSettings',
            error: error instanceof Error ? error : undefined,
        });
        return false;
    }
}

export default function NotificationSettings({ language }: NotificationSettingsProps) {
    const t = translations[language];
    const { showToast } = useToast();
    const [initialStorageRead] = useState(() => readStoredConfig());
    const [config, setConfig] = useState<NotificationConfig>(initialStorageRead.config);
    const [storageError, setStorageError] = useState<string | null>(initialStorageRead.error);
    const [permission, setPermission] = useState<NotificationPermission>('default');
    const [showSaved, setShowSaved] = useState(false);
    const [isSupported, setIsSupported] = useState(true);
    const [isUpdating, setIsUpdating] = useState(false);
    const savedIndicatorTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        if (typeof window === 'undefined' || !('Notification' in window)) {
            setIsSupported(false);
            return;
        }
        setPermission(Notification.permission);
    }, []);

    useEffect(() => () => {
        if (savedIndicatorTimeoutRef.current) {
            clearTimeout(savedIndicatorTimeoutRef.current);
        }
    }, []);

    useEffect(() => {
        if (!storageError) {
            return;
        }

        showToast(t.storageError, 'warning');
        setStorageError(null);
    }, [showToast, storageError, t.storageError]);

    const persistConfig = useCallback((nextConfig: NotificationConfig): boolean => {
        if (!saveConfig(nextConfig)) {
            showToast(t.savingError, 'error');
            return false;
        }

        setConfig(nextConfig);
        return true;
    }, [showToast, t.savingError]);

    // Schedule checker: runs every minute, fires notification at the right time
    const checkAndNotify = useCallback(() => {
        if (!config.enabled || permission !== 'granted') return;
        const now = new Date();
        if (now.getHours() === config.hour && now.getMinutes() === config.minute) {
            try {
                const today = now.toDateString();
                if (localStorage.getItem(LAST_SENT_NOTIFICATION_DATE_KEY) === today) return;
                localStorage.setItem(LAST_SENT_NOTIFICATION_DATE_KEY, today);
            } catch (error) {
                logger.error('NOTIFICATION_SETTINGS_LAST_SENT_STORAGE_ERROR', {
                    route: 'NotificationSettings',
                    error: error instanceof Error ? error : undefined,
                });
                return;
            }

            // Send notification
            const messages = {
                tr: { title: 'FinTechTerms 📚', body: 'Tekrar zamanı geldi! Bugünkü kelimeleri pratik et.' },
                en: { title: 'FinTechTerms 📚', body: 'Time to review! Practice today\'s terms.' },
                ru: { title: 'FinTechTerms 📚', body: 'Время повторения! Практикуйте сегодняшние слова.' },
            };
            const msg = messages[language];

            new Notification(msg.title, {
                body: msg.body,
                icon: '/icons/icon-192.png',
                badge: '/icons/icon-72.png',
                tag: 'daily-reminder',
            });
        }
    }, [config.enabled, config.hour, config.minute, permission, language]);

    useEffect(() => {
        if (!config.enabled || permission !== 'granted') return;
        // Check immediately
        checkAndNotify();
        // Check every 60 seconds
        const interval = setInterval(checkAndNotify, 60000);
        return () => clearInterval(interval);
    }, [config.enabled, permission, checkAndNotify]);

    const handleToggle = async () => {
        if (config.enabled) {
            // Disable
            const newConfig = { ...config, enabled: false };
            persistConfig(newConfig);
            return;
        }

        // Enable: request permission first
        if (!('Notification' in window)) {
            setIsSupported(false);
            return;
        }

        setIsUpdating(true);

        try {
            const perm = await Notification.requestPermission();
            setPermission(perm);

            if (perm === 'granted') {
                const newConfig = { ...config, enabled: true };
                persistConfig(newConfig);
                return;
            }

            if (perm === 'denied') {
                showToast(t.denied, 'error');
            }
        } catch (error) {
            logger.error('NOTIFICATION_SETTINGS_TOGGLE_ERROR', {
                route: 'NotificationSettings',
                error: error instanceof Error ? error : undefined,
            });
            showToast(t.permissionNeeded, 'error');
        } finally {
            setIsUpdating(false);
        }
    };

    const handleTimeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const parts = e.target.value.split(':').map(Number);
        const h = parts[0] ?? config.hour;
        const m = parts[1] ?? config.minute;
        const newConfig = { ...config, hour: h, minute: m };
        if (!persistConfig(newConfig)) {
            setShowSaved(false);
            if (savedIndicatorTimeoutRef.current) {
                clearTimeout(savedIndicatorTimeoutRef.current);
                savedIndicatorTimeoutRef.current = null;
            }
            return;
        }
        setShowSaved(true);
        if (savedIndicatorTimeoutRef.current) {
            clearTimeout(savedIndicatorTimeoutRef.current);
        }
        savedIndicatorTimeoutRef.current = setTimeout(() => {
            setShowSaved(false);
            savedIndicatorTimeoutRef.current = null;
        }, 2000);
    }, [config, persistConfig]);

    const timeValue = `${String(config.hour).padStart(2, '0')}:${String(config.minute).padStart(2, '0')}`;

    if (!isSupported) {
        return (
            <div className="p-4 bg-gray-50 dark:bg-gray-700/30 rounded-xl">
                <div className="flex items-center gap-3 text-gray-400">
                    <BellOff className="w-5 h-5" />
                    <span className="text-sm">{t.notSupported}</span>
                </div>
            </div>
        );
    }

    return (
        <div className="p-4 border-b border-gray-100 dark:border-gray-700">
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                    <Bell className="w-5 h-5 text-gray-400" />
                    <div>
                        <span className="font-medium text-gray-900 dark:text-white">{t.title}</span>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{t.description}</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {config.enabled && (
                        <span className="text-xs text-green-500 font-medium flex items-center gap-1">
                            <Check className="w-3 h-3" />
                            {t.active}
                        </span>
                    )}
                </div>
            </div>

            <div className="flex items-center gap-3">
                {/* Time Picker */}
                <div className="flex items-center gap-2 flex-1">
                    <Clock className="w-4 h-4 text-gray-400" aria-hidden="true" />
                    <input
                        type="time"
                        value={timeValue}
                        onChange={handleTimeChange}
                        disabled={!config.enabled}
                        className="px-3 py-2 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
                        aria-label={t.selectTime}
                    />
                    {showSaved && (
                        <span className="text-xs text-green-500 font-medium animate-fade-in">{t.saved}</span>
                    )}
                </div>

                {/* Toggle Button */}
                <button
                    onClick={handleToggle}
                    disabled={isUpdating}
                    className={`px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${config.enabled
                        ? 'bg-red-50 text-red-500 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/30'
                        : 'bg-primary-500 text-white hover:bg-primary-600'
                        }`}
                    aria-label={config.enabled ? t.disable : t.enable}
                >
                    {config.enabled ? (
                        <BellOff className="w-4 h-4" />
                    ) : (
                        <Bell className="w-4 h-4" />
                    )}
                </button>
            </div>

            {/* Permission denied warning */}
            {permission === 'denied' && (
                <p className="mt-2 text-xs text-red-500">{t.denied}</p>
            )}

            <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/20 dark:text-amber-200">
                <p className="font-semibold">{t.limitationTitle}</p>
                <p className="mt-1">{t.openAppOnly}</p>
            </div>
        </div>
    );
}
