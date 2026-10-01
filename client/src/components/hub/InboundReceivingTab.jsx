import React from 'react';
import { ScanBarcode, Plus, CheckCircle2 } from 'lucide-react';

export function InboundReceivingTab({
  scanInput,
  setScanInput,
  isDamagedScan,
  setIsDamagedScan,
  sessionScannedItems,
  sessions,
  onReceivingScan,
  onReconcileSession
}) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 bg-[#12161f] border border-[#222834] p-3.5 sm:p-4 rounded-xl space-y-5">
        <div className="flex items-center justify-between pb-3 border-b border-[#222834]">
          <div>
            <h3 className="font-bold text-white text-sm">Active Inbound Unloading Console</h3>
            <p className="text-xs text-slate-400">Match physical barcodes against incoming linehaul manifest</p>
          </div>
          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            Session Active
          </span>
        </div>

        <form onSubmit={onReceivingScan} className="space-y-3">
          <div className="relative">
            <ScanBarcode className="w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 text-blue-400" />
            <input
              type="text"
              placeholder="Scan or enter parcel barcode (e.g. SWT-PL-2026-001)..."
              value={scanInput}
              onChange={(e) => setScanInput(e.target.value)}
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
                className="rounded border-[#222834] bg-[#181d28] text-rose-500 focus:ring-0"
              />
              <span className={isDamagedScan ? 'text-rose-400 font-bold' : ''}>
                Flag as Damaged on Intake
              </span>
            </label>

            <button
              type="submit"
              disabled={!scanInput.trim()}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow"
            >
              <Plus className="w-4 h-4" />
              Register Scan
            </button>
          </div>
        </form>

        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-400">
            <span>Scanned Parcels in Session ({sessionScannedItems.length})</span>
            {sessionScannedItems.length > 0 && (
              <button
                onClick={onReconcileSession}
                className="text-emerald-400 hover:underline flex items-center gap-1 cursor-pointer"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                Complete & Reconcile Session
              </button>
            )}
          </div>

          <div className="bg-[#181d28] border border-[#222834] rounded-xl max-h-64 overflow-y-auto divide-y divide-[#222834]">
            {sessionScannedItems.length === 0 ? (
              <p className="p-6 text-center text-xs text-slate-500 italic">
                Awaiting barcode scans. Use a handheld reader or enter manual barcodes above.
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
          {sessions.map((sess) => (
            <div key={sess.id} className="bg-[#181d28] border border-[#222834] p-3.5 rounded-xl space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-mono font-bold text-white">{sess.session_number}</span>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400">
                  {sess.status}
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
