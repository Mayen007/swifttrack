// client/src/services/offlineQueue.js
// SwiftTrack Logistics: Track 5.1 Client-Side Offline Queue Persistence (IndexedDB + LocalStorage Fallback)
// Durable offline-first storage for field scans, intake, deliveries, and POD signatures (PRD Section 21)

const DB_NAME = 'swifttrack_offline_db';
const DB_VERSION = 1;
const STORE_NAME = 'offline_queue';
const FALLBACK_KEY = 'swifttrack_offline_operations_queue_v1';

let dbInstance = null;

/**
 * Generate RFC 4122 v4 compliant UUID with optional domain prefix
 */
export function generateClientOperationId(prefix = 'OP') {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  // Standard RFC 4122 v4 fallback
  const uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
  return `${prefix}-${uuid}`;
}

/**
 * Initializes and caches the IndexedDB connection
 */
export function openOfflineDB() {
  if (typeof window === 'undefined' || !window.indexedDB) {
    return Promise.resolve(null);
  }

  if (dbInstance) {
    return Promise.resolve(dbInstance);
  }

  return new Promise((resolve) => {
    try {
      const request = window.indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'operation_id' });
          store.createIndex('client_timestamp', 'client_timestamp', { unique: false });
          store.createIndex('operation_type', 'operation_type', { unique: false });
        }
      };

      request.onsuccess = (event) => {
        dbInstance = event.target.result;
        resolve(dbInstance);
      };

      request.onerror = (err) => {
        console.warn('[OfflineQueue] IndexedDB open error, using localStorage fallback:', err);
        resolve(null);
      };
    } catch (e) {
      console.warn('[OfflineQueue] IndexedDB initialization failed:', e);
      resolve(null);
    }
  });
}

/**
 * Enqueue an operation into IndexedDB (with fallback to localStorage)
 * @param {string} operationType - CUSTODY_SCAN, HUB_RECEIVE, DELIVERY_ATTEMPT, DELIVERY_POD, DRIVER_LOCATION
 * @param {Object} payload - Domain payload
 */
export async function enqueueOfflineOperation(operationType, payload = {}) {
  const operationId = generateClientOperationId(String(operationType).slice(0, 4));
  const operation = {
    operation_id: operationId,
    operation_type: String(operationType).toUpperCase(),
    payload,
    client_timestamp: new Date().toISOString(),
    status: 'QUEUED'
  };

  const db = await openOfflineDB();

  if (db) {
    return new Promise((resolve, reject) => {
      try {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        store.put(operation);
        tx.oncomplete = () => resolve(operation);
        tx.onerror = (err) => reject(err);
      } catch (err) {
        // Fallback to localStorage on transaction error
        fallbackSaveItem(operation);
        resolve(operation);
      }
    });
  }

  // Fallback storage
  fallbackSaveItem(operation);
  return operation;
}

/**
 * Retrieve all queued operations in FIFO order
 */
export async function getQueuedOperations() {
  const db = await openOfflineDB();

  if (db) {
    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const request = store.getAll();

        request.onsuccess = () => {
          const items = request.result || [];
          items.sort((a, b) => new Date(a.client_timestamp) - new Date(b.client_timestamp));
          resolve(items);
        };

        request.onerror = () => {
          resolve(fallbackGetItems());
        };
      } catch {
        resolve(fallbackGetItems());
      }
    });
  }

  return fallbackGetItems();
}

/**
 * Remove an array of acknowledged operation IDs from the queue
 */
export async function removeOperations(operationIds = []) {
  if (!operationIds || operationIds.length === 0) return;
  const idSet = new Set(operationIds);

  const db = await openOfflineDB();

  if (db) {
    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        for (const id of operationIds) {
          store.delete(id);
        }
        tx.oncomplete = () => resolve();
        tx.onerror = () => {
          fallbackRemoveItems(idSet);
          resolve();
        };
      } catch {
        fallbackRemoveItems(idSet);
        resolve();
      }
    });
  }

  fallbackRemoveItems(idSet);
}

/**
 * Clear the entire offline queue
 */
export async function clearOfflineQueue() {
  const db = await openOfflineDB();

  if (db) {
    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        store.clear();
        tx.oncomplete = () => {
          fallbackClear();
          resolve();
        };
      } catch {
        fallbackClear();
        resolve();
      }
    });
  }

  fallbackClear();
}

/**
 * Get count of pending queued operations
 */
export async function getPendingQueueCount() {
  const items = await getQueuedOperations();
  return items.length;
}

// ─── LocalStorage Fallback Helpers ──────────────────────────────────────────

function fallbackGetItems() {
  if (typeof window === 'undefined' || !window.localStorage) return [];
  try {
    const raw = localStorage.getItem(FALLBACK_KEY);
    const items = raw ? JSON.parse(raw) : [];
    items.sort((a, b) => new Date(a.client_timestamp) - new Date(b.client_timestamp));
    return items;
  } catch {
    return [];
  }
}

function fallbackSaveItem(operation) {
  const items = fallbackGetItems();
  items.push(operation);
  try {
    localStorage.setItem(FALLBACK_KEY, JSON.stringify(items));
  } catch (e) {
    console.error('[OfflineQueue] Fallback localStorage write failed:', e);
  }
}

function fallbackRemoveItems(idSet) {
  const items = fallbackGetItems();
  const filtered = items.filter(i => !idSet.has(i.operation_id));
  try {
    localStorage.setItem(FALLBACK_KEY, JSON.stringify(filtered));
  } catch {}
}

function fallbackClear() {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    localStorage.removeItem(FALLBACK_KEY);
  } catch {}
}
