// Service Worker for Push Notifications

self.addEventListener('push', function(event) {
  if (!event.data) {
    console.warn('Push event received but no data');
    return;
  }

  try {
    const data = event.data.json();
    const options = {
      body: data.body,
      icon: '/icon-192x192.png', // Replace with your app icon
      badge: '/badge-72x72.png', // Replace with your notification badge
      vibrate: [100, 50, 100],
      data: data.data || {},
      actions: data.data?.actions || [],
      tag: data.id || 'default',
      renotify: true,
      requireInteraction: data.priority === 'urgent' || data.priority === 'high'
    };

    event.waitUntil(
      self.registration.showNotification(data.title, options)
    );
  } catch (error) {
    console.error('Failed to handle push event:', error);
  }
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();

  // Handle notification click
  const clickAction = event.action || 'default';
  const notificationData = event.notification.data;

  if (notificationData.actionUrl) {
    event.waitUntil(
      clients.openWindow(notificationData.actionUrl)
    );
    return;
  }

  // Focus existing window/tab if available
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(function(clientList) {
        if (clientList.length > 0) {
          let client = clientList[0];
          for (let i = 0; i < clientList.length; i++) {
            if (clientList[i].focused) {
              client = clientList[i];
            }
          }
          return client.focus();
        }
        return clients.openWindow('/');
      })
  );
});

self.addEventListener('notificationclose', function(event) {
  // Handle notification close
  const notification = event.notification;
  const data = notification.data;

  // You can track notification dismissals here if needed
  console.log('Notification closed:', notification.tag);
});

// Handle service worker installation
self.addEventListener('install', function(event) {
  event.waitUntil(self.skipWaiting());
});

// Handle service worker activation
self.addEventListener('activate', function(event) {
  event.waitUntil(self.clients.claim());
}); 