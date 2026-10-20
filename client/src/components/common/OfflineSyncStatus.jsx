// client/src/components/common/OfflineSyncStatus.jsx
// SwiftTrack Logistics: Track 5.2 Real-time Offline Connectivity & Sync Worker Status Component
import React, { useState, useEffect, useCallback } from 'react';
import { Wifi, WifiOff, RefreshCw, CheckCircle2, AlertTriangle, Database } from 'lucide-react';
import { api } from '../../services/api.js';
import {
  initAutoSync,
  syncOfflineQueue,
  getPendingQueueCount
} from '../../services/offlineSyncService.js';

export function OfflineSyncStatus() {
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncSuccess, setLastSyncSuccess] = useState(null);

  // Refresh pending count
  const refreshCount = useCallback(async () => {
    try {
      const count = await getPendingQueueCount();
      setPendingCount(count);
    } catch {}
  }, []);

  useEffect(() => {
    refreshCount();

    const handleOnline = () => {
      setIsOnline(true);
      refreshCount();
    };

    const handleOffline = () => {
      setIsOnline(false);
      refreshCount();
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Initialize auto-sync worker
    const unbind = initAutoSync(api, (status) => {
      setIsSyncing(status.isSyncing);
      setPendingCount(status.pending || 0);

      if (status.lastReport && status.lastReport.processed_count > 0) {
        setLastSyncSuccess(`Synced ${status.lastReport.processed_count} operations`);
        setTimeout(() => setLastSyncSuccess(null), 4000);
      }
    });

    // Check count every 5 seconds
    const interval = setInterval(refreshCount, 5000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      unbind();
      clearInterval(interval);
    };
  }, [refreshCount]);

  const handleManualSync = async () => {
    if (isSyncing || !isOnline) return;
    setIsSyncing(true);
    try {
      const report = await syncOfflineQueue(api);
      setPendingCount(report.remaining_pending || 0);
      if (report.processed_count > 0) {
        setLastSyncSuccess(`Synced ${report.processed_count} operations`);
        setTimeout(() => setLastSyncSuccess(null), 4000);
      }
    } catch (err) {
      console.error('Manual sync failed:', err);
    } finally {
      setIsSyncing(false);
    }
  };

  // If online and no pending items and no recent sync message, remain unobtrusive
  if (isOnline && pendingCount === 0 && !lastSyncSuccess && !isSyncing) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 animate-fadeIn">
      <div className={`flex items-center gap-2.5 px-3.5 py-2 rounded-xl text-xs font-semibold shadow-2xl backdrop-blur-md border transition-all ${
        !isOnline
          ? 'bg-rose-950/90 text-rose-200 border-rose-500/40 shadow-rose-950/50'
          : isSyncing
          ? 'bg-amber-950/90 text-amber-200 border-amber-500/40 shadow-amber-950/50'
          : lastSyncSuccess
          ? 'bg-emerald-950/90 text-emerald-200 border-emerald-500/40 shadow-emerald-950/50'
          : 'bg-slate-900/90 text-slate-200 border-slate-700/60 shadow-slate-950/50'
      }`}>
        {/* Status Icon */}
        {!isOnline ? (
          <div className="flex items-center gap-1.5">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
            </span>
            <WifiOff className="w-4 h-4 text-rose-400" />
            <span>Offline Mode</span>
          </div>
        ) : isSyncing ? (
          <div className="flex items-center gap-1.5">
            <RefreshCw className="w-4 h-4 text-amber-400 animate-spin" />
            <span>Syncing Queue...</span>
          </div>
        ) : lastSyncSuccess ? (
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>{lastSyncSuccess}</span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5">
            <Wifi className="w-4 h-4 text-blue-400" />
            <span>Connected</span>
          </div>
        )}

        {/* Pending Operations Badge */}
        {pendingCount > 0 && (
          <div className="flex items-center gap-1 pl-2 border-l border-white/10 font-mono">
            <Database className="w-3.5 h-3.5 text-slate-400" />
            <span className="bg-white/10 px-1.5 py-0.5 rounded text-[11px] font-bold">
              {pendingCount} {pendingCount === 1 ? 'op' : 'ops'} queued
            </span>
          </div>
        )}

        {/* Manual Sync Button when online and pending items exist */}
        {isOnline && pendingCount > 0 && !isSyncing && (
          <button
            type="button"
            onClick={handleManualSync}
            className="ml-1 px-2 py-0.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-bold transition-colors cursor-pointer"
            title="Replay queued offline operations now"
          >
            Sync Now
          </button>
        )}
      </div>
    </div>
  );
}
