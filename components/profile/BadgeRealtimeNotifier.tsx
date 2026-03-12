'use client';

import { startTransition, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { NOTIFICATION_SETTINGS_STORAGE_KEY } from '@/components/NotificationSettings';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { getSupabaseClient } from '@/lib/supabase';
import type { Language } from '@/types';

interface BadgeRealtimePayload {
    id: string;
    badge_key: string;
    streak_days: number | null;
}

const copy = {
    tr: {
        title: 'Yeni rozet açıldı',
        badges: {
            streak_3: '3 günlük seri tamamlandı.',
            streak_7: '7 günlük seri tamamlandı.',
            streak_30: '30 günlük seri tamamlandı.',
        },
    },
    en: {
        title: 'New badge unlocked',
        badges: {
            streak_3: 'You completed a 3-day streak.',
            streak_7: 'You completed a 7-day streak.',
            streak_30: 'You completed a 30-day streak.',
        },
    },
    ru: {
        title: 'Новое достижение открыто',
        badges: {
            streak_3: 'Вы завершили серию из 3 дней.',
            streak_7: 'Вы завершили серию из 7 дней.',
            streak_30: 'Вы завершили серию из 30 дней.',
        },
    },
};

const areAchievementNotificationsEnabled = (): boolean => {
    if (typeof window === 'undefined') {
        return false;
    }

    try {
        const rawConfig = window.localStorage.getItem(NOTIFICATION_SETTINGS_STORAGE_KEY);
        if (!rawConfig) {
            return Notification.permission === 'granted';
        }

        const parsedConfig = JSON.parse(rawConfig) as { enabled?: boolean };
        return parsedConfig.enabled !== false && Notification.permission === 'granted';
    } catch (error) {
        console.error('BADGE_NOTIFICATION_CONFIG_PARSE_ERROR', error);
        return Notification.permission === 'granted';
    }
};

const showBadgeNotification = async (
    language: Language,
    badge: BadgeRealtimePayload
): Promise<void> => {
    if (typeof window === 'undefined' || typeof Notification === 'undefined') {
        return;
    }

    if (!areAchievementNotificationsEnabled()) {
        return;
    }

    const title = copy[language].title;
    const fallbackBody = badge.streak_days
        ? `${badge.streak_days}-day streak unlocked.`
        : 'A new learning badge is ready.';
    const body = copy[language].badges[badge.badge_key as keyof typeof copy.en.badges] ?? fallbackBody;
    const notificationPayload = {
        type: 'SHOW_NOTIFICATION',
        title,
        body,
        tag: `badge-${badge.id}`,
        data: {
            url: '/profile',
            badgeKey: badge.badge_key,
        },
    };

    if ('serviceWorker' in navigator) {
        try {
            const registration = await navigator.serviceWorker.register('/notification-sw.js');

            if (navigator.serviceWorker.controller) {
                navigator.serviceWorker.controller.postMessage(notificationPayload);
                return;
            }

            if (registration.active) {
                registration.active.postMessage(notificationPayload);
                return;
            }

            await registration.showNotification(title, {
                body,
                icon: '/icons/icon-192.png',
                badge: '/icons/icon-72.png',
                tag: `badge-${badge.id}`,
                data: {
                    url: '/profile',
                    badgeKey: badge.badge_key,
                },
            });
            return;
        } catch (error) {
            console.error('BADGE_NOTIFICATION_SERVICE_WORKER_ERROR', error);
        }
    }

    new Notification(title, {
        body,
        icon: '/icons/icon-192.png',
        badge: '/icons/icon-72.png',
        tag: `badge-${badge.id}`,
    });
};

export default function BadgeRealtimeNotifier() {
    const supabase = getSupabaseClient();
    const { user } = useAuth();
    const { language } = useLanguage();
    const router = useRouter();
    const seenBadgeIds = useRef(new Set<string>());
    const userId = user?.id ?? '';

    useEffect(() => {
        if (!userId) {
            return;
        }

        if ('serviceWorker' in navigator && typeof Notification !== 'undefined' && Notification.permission === 'granted') {
            void navigator.serviceWorker.register('/notification-sw.js');
        }

        const channel = supabase
            .channel(`user-badges-${userId}`)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'user_badges',
                    filter: `user_id=eq.${userId}`,
                },
                (payload) => {
                    const badge = payload.new as BadgeRealtimePayload;

                    if (!badge?.id || seenBadgeIds.current.has(badge.id)) {
                        return;
                    }

                    seenBadgeIds.current.add(badge.id);
                    void showBadgeNotification(language, badge);
                    startTransition(() => {
                        router.refresh();
                    });
                }
            )
            .subscribe();

        return () => {
            void supabase.removeChannel(channel);
        };
    }, [language, router, supabase, userId]);

    return null;
}
