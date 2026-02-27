/**
 * Web Push Notification Helper (M35)
 * Skill: pwa-expert, frontend-developer
 *
 * VAPID-based push notification system — no external service required.
 * Uses the standard Push API + Notification API.
 *
 * SETUP:
 *   1. Generate VAPID keys: npx web-push generate-vapid-keys
 *   2. Set NEXT_PUBLIC_VAPID_PUBLIC_KEY in .env.local
 *   3. Set VAPID_PRIVATE_KEY in server-side env
 *   4. Call subscribeToPush() when user opts in
 */

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '';

/**
 * Check if push notifications are supported in this browser.
 */
export function isPushSupported(): boolean {
    return (
        typeof window !== 'undefined' &&
        'serviceWorker' in navigator &&
        'PushManager' in window &&
        'Notification' in window
    );
}

/**
 * Get the current notification permission status.
 */
export function getPermissionStatus(): NotificationPermission | 'unsupported' {
    if (!isPushSupported()) return 'unsupported';
    return Notification.permission;
}

/**
 * Request notification permission from the user.
 * Returns 'granted', 'denied', or 'default'.
 */
export async function requestPermission(): Promise<NotificationPermission> {
    if (!isPushSupported()) {
        console.warn('[Push] Not supported in this browser');
        return 'denied';
    }
    return Notification.requestPermission();
}

/**
 * Subscribe the user to push notifications via the service worker.
 * Returns the PushSubscription object to send to your backend.
 */
export async function subscribeToPush(): Promise<PushSubscription | null> {
    try {
        const permission = await requestPermission();
        if (permission !== 'granted') {
            console.info('[Push] Permission not granted:', permission);
            return null;
        }

        const registration = await navigator.serviceWorker.ready;

        // Check for existing subscription
        const existing = await registration.pushManager.getSubscription();
        if (existing) {
            console.info('[Push] Already subscribed');
            return existing;
        }

        if (!VAPID_PUBLIC_KEY) {
            console.error('[Push] VAPID public key not configured');
            return null;
        }

        // Convert VAPID key to Uint8Array
        const applicationServerKey = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);

        const subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: applicationServerKey.buffer as ArrayBuffer,
        });

        console.info('[Push] Subscribed successfully');

        // TODO: Send subscription to your backend
        // await fetch('/api/v1/push/subscribe', {
        //     method: 'POST',
        //     body: JSON.stringify(subscription),
        //     headers: { 'Content-Type': 'application/json' },
        // });

        return subscription;
    } catch (error) {
        console.error('[Push] Subscription failed:', error);
        return null;
    }
}

/**
 * Unsubscribe from push notifications.
 */
export async function unsubscribeFromPush(): Promise<boolean> {
    try {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();

        if (subscription) {
            await subscription.unsubscribe();
            console.info('[Push] Unsubscribed');
            return true;
        }

        return false;
    } catch (error) {
        console.error('[Push] Unsubscribe failed:', error);
        return false;
    }
}

/**
 * Send a local notification (for testing or offline reminders).
 */
export function sendLocalNotification(
    title: string,
    options?: NotificationOptions
): void {
    if (Notification.permission === 'granted') {
        new Notification(title, {
            icon: '/ftt.png',
            badge: '/ftt.png',
            ...options,
        });
    }
}

/**
 * Convert a base64 VAPID key to Uint8Array for the Push API.
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding)
        .replace(/-/g, '+')
        .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }

    return outputArray;
}
