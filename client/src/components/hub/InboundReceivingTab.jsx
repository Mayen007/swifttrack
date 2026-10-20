import React from 'react';
import { ScanBarcode, Plus, CheckCircle2, Play, RefreshCw } from 'lucide-react';

export function InboundReceivingTab({
  scanInput,
  setScanInput,
  isDamagedScan,
  setIsDamagedScan,
  sessionScannedItems,
  sessions,
  sessionsError,
  sessionsLoading,
  activeReceivingSession,
  openingSession,
  completingSession,
  onOpenReceivingSession,
  onReceivingScan,
  onReconcileSession
}) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 bg-[#12161f] border border-[#222834] p-3.5 sm:p-4 rounded-xl space-y-5">
        <div className="flex items-center justify-between pb-3 border-b border-[#222834]">
          <div>
            <h3 className="font-bold text-white text-sm">Inbound Receiving</h3>
            <p className="text-xs text-slate-400">Match physical barcodes against incoming linehaul manifest</p>
          </div>
          {activeReceivingSession ? (
            <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-blue-500/10 text-blue-300 border border-blue-500/20">
              {activeReceivingSession.session_number}
            </span>
          ) : (
            <button
              className="px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-1.5"
              disabled={openingSession || sessionsLoading || Boolean(sessionsError)}
              onClick={onOpenReceivingSession}
              type="button"
            >
              {openingSession ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
              Open receiving session
            </button>
          )}
        </div>

        <form onSubmit={onReceivingScan} className="space-y-3">
          <div className="relative">
            <ScanBarcode className="w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 text-blue-400" />
            <input
              type="text"
              placeholder="Scan or enter parcel barcode (e.g. SWT-PL-2026-001)..."
              value={scanInput}
              onChange={(e) => setScanInput(e.target.value)}
              disabled={!activeReceivingSession}
              className="w-full pl-11 pr-4 py-3 bg-[#181d28] border border-[#222834] rounded-xl text-sm text-white placeholder-slate-500 font-mono focus:outline-none focus:border-blue-500"
              autoFocus
            />
          </div>

          <div className="flex items-center justify-between text-xs">
            <label className="flex items-center gap-2 cursor-pointer text-slate-300">
              <input
                type="checkbox"
                checked={isDamagedScan}
                onChange={(e) => setIsDamagedScan(e.target.checked)}
                disabled={!activeReceivingSession}
                className="rounded border-[#222834] bg-[#181d28] text-rose-500 focus:ring-0"
              />
              <span className={isDamagedScan ? 'text-rose-400 font-bold' : ''}>
                Flag as Damaged on Intake
              </span>
            </label>

            <button
              type="submit"
              disabled={!activeReceivingSession || !scanInput.trim()}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow"
            >
              <Plus className="w-4 h-4" />
              Register Scan
            </button>
          </div>
        </form>

        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-semibold text-slate-400">
            <span>
              {activeReceivingSession ? `Scanned parcels (${sessionScannedItems.length})` : 'Current session scans'}
            </span>
            {activeReceivingSession && (
              <div className="flex flex-col items-end gap-1">
                {activeReceivingSession.expected_packages_count > 0 && (
                  <span className="font-normal text-[10px] text-slate-500">
                    Completion checks the manifest and flags parcels not scanned.
                  </span>
                )}
                <button
                  disabled={completingSession}
                  onClick={onReconcileSession}
                  className="text-emerald-400 hover:underline flex items-center gap-1 cursor-pointer disabled:opacity-50"
                  type="button"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  {completingSession ? 'Completing…' : 'Complete & reconcile session'}
                </button>
              </div>
            )}
          </div>

          <div className="bg-[#181d28] border border-[#222834] rounded-xl max-h-64 overflow-y-auto divide-y divide-[#222834]">
            {!activeReceivingSession ? (
              <p className="p-6 text-center text-xs text-slate-500">
                Open a receiving session to start scanning inbound parcels.
              </p>
            ) : sessionScannedItems.length === 0 ? (
              <p className="p-6 text-center text-xs text-slate-500 italic">
                This session has no scans yet. Use a handheld reader or enter a parcel barcode above.
              </p>
            ) : (
              sessionScannedItems.map((item) => (
                <div key={item.id} className="p-3 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2.5">
                    <span className="font-mono font-bold text-white">{item.barcode}</span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      item.is_damaged ? 'bg-rose-500/10 text-rose-400' : 'bg-emerald-500/10 text-emerald-400'
                    }`}>
                      {item.status}
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-500 font-mono">{item.scanned_at}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="bg-[#12161f] border border-[#222834] p-3.5 sm:p-4 rounded-xl space-y-4">
        <h3 className="font-bold text-white text-sm">Recent Receiving Sessions</h3>
        <div className="space-y-3">
          {sessionsError ? (
            <p className="rounded-lg border border-rose-500/20 bg-rose-500/5 p-3 text-xs text-rose-300" role="alert">
              {sessionsError}
            </p>
          ) : sessionsLoading ? (
            <p className="flex items-center justify-center gap-2 p-4 text-xs text-slate-400">
              <RefreshCw className="h-3.5 w-3.5 animate-spin" />
              Loading receiving sessions…
            </p>
          ) : sessions.length === 0 ? (
            <p className="rounded-lg border border-dashed border-[#30394a] p-4 text-center text-xs text-slate-500">
              No receiving sessions at this branch yet.
            </p>
          ) : sessions.map((sess) => (
            <div key={sess.id} className="bg-[#181d28] border border-[#222834] p-3.5 rounded-xl space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-mono font-bold text-white">{sess.session_number}</span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                  sess.status === 'IN_PROGRESS'
                    ? 'bg-blue-500/10 text-blue-300'
                    : sess.status === 'DISCREPANCY_FLAGGED'
                      ? 'bg-rose-500/10 text-rose-300'
                      : 'bg-emerald-500/10 text-emerald-400'
                }`}>
                  {sess.status.replaceAll('_', ' ')}
                </span>
              </div>
              <div className="text-[11px] text-slate-400 flex items-center justify-between">
                <span>Expected: {sess.expected_packages_count}</span>
                <span>Scanned: {sess.scanned_packages_count}</span>
                <span className="text-emerald-400">Intact: {sess.intact_count}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
