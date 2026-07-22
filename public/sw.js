// public/sw.js
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore-compat.js');

const DB_NAME = 'VocabOfflineCache';
const DB_VERSION = 1;

const STATIC_CACHE_NAME = 'vocab-pwa-static-v2';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE_NAME).then((cache) => {
      console.log('[SW] Caching static shell assets');
      return cache.addAll(STATIC_ASSETS).catch(err => {
        console.warn('[SW] Caching assets warning:', err);
      });
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== STATIC_CACHE_NAME) {
            console.log('[SW] Clearing old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Offline Fetch Interceptor for Static Assets
self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // Skip non-GET methods and external backend / Firestore / extension APIs
  if (request.method !== 'GET') return;
  if (
    url.hostname.includes('firestore.googleapis.com') ||
    url.hostname.includes('identitytoolkit.googleapis.com') ||
    url.hostname.includes('firebase') ||
    url.protocol === 'chrome-extension:'
  ) {
    return;
  }

  // HTML Page Navigation Strategy: Network-first, fallback to cache
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(STATIC_CACHE_NAME).then((cache) => {
              cache.put(request, responseClone);
            });
          }
          return networkResponse;
        })
        .catch(() => {
          return caches.match(request).then((cachedResponse) => {
            return cachedResponse || caches.match('/index.html');
          });
        })
    );
    return;
  }

  // Static Assets Strategy (JS, CSS, Images, Fonts): Stale-While-Revalidate / Cache-first
  if (
    request.destination === 'script' ||
    request.destination === 'style' ||
    request.destination === 'image' ||
    request.destination === 'font' ||
    url.pathname.endsWith('.js') ||
    url.pathname.endsWith('.css') ||
    url.pathname.endsWith('.png') ||
    url.pathname.endsWith('.jpg') ||
    url.pathname.endsWith('.svg') ||
    url.pathname.endsWith('.woff2')
  ) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        const fetchPromise = fetch(request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              const responseClone = networkResponse.clone();
              caches.open(STATIC_CACHE_NAME).then((cache) => {
                cache.put(request, responseClone);
              });
            }
            return networkResponse;
          })
          .catch(() => {
            console.log('[SW] Offline fallback for asset:', request.url);
          });
        return cachedResponse || fetchPromise;
      })
    );
    return;
  }
});

// Function to open IndexedDB
function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// Function to get a value from IDB store
function getFromStore(db, storeName, key) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([storeName], 'readonly');
    const store = transaction.objectStore(storeName);
    const request = store.get(key);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// Function to clear sync queue
function clearSyncQueue(db) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['syncQueue'], 'readwrite');
    const store = transaction.objectStore('syncQueue');
    const request = store.clear();
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

// Function to sync progress to cloud
async function syncProgress() {
  try {
    const db = await openDB();
    
    // Get meta configs
    const firebaseConfigMeta = await getFromStore(db, 'meta', 'firebaseConfig');
    const uidMeta = await getFromStore(db, 'meta', 'uid');
    
    if (!firebaseConfigMeta || !uidMeta) {
      console.log('[SW] No user or firebase config stored for offline sync.');
      return;
    }

    const config = firebaseConfigMeta.value;
    const uid = uidMeta.value;

    // Check if we have queued sync items
    const transaction = db.transaction(['syncQueue'], 'readonly');
    const queueStore = transaction.objectStore('syncQueue');
    const queuedItems = await new Promise((resolve, reject) => {
      const req = queueStore.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });

    if (queuedItems.length === 0) {
      console.log('[SW] Sync queue is empty.');
      return;
    }

    console.log(`[SW] Found ${queuedItems.length} items to sync.`);

    // Retrieve full progress data to sync safely
    const progressRecord = await getFromStore(db, 'progress', 'current_progress');
    if (!progressRecord || !progressRecord.data) {
      console.log('[SW] No progress data to sync.');
      return;
    }

    // Initialize firebase in SW context if not already initialized
    let app;
    if (firebase.apps.length === 0) {
      app = firebase.initializeApp(config);
    } else {
      app = firebase.app();
    }

    const dbId = config.firestoreDatabaseId || '(default)';
    let firestoreDb;
    if (dbId && dbId !== '(default)') {
      try {
        firestoreDb = firebase.app().firestore(dbId);
      } catch (err) {
        firestoreDb = firebase.firestore(app);
      }
    } else {
      firestoreDb = firebase.firestore(app);
    }

    const userDocRef = firestoreDb.collection('users').doc(uid);

    await userDocRef.set({
      progress: progressRecord.data,
      updatedAt: new Date().toISOString()
    }, { merge: true });

    // Clear queue after successful synchronization
    await clearSyncQueue(db);
    console.log('[SW] Background synchronization completed successfully!');

    // Broadcast to any active client that sync is complete
    const clientsList = await self.clients.matchAll();
    clientsList.forEach(client => {
      client.postMessage({ type: 'SYNC_COMPLETE', progress: progressRecord.data });
    });

  } catch (error) {
    console.error('[SW] Sync failed:', error);
    throw error; // Propagate error so browser knows to retry
  }
}

// Listen for the sync event
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-progress') {
    event.waitUntil(syncProgress());
  }
});

// Also support message-triggered sync or online recovery
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'TRIGGER_SYNC') {
    event.waitUntil(syncProgress());
  }
});
