// client/src/services/offlineSyncService.js
// SwiftTrack Logistics: Client-side Durable Offline Operations Queue & Auto-Sync Worker (PRD Section 21)

import {
  enqueueOfflineOperation,
  getQueuedOperations,
  removeOperations,
  clearOfflineQueue,
  getPendingQueueCount,
  generateClientOperationId
} from './offlineQueue.js';

const SYNC_ENDPOINT = '/api/v1/offline/sync';

export {
  generateClientOperationId,
  enqueueOfflineOperation,
  getQueuedOperations,
  removeOperations,
  clearOfflineQueue,
  getPendingQueueCount
};

/**
 * Backward compatibility alias for enqueueOfflineOperation
 */
export async function queueOfflineOperation(operationType, payload = {}) {
  return await enqueueOfflineOperation(operationType, payload);
}

/**
 * Synchronizes the pending offline queue with the backend server
 * @param {Object} apiClient - Configured API client or fetch wrapper with auth header
 * @returns {Promise<Object>} Synchronization report
 */
export async function syncOfflineQueue(apiClient) {
  const queue = await getQueuedOperations();
  if (!queue || queue.length === 0) {
    return {
      success: true,
      processed_count: 0,
      duplicate_count: 0,
      error_count: 0,
      remaining_pending: 0
    };
  }

  try {
    const deviceId = typeof window !== 'undefined'
      ? (localStorage.getItem('swifttrack_device_id') || 'WEB_CLIENT')
      : 'WEB_CLIENT';

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
    // Results from server are in response.results or response.operations
    const results = response?.results || response?.operations || (Array.isArray(response) ? response : []);
    const ackIds = [];

    for (const r of results) {
      if (r.status === 'ACKNOWLEDGED' || r.status === 'DUPLICATE') {
        ackIds.push(r.operation_id);
      }
    }

    if (ackIds.length > 0) {
      await removeOperations(ackIds);
    }

    const remainingCount = await getPendingQueueCount();

    return {
      success: true,
      processed_count: response?.processed_count !== undefined ? response.processed_count : ackIds.length,
      duplicate_count: response?.duplicate_count || 0,
      results,
      remaining_pending: remainingCount
    };
  } catch (err) {
    console.error('[OfflineSync] Synchronization error:', err);
    throw err;
  }
}

/**
 * Binds auto-sync listener to browser connectivity events & periodic heartbeat
 * @param {Object} apiClient - API client
 * @param {Function} onSyncStatusChange - Callback receiving { isSyncing, pending, lastReport, error }
 * @returns {Function} Cleanup unbind function
 */
export function initAutoSync(apiClient, onSyncStatusChange) {
  if (typeof window === 'undefined') return () => {};

  let isSyncing = false;

  const performSync = async () => {
    if (isSyncing || (typeof navigator !== 'undefined' && !navigator.onLine)) return;

    try {
      const pending = await getPendingQueueCount();
      if (pending === 0) {
        if (typeof onSyncStatusChange === 'function') {
          onSyncStatusChange({ isSyncing: false, pending: 0 });
        }
        return;
      }

      isSyncing = true;
      if (typeof onSyncStatusChange === 'function') {
        onSyncStatusChange({ isSyncing: true, pending });
      }

      const report = await syncOfflineQueue(apiClient);
      if (typeof onSyncStatusChange === 'function') {
        onSyncStatusChange({
          isSyncing: false,
          pending: report.remaining_pending,
          lastReport: report
        });
      }
    } catch (err) {
      console.warn('[OfflineSync] Auto-sync attempt error:', err.message);
      if (typeof onSyncStatusChange === 'function') {
        const pending = await getPendingQueueCount().catch(() => 0);
        onSyncStatusChange({ isSyncing: false, pending, error: err.message });
      }
    } finally {
      isSyncing = false;
    }
  };

  const handleOnline = () => {
    console.log('[OfflineSync] Network connectivity restored. Checking queue...');
    performSync();
  };

  // Heartbeat every 30 seconds
  const intervalId = setInterval(() => {
    if (typeof navigator !== 'undefined' && navigator.onLine) {
      performSync();
    }
  }, 30000);

  window.addEventListener('online', handleOnline);

  // Initial trigger
  if (typeof navigator !== 'undefined' && navigator.onLine) {
    performSync();
  }

  return () => {
    window.removeEventListener('online', handleOnline);
    clearInterval(intervalId);
  };
}
