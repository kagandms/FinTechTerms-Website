// FinTechTerms Notification Service Worker
// Handles push notifications for daily review reminders

self.addEventListener('message', function (event) {
    if (event.data && event.data.type === 'SHOW_NOTIFICATION') {
        self.registration.showNotification(event.data.title, {
            body: event.data.body,
            icon: '/icons/icon-192.png',
            badge: '/icons/icon-72.png',
            tag: 'daily-reminder',
            renotify: true,
            data: {
                url: '/',
            },
        });
    }
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
