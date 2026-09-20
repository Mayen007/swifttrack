// client/src/components/inventory/InventoryHeader.jsx
import React from 'react';
import { Package, RotateCcw, ArrowRightLeft, ShieldAlert, AlertTriangle } from 'lucide-react';

export function InventoryHeader({
  loading,
  lastSyncTime,
  onRefresh,
  onOpenTransfer,
  onOpenStateTransition,
}) {
  return (
    <div className="bg-[#12161f] border border-[#222834] rounded p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
      <div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-mono text-[10px] font-bold tracking-wider uppercase">
            <Package className="w-3 h-3" />
            PHASE 3: INVENTORY STATE ENGINE
          </span>
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-blue-500/10 border border-blue-500/20 text-blue-400 font-mono text-[10px]">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0" />
            6-STATE INVARIANT ENFORCED
          </span>
        </div>
        <h1 className="text-lg font-bold text-white tracking-tight flex items-center gap-2 mt-1">
          <Package className="w-5 h-5 text-emerald-400" />
          Multi-Branch Inventory & State Machine
        </h1>
        <p className="text-xs text-slate-400 mt-0.5">
          Real-time stock ledger tracking On-Hand, Available, Reserved, In-Transit, Damaged, and Expired states
        </p>
      </div>

      {/* Action Switchboard */}
      <div className="flex items-center flex-wrap gap-2 shrink-0">
        <button
          onClick={onOpenStateTransition}
          title="Quarantine damaged or segregate expired goods"
          className="px-3 py-1.5 rounded border border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/20 text-xs font-mono text-rose-300 flex items-center gap-1.5 transition-colors cursor-pointer"
        >
          <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
          <span>QUARANTINE / EXPIRE</span>
        </button>

        <button
          onClick={onOpenTransfer}
          title="Initiate inter-branch stock transfer"
          className="px-3 py-1.5 rounded border border-blue-500/30 bg-blue-500/10 hover:bg-blue-500/20 text-xs font-mono text-blue-300 flex items-center gap-1.5 transition-colors cursor-pointer"
        >
          <ArrowRightLeft className="w-3.5 h-3.5 text-blue-400" />
          <span>NEW TRANSFER</span>
        </button>

        <button
          onClick={onRefresh}
          disabled={loading}
          title="Synchronize inventory ledger with database"
          className="px-2.5 py-1.5 rounded border border-[#222834] bg-[#181d28] hover:bg-[#202736] text-xs font-mono text-slate-300 hover:text-white flex items-center gap-1.5 transition-colors cursor-pointer"
        >
          <RotateCcw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-emerald-400' : 'text-slate-400'}`} />
          <span>{lastSyncTime ? `SYNC (${lastSyncTime})` : 'SYNC'}</span>
        </button>
      </div>
    </div>
  );
}
