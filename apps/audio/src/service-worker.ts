/// <reference types="@sveltejs/kit" />
/// <reference no-default-lib="true"/>
/// <reference lib="esnext" />
/// <reference lib="webworker" />

import { build, files, version } from '$service-worker';

const CACHE_NAME = `audio-cache-${version}`;
const ASSETS = [...build, ...files];

// Install event - cache core assets
self.addEventListener('install', (event: ExtendableEvent) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event: ExtendableEvent) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      );
    })
  );
});

// Fetch event - serve from cache, then network
self.addEventListener('fetch', (event: FetchEvent) => {
  const { request } = event;

  // Skip non-GET requests
  if (request.method !== 'GET') return;

  // Skip cross-origin requests
  if (!request.url.startsWith(self.location.origin)) return;

  // Handle audio files differently
  if (request.url.match(/\.(mp3|wav|ogg|m4a)$/)) {
    event.respondWith(handleAudioFetch(request));
    return;
  }

  // Handle API requests
  if (request.url.includes('/api/')) {
    event.respondWith(handleApiRequest(request));
    return;
  }

  // Handle static assets
  event.respondWith(
    caches.match(request).then((response) => {
      return response || fetchAndCache(request);
    })
  );
});

// Handle audio file requests
async function handleAudioFetch(request: Request): Promise<Response> {
  // Try cache first
  const cachedResponse = await caches.match(request);
  if (cachedResponse) return cachedResponse;

  // If not in cache, fetch and stream
  try {
    const response = await fetch(request);
    const clonedResponse = response.clone();

    // Cache the response in the background
    caches.open(CACHE_NAME).then((cache) => {
      cache.put(request, clonedResponse);
    });

    return response;
  } catch (error) {
    // Return offline fallback if available
    return caches.match('/offline.mp3');
  }
}

// Handle API requests
async function handleApiRequest(request: Request): Promise<Response> {
  try {
    // Try network first
    const response = await fetch(request);
    
    // Cache successful GET requests
    if (request.method === 'GET' && response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    
    return response;
  } catch (error) {
    // Try cache if network fails
    const cachedResponse = await caches.match(request);
    if (cachedResponse) return cachedResponse;

    // Return error response if both fail
    return new Response(JSON.stringify({ error: 'Network error' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// Fetch and cache helper function
async function fetchAndCache(request: Request): Promise<Response> {
  try {
    const response = await fetch(request);
    
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    
    return response;
  } catch (error) {
    // Return offline page for navigation requests
    if (request.mode === 'navigate') {
      return caches.match('/offline.html');
    }
    
    throw error;
  }
}

// Background sync for offline actions
self.addEventListener('sync', (event: SyncEvent) => {
  if (event.tag === 'sync-playlists') {
    event.waitUntil(syncPlaylists());
  }
  if (event.tag === 'sync-likes') {
    event.waitUntil(syncLikes());
  }
});

// Handle push notifications
self.addEventListener('push', (event: PushEvent) => {
  if (!event.data) return;

  const data = event.data.json();
  
  const options: NotificationOptions = {
    body: data.body,
    icon: '/icon-192x192.png',
    badge: '/badge-72x72.png',
    vibrate: [100, 50, 100],
    data: data.data || {},
    actions: data.actions || [],
    tag: data.tag || 'default',
    renotify: true,
    requireInteraction: data.requireInteraction || false
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// Handle notification clicks
self.addEventListener('notificationclick', (event: NotificationEvent) => {
  event.notification.close();

  const urlToOpen = new URL(
    event.notification.data?.url || '/',
    self.location.origin
  ).href;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((windowClients) => {
        // If a window client is available, focus it
        for (const client of windowClients) {
          if (client.url === urlToOpen) {
            return client.focus();
          }
        }
        // Otherwise, open a new window
        return clients.openWindow(urlToOpen);
      })
  );
});

// Sync playlists
async function syncPlaylists(): Promise<void> {
  const db = await openDB();
  const playlists = await db.getAll('playlists');
  
  for (const playlist of playlists) {
    if (playlist.needsSync) {
      try {
        await fetch('/api/playlists', {
          method: 'POST',
          body: JSON.stringify(playlist)
        });
        
        await db.put('playlists', { ...playlist, needsSync: false });
      } catch (error) {
        console.error('Failed to sync playlist:', error);
      }
    }
  }
}

// Sync likes
async function syncLikes(): Promise<void> {
  const db = await openDB();
  const likes = await db.getAll('likes');
  
  for (const like of likes) {
    if (like.needsSync) {
      try {
        await fetch('/api/likes', {
          method: 'POST',
          body: JSON.stringify(like)
        });
        
        await db.put('likes', { ...like, needsSync: false });
      } catch (error) {
        console.error('Failed to sync like:', error);
      }
    }
  }
}

// IndexedDB helper
async function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('audio-db', 1);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      
      // Create stores
      db.createObjectStore('playlists', { keyPath: 'id' });
      db.createObjectStore('likes', { keyPath: 'id' });
      db.createObjectStore('queue', { keyPath: 'id' });
    };
  });
} 