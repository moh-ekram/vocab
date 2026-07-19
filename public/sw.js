// public/sw.js
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore-compat.js');

const DB_NAME = 'VocabOfflineCache';
const DB_VERSION = 1;

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
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
