// FinTechTerms Notification Service Worker
// Handles explicit in-app notifications and push notifications.

function normalizeNotificationPayload(payload) {
    var safePayload = payload || {};

    return {
        title: safePayload.title || 'FinTechTerms',
        body: safePayload.body || '',
        icon: safePayload.icon || '/icons/icon-192.png',
        badge: safePayload.badge || '/icons/icon-72.png',
        tag: safePayload.tag || 'fintechterms-notification',
        renotify: typeof safePayload.renotify === 'boolean' ? safePayload.renotify : true,
        data: {
            url: safePayload.data && safePayload.data.url ? safePayload.data.url : '/',
            badgeKey: safePayload.data && safePayload.data.badgeKey ? safePayload.data.badgeKey : null,
        },
    };
}

function showNotificationFromPayload(payload) {
    var notification = normalizeNotificationPayload(payload);

    return self.registration.showNotification(notification.title, {
        body: notification.body,
        icon: notification.icon,
        badge: notification.badge,
        tag: notification.tag,
        renotify: notification.renotify,
        data: notification.data,
    });
}

self.addEventListener('message', function (event) {
    if (event.data && event.data.type === 'SHOW_NOTIFICATION') {
        event.waitUntil(showNotificationFromPayload(event.data));
    }
});

self.addEventListener('push', function (event) {
    var payload = {};

    if (event.data) {
        try {
            payload = event.data.json();
        } catch (error) {
            payload = {
                title: 'FinTechTerms',
                body: event.data.text(),
            };
        }
    }

    event.waitUntil(showNotificationFromPayload(payload));
});

self.addEventListener('notificationclick', function (event) {
    event.notification.close();

    var url = event.notification.data && event.notification.data.url
        ? event.notification.data.url
        : '/';

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (windowClients) {
            // Check if app is already open
            for (var i = 0; i < windowClients.length; i++) {
                var client = windowClients[i];
                if (client.url.includes(self.location.origin) && 'focus' in client) {
                    client.navigate(url);
                    return client.focus();
                }
            }
            // Open new window if not
            if (clients.openWindow) {
                return clients.openWindow(url);
            }
        })
    );
});
