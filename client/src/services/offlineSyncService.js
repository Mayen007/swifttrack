// client/src/services/offlineSyncService.js
// SwiftTrack Logistics: Client-side Durable Offline Operations Queue & Sync Service (PRD Section 21)

const STORAGE_KEY = 'swifttrack_offline_operations_queue_v1';
const SYNC_ENDPOINT = '/api/v1/offline/sync';

/**
 * Generates a unique client operation ID for idempotent replay deduplication
 */
export function generateClientOperationId(prefix = 'OP') {
  const ts = Date.now();
  const rand = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `${prefix}-${ts}-${rand}`;
}

/**
 * Returns all currently queued operations from durable local storage
 */
export function getQueuedOperations() {
  if (typeof window === 'undefined' || !window.localStorage) return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.error('Failed to read offline operations queue:', e);
    return [];
  }
}

/**
 * Saves queued operations to local storage
 */
function saveQueuedOperations(operations) {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(operations));
  } catch (e) {
    console.error('Failed to persist offline operations queue:', e);
  }
}

/**
 * Enqueues a new operation to the durable queue
 * @param {string} operationType - SCAN, CUSTODY_HANDOFF, HUB_RECEIVE, DELIVERY_ATTEMPT, DELIVERY_POD, DRIVER_LOCATION
 * @param {Object} payload - Domain operation payload
 * @returns {Object} Enqueued operation descriptor with client_operation_id
 */
export function queueOfflineOperation(operationType, payload = {}) {
  const operationId = generateClientOperationId(operationType.slice(0, 4));
  const operation = {
    operation_id: operationId,
    operation_type: operationType,
    payload,
    client_timestamp: new Date().toISOString(),
    status: 'QUEUED'
  };

  const queue = getQueuedOperations();
  queue.push(operation);
  saveQueuedOperations(queue);

  return operation;
}

/**
 * Returns count of pending operations awaiting synchronization
 */
export function getPendingQueueCount() {
  return getQueuedOperations().length;
}

/**
 * Synchronizes the pending offline queue with the backend server
 * @param {Object} apiClient - Configured API client or fetch wrapper with auth header
 * @returns {Promise<Object>} Synchronization report
 */
export async function syncOfflineQueue(apiClient) {
  const queue = getQueuedOperations();
  if (queue.length === 0) {
    return { synced_count: 0, duplicate_count: 0, error_count: 0, pending: 0 };
  }

  try {
    const deviceId = typeof window !== 'undefined' ? (localStorage.getItem('swifttrack_device_id') || 'WEB_CLIENT') : 'WEB_CLIENT';
    const payload = {
      device_id: deviceId,
      app_version: '1.4.0',
      operations: queue.map(item => ({
        operation_id: item.operation_id,
        operation_type: item.operation_type,
        payload: item.payload,
        client_timestamp: item.client_timestamp
      }))
    };

    let response;
    if (apiClient && typeof apiClient.post === 'function') {
      response = await apiClient.post(SYNC_ENDPOINT, payload);
    } else {
      const token = typeof window !== 'undefined' ? localStorage.getItem('swifttrack_token') : null;
      const res = await fetch(SYNC_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify(payload)
      });
      response = await res.json();
    }

    // Process acknowledgement results
    if (response && Array.isArray(response.operations)) {
      const ackSet = new Set(
        response.operations
          .filter(op => op.status === 'ACKNOWLEDGED' || op.status === 'DUPLICATE')
          .map(op => op.operation_id)
      );

      // Keep only operations that were rejected or failed, prune acknowledged ones
      const remaining = queue.filter(item => !ackSet.has(item.operation_id));
      saveQueuedOperations(remaining);

      return {
        ...response,
        remaining_pending: remaining.length
      };
    }

    return response;
  } catch (err) {
    console.error('Offline synchronization error:', err);
    throw err;
  }
}

/**
 * Binds auto-sync listener to browser connectivity events
 */
export function initAutoSync(apiClient, onSyncComplete) {
  if (typeof window === 'undefined') return () => {};

  const handleOnline = async () => {
    const pending = getPendingQueueCount();
    if (pending > 0) {
      console.log(`[OfflineSync] Network restored. Synchronizing ${pending} queued operations...`);
      try {
        const report = await syncOfflineQueue(apiClient);
        if (typeof onSyncComplete === 'function') {
          onSyncComplete(report);
        }
      } catch (err) {
        console.warn('[OfflineSync] Auto-sync failed, will retry on next reconnect:', err.message);
      }
    }
  };

  window.addEventListener('online', handleOnline);
  return () => window.removeEventListener('online', handleOnline);
}
