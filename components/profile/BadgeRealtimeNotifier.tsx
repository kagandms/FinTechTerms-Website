'use client';

import { startTransition, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { NOTIFICATION_SETTINGS_STORAGE_KEY } from '@/components/NotificationSettings';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import type { Language } from '@/types';
import { logger } from '@/lib/logger';

interface BadgeRealtimePayload {
    id: string;
    badge_key: string;
    streak_days: number | null;
    unlocked_at?: string;
}

const BADGE_POLL_INTERVAL_MS = 30_000;
const BADGE_POLL_TIMEOUT_MS = 10_000;

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
        logger.error('BADGE_NOTIFICATION_CONFIG_PARSE_ERROR', {
            route: 'BadgeRealtimeNotifier',
            error: error instanceof Error ? error : undefined,
        });
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
            logger.error('BADGE_NOTIFICATION_SERVICE_WORKER_ERROR', {
                route: 'BadgeRealtimeNotifier',
                error: error instanceof Error ? error : undefined,
            });
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
    const { user } = useAuth();
    const { language } = useLanguage();
    const router = useRouter();
    const seenBadgeIds = useRef(new Set<string>());
    const hasHydratedInitialSnapshot = useRef(false);
    const isPollInFlight = useRef(false);
    const pollAbortController = useRef<AbortController | null>(null);
    const userId = user?.id ?? '';

    useEffect(() => {
        if (!userId) {
            pollAbortController.current?.abort();
            pollAbortController.current = null;
            isPollInFlight.current = false;
            seenBadgeIds.current.clear();
            hasHydratedInitialSnapshot.current = false;
            return;
        }

        if ('serviceWorker' in navigator && typeof Notification !== 'undefined' && Notification.permission === 'granted') {
            void navigator.serviceWorker.register('/notification-sw.js');
        }

        let intervalId: number | null = null;
        let isCancelled = false;

        const pollBadges = async () => {
            if (document.visibilityState === 'hidden' || isPollInFlight.current) {
                return;
            }

            const controller = new AbortController();
            const timeoutId = window.setTimeout(() => {
                controller.abort();
            }, BADGE_POLL_TIMEOUT_MS);
            isPollInFlight.current = true;
            pollAbortController.current = controller;

            try {
                const response = await fetch('/api/profile/badges/latest', {
                    method: 'GET',
                    credentials: 'same-origin',
                    cache: 'no-store',
                    signal: controller.signal,
                });

                if (!response.ok) {
                    return;
                }

                const payload = await response.json() as { badges?: BadgeRealtimePayload[] };
                const badges = Array.isArray(payload.badges)
                    ? [...payload.badges].reverse()
                    : [];

                if (!hasHydratedInitialSnapshot.current) {
                    badges.forEach((badge) => {
                        if (badge?.id) {
                            seenBadgeIds.current.add(badge.id);
                        }
                    });
                    hasHydratedInitialSnapshot.current = true;
                    return;
                }

                const newlySeenBadges = badges.filter((badge) => (
                    Boolean(badge?.id) && !seenBadgeIds.current.has(badge.id)
                ));

                if (newlySeenBadges.length === 0) {
                    return;
                }

                newlySeenBadges.forEach((badge) => {
                    if (badge.id) {
                        seenBadgeIds.current.add(badge.id);
                        void showBadgeNotification(language, badge);
                    }
                });

                if (!isCancelled) {
                    startTransition(() => {
                        router.refresh();
                    });
                }
            } catch (error) {
                const isAbortError = error instanceof Error && error.name === 'AbortError';

                if (isCancelled && isAbortError) {
                    return;
                }

                logger.error('BADGE_NOTIFICATION_POLL_FAILED', {
                    route: 'BadgeRealtimeNotifier',
                    error: error instanceof Error ? error : undefined,
                });
            } finally {
                window.clearTimeout(timeoutId);
                if (pollAbortController.current === controller) {
                    pollAbortController.current = null;
                }
                isPollInFlight.current = false;
            }
        };

        void pollBadges();
        intervalId = window.setInterval(() => {
            void pollBadges();
        }, BADGE_POLL_INTERVAL_MS);

        return () => {
            isCancelled = true;
            pollAbortController.current?.abort();
            pollAbortController.current = null;
            isPollInFlight.current = false;
            if (intervalId) {
                window.clearInterval(intervalId);
            }
        };
    }, [language, router, userId]);

    return null;
}
