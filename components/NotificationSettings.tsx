'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Bell, BellOff, Clock, Check } from 'lucide-react';

interface NotificationSettingsProps {
    language: 'tr' | 'en' | 'ru';
}

const translations = {
    tr: {
        title: 'Günlük Hatırlatma',
        description: 'Her gün seçtiğin saatte tekrar hatırlatması al.',
        enable: 'Bildirimleri Aç',
        disable: 'Bildirimleri Kapat',
        selectTime: 'Hatırlatma Saati',
        saved: 'Kaydedildi!',
        denied: 'Bildirim izni reddedildi. Tarayıcı ayarlarından izin verin.',
        notSupported: 'Bu tarayıcı bildirimleri desteklemiyor.',
        permissionNeeded: 'Bildirim izni gerekli',
        active: 'Aktif',
        inactive: 'Pasif',
    },
    en: {
        title: 'Daily Reminder',
        description: 'Get a review reminder at your chosen time every day.',
        enable: 'Enable Notifications',
        disable: 'Disable Notifications',
        selectTime: 'Reminder Time',
        saved: 'Saved!',
        denied: 'Notification permission denied. Please enable it in browser settings.',
        notSupported: 'This browser does not support notifications.',
        permissionNeeded: 'Notification permission required',
        active: 'Active',
        inactive: 'Inactive',
    },
    ru: {
        title: 'Ежедневное напоминание',
        description: 'Получайте напоминание о повторении в выбранное время.',
        enable: 'Включить уведомления',
        disable: 'Отключить уведомления',
        selectTime: 'Время напоминания',
        saved: 'Сохранено!',
        denied: 'Разрешение на уведомления отклонено. Включите в настройках браузера.',
        notSupported: 'Этот браузер не поддерживает уведомления.',
        permissionNeeded: 'Требуется разрешение на уведомления',
        active: 'Активно',
        inactive: 'Неактивно',
    },
};

const STORAGE_KEY = 'ftt_notification_settings';

interface NotificationConfig {
    enabled: boolean;
    hour: number;
    minute: number;
}

function getStoredConfig(): NotificationConfig {
    if (typeof window === 'undefined') return { enabled: false, hour: 9, minute: 0 };
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) return JSON.parse(stored);
    } catch {
        // Ignore parse errors
    }
    return { enabled: false, hour: 9, minute: 0 };
}

function saveConfig(config: NotificationConfig): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}

export default function NotificationSettings({ language }: NotificationSettingsProps) {
    const t = translations[language];
    const [config, setConfig] = useState<NotificationConfig>(getStoredConfig);
    const [permission, setPermission] = useState<NotificationPermission>('default');
    const [showSaved, setShowSaved] = useState(false);
    const [isSupported, setIsSupported] = useState(true);

    useEffect(() => {
        if (typeof window === 'undefined' || !('Notification' in window)) {
            setIsSupported(false);
            return;
        }
        setPermission(Notification.permission);
    }, []);

    // Schedule checker: runs every minute, fires notification at the right time
    const checkAndNotify = useCallback(() => {
        if (!config.enabled || permission !== 'granted') return;
        const now = new Date();
        if (now.getHours() === config.hour && now.getMinutes() === config.minute) {
            // Check if already sent today
            const lastSentKey = 'ftt_last_notification_date';
            const today = now.toDateString();
            if (localStorage.getItem(lastSentKey) === today) return;
            localStorage.setItem(lastSentKey, today);

            // Send notification
            const messages = {
                tr: { title: 'FinTechTerms 📚', body: 'Tekrar zamanı geldi! Bugünkü kelimeleri pratik et.' },
                en: { title: 'FinTechTerms 📚', body: 'Time to review! Practice today\'s terms.' },
                ru: { title: 'FinTechTerms 📚', body: 'Время повторения! Практикуйте сегодняшние слова.' },
            };
            const msg = messages[language];

            if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
                navigator.serviceWorker.controller.postMessage({
                    type: 'SHOW_NOTIFICATION',
                    title: msg.title,
                    body: msg.body,
                });
            } else {
                new Notification(msg.title, {
                    body: msg.body,
                    icon: '/icons/icon-192.png',
                    badge: '/icons/icon-72.png',
                    tag: 'daily-reminder',
                });
            }
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
            setConfig(newConfig);
            saveConfig(newConfig);
            return;
        }

        // Enable: request permission first
        if (!('Notification' in window)) {
            setIsSupported(false);
            return;
        }

        const perm = await Notification.requestPermission();
        setPermission(perm);

        if (perm === 'granted') {
            const newConfig = { ...config, enabled: true };
            setConfig(newConfig);
            saveConfig(newConfig);

            // Register the notification service worker
            if ('serviceWorker' in navigator) {
                try {
                    await navigator.serviceWorker.register('/notification-sw.js');
                } catch {
                    // SW registration failed, but Notification API still works
                }
            }
        }
    };

    const handleTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const parts = e.target.value.split(':').map(Number);
        const h = parts[0] ?? config.hour;
        const m = parts[1] ?? config.minute;
        const newConfig = { ...config, hour: h, minute: m };
        setConfig(newConfig);
        saveConfig(newConfig);
        setShowSaved(true);
        setTimeout(() => setShowSaved(false), 2000);
    };

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
        </div>
    );
}
