/// <reference types="@sveltejs/kit" />
/// <reference no-default-lib="true"/>
/// <reference lib="esnext" />
/// <reference lib="webworker" />

const CACHE_NAME = 'short-video-cache-v1';
const VIDEO_CACHE_NAME = 'short-video-media-cache-v1';

const ASSETS_TO_CACHE = [
  '/',
  '/manifest.json',
  '/favicon.png',
  '/icon-192x192.png',
  '/icon-512x512.png',
];

// Install event - cache core assets
self.addEventListener('install', (event: ExtendableEvent) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS_TO_CACHE))
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event: ExtendableEvent) => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames
          .filter(name => name !== CACHE_NAME && name !== VIDEO_CACHE_NAME)
          .map(name => caches.delete(name))
      );
    })
  );
});

// Fetch event - serve from cache or network
self.addEventListener('fetch', (event: FetchEvent) => {
  const url = new URL(event.request.url);

  // Handle video files differently
  if (url.pathname.match(/\.(mp4|webm)$/)) {
    event.respondWith(handleVideoFetch(event.request));
    return;
  }

  // Handle API requests
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(handleApiRequest(event.request));
    return;
  }

  // Handle static assets and other requests
  event.respondWith(
    caches.match(event.request).then(response => {
      return response || fetchAndCache(event.request);
    })
  );
});

// Handle video file requests
async function handleVideoFetch(request: Request): Promise<Response> {
  const cache = await caches.open(VIDEO_CACHE_NAME);
  const cachedResponse = await cache.match(request);

  if (cachedResponse) {
    return cachedResponse;
  }

  const response = await fetch(request);
  if (response.ok) {
    const clonedResponse = response.clone();
    cache.put(request, clonedResponse);
  }
  return response;
}

// Handle API requests
async function handleApiRequest(request: Request): Promise<Response> {
  try {
    const response = await fetch(request);
    if (response.ok && request.method === 'GET') {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    throw error;
  }
}

// Fetch and cache
async function fetchAndCache(request: Request): Promise<Response> {
  const response = await fetch(request);
  if (response.ok) {
    const cache = await caches.open(CACHE_NAME);
    cache.put(request, response.clone());
  }
  return response;
}

// Background sync for offline actions
self.addEventListener('sync', (event: SyncEvent) => {
  if (event.tag === 'sync-likes') {
    event.waitUntil(syncLikes());
  } else if (event.tag === 'sync-comments') {
    event.waitUntil(syncComments());
  }
});

// Push notification handling
self.addEventListener('push', (event: PushEvent) => {
  if (!event.data) return;

  const data = event.data.json();
  const options = {
    body: data.body,
    icon: '/icon-192x192.png',
    badge: '/badge-96x96.png',
    vibrate: [100, 50, 100],
    data: {
      url: data.url
    }
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// Notification click handling
self.addEventListener('notificationclick', (event: NotificationEvent) => {
  event.notification.close();

  if (event.notification.data?.url) {
    event.waitUntil(
      clients.openWindow(event.notification.data.url)
    );
  }
});

// IndexedDB helper function
async function openDB() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open('short-video-db', 1);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      
      if (!db.objectStoreNames.contains('likes')) {
        db.createObjectStore('likes', { keyPath: 'id' });
      }
      
      if (!db.objectStoreNames.contains('comments')) {
        db.createObjectStore('comments', { keyPath: 'id' });
      }
    };
  });
}

// Sync likes
async function syncLikes() {
  const db = await openDB();
  const transaction = db.transaction('likes', 'readwrite');
  const store = transaction.objectStore('likes');
  const likes = await store.getAll();

  for (const like of likes) {
    try {
      const response = await fetch('/api/likes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(like)
      });

      if (response.ok) {
        await store.delete(like.id);
      }
    } catch (error) {
      console.error('Failed to sync like:', error);
    }
  }
}

// Sync comments
async function syncComments() {
  const db = await openDB();
  const transaction = db.transaction('comments', 'readwrite');
  const store = transaction.objectStore('comments');
  const comments = await store.getAll();

  for (const comment of comments) {
    try {
      const response = await fetch('/api/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(comment)
      });

      if (response.ok) {
        await store.delete(comment.id);
      }
    } catch (error) {
      console.error('Failed to sync comment:', error);
    }
  }
} 