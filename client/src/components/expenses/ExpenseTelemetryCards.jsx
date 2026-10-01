import React from 'react';
import {
  Banknote,
  Plus,
  RotateCcw,
  Fuel,
  Zap,
  FileText,
  Clock
} from 'lucide-react';
import { api } from '../../services/api.js';

export function ExpenseTelemetryCards({
  selectedBranch,
  lastSyncTime,
  loading,
  onOpenRecordModal,
  onRefresh,
  totalSettled,
  fuelMaintenanceTotal,
  utilitiesTotal,
  totalVouchers,
  pendingVouchers,
  pendingValue
}) {
  return (
    <div className="bg-[#12161f] border border-[#222834] rounded p-4 space-y-3.5">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded bg-[#181d28] border border-[#222834] flex items-center justify-center text-emerald-400">
            <Banknote className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-bold text-slate-100 uppercase tracking-wider font-mono">
                Branch Petty Cash & Operating Expenses
              </h1>
              <span className="px-2 py-0.5 rounded bg-[#181d28] border border-[#222834] text-[10px] font-mono text-slate-400">
                OVERHEAD // DISBURSEMENTS
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5 font-mono">
              STATION: <span className="text-slate-200 font-semibold">{selectedBranch?.name || 'Central Hub'}</span>
              <span className="mx-2 text-[#222834]">|</span>
              FLOAT: <span className="text-emerald-400 font-bold">KSh 50,000.00 REPLENISHED</span>
              {lastSyncTime && <span className="ml-1 text-slate-500 font-mono">({lastSyncTime} EAT)</span>}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onOpenRecordModal}
            className="h-8 px-3.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-mono font-bold uppercase tracking-wider flex items-center gap-1.5 transition-colors cursor-pointer shadow-md shadow-emerald-950"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Record Expense Voucher</span>
          </button>

          <button
            onClick={onRefresh}
            disabled={loading}
            className="h-8 px-3 rounded bg-[#0c0e12] hover:bg-[#181d28] border border-[#222834] text-slate-300 hover:text-white text-xs font-mono font-medium flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
            title="Refresh expense vouchers"
          >
            <RotateCcw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-emerald-400' : 'text-slate-400'}`} />
            <span>SYNC</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-px bg-[#222834] border border-[#222834] rounded overflow-hidden">
        <div className="bg-[#0c0e12] p-2.5 flex items-center justify-between min-w-0">
          <div className="min-w-0">
            <span className="text-[10px] text-slate-500 font-mono uppercase tracking-wider block truncate">Total Settled Overhead</span>
            <span className="text-base sm:text-lg font-mono font-bold text-rose-400 tabular-nums truncate block" title={api.formatKES(totalSettled)}>
              {totalSettled >= 1000000 ? api.formatCompactKES(totalSettled) : api.formatKES(totalSettled)}
            </span>
          </div>
          <Banknote className="w-4 h-4 text-rose-500 shrink-0 ml-1" />
        </div>

        <div className="bg-[#0c0e12] p-2.5 flex items-center justify-between min-w-0">
          <div className="min-w-0">
            <span className="text-[10px] text-amber-400 font-mono uppercase tracking-wider block truncate">Fuel & Fleet Maint</span>
            <span className="text-base sm:text-lg font-mono font-bold text-amber-400 tabular-nums truncate block" title={api.formatKES(fuelMaintenanceTotal)}>
              {fuelMaintenanceTotal >= 1000000 ? api.formatCompactKES(fuelMaintenanceTotal) : api.formatKES(fuelMaintenanceTotal)}
            </span>
          </div>
          <Fuel className="w-4 h-4 text-amber-500 shrink-0 ml-1" />
        </div>

        <div className="bg-[#0c0e12] p-2.5 flex items-center justify-between min-w-0">
          <div className="min-w-0">
            <span className="text-[10px] text-indigo-400 font-mono uppercase tracking-wider block truncate">Utilities & Packaging</span>
            <span className="text-base sm:text-lg font-mono font-bold text-indigo-400 tabular-nums truncate block" title={api.formatKES(utilitiesTotal)}>
              {utilitiesTotal >= 1000000 ? api.formatCompactKES(utilitiesTotal) : api.formatKES(utilitiesTotal)}
            </span>
          </div>
          <Zap className="w-4 h-4 text-indigo-500 shrink-0 ml-1" />
        </div>

        <div className="bg-[#0c0e12] p-2.5 flex items-center justify-between min-w-0">
          <div className="min-w-0">
            <span className="text-[10px] text-slate-400 font-mono uppercase tracking-wider block truncate">Active Vouchers</span>
            <span className="text-base sm:text-lg font-mono font-bold text-slate-100 tabular-nums truncate block">{totalVouchers}</span>
          </div>
          <FileText className="w-4 h-4 text-slate-500 shrink-0 ml-1" />
        </div>

        <div className="bg-[#0c0e12] p-2.5 flex items-center justify-between min-w-0 col-span-2 sm:col-span-1">
          <div className="min-w-0">
            <span className="text-[10px] text-amber-400 font-mono uppercase tracking-wider block truncate">Pending Approval</span>
            <span className="text-base sm:text-lg font-mono font-bold text-amber-300 tabular-nums truncate block" title={api.formatKES(pendingValue)}>
              {pendingVouchers.length > 0 ? `${pendingVouchers.length} (${pendingValue >= 1000000 ? api.formatCompactKES(pendingValue) : api.formatKES(pendingValue)})` : '0'}
            </span>
          </div>
          <Clock className={`w-4 h-4 shrink-0 ml-1 ${pendingVouchers.length > 0 ? 'text-amber-400 animate-pulse' : 'text-slate-600'}`} />
        </div>
      </div>
    </div>
  );
}
