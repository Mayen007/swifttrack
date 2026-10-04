import React from 'react';
import {
  ShoppingBag,
  Plus,
  Download,
  RotateCcw,
  Clock,
  CheckCircle2,
  Banknote,
} from 'lucide-react';
import { api } from '../../services/api.js';

export function OrderTelemetryCards({
  selectedBranch,
  lastSyncTime,
  onOpenCreate,
  onExportCsv,
  onRefresh,
  loading,
  ordersCount,
  activeOrdersCount,
  deliveredCount,
  totalVolume,
}) {
  return (
    <>
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded bg-[#181d28] border border-[#222834] flex items-center justify-center text-blue-400">
            <ShoppingBag className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-bold text-slate-100 uppercase tracking-wider font-mono">
                Customer Orders & Fulfillment
              </h1>
              <span className="px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/30 text-[10px] font-mono text-emerald-400">
                KRA ETR COMPLIANT
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5 font-mono">
              STATION: <span className="text-slate-200 font-semibold">{selectedBranch?.name || 'All Regional Stations'}</span>
              {lastSyncTime && <span className="ml-2 text-slate-500 font-mono">({lastSyncTime} EAT)</span>}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={onOpenCreate}
            className="h-8 px-3.5 rounded bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-mono font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>+ CREATE ORDER</span>
          </button>

          <button
            onClick={onExportCsv}
            className="h-8 px-3 rounded bg-[#161c28] hover:bg-[#202738] border border-[#222834] text-slate-300 hover:text-white text-xs font-mono flex items-center gap-1.5 transition-colors cursor-pointer"
            title="Export filtered orders to CSV"
          >
            <Download className="w-3.5 h-3.5 text-slate-400" />
            <span className="hidden sm:inline">EXPORT CSV</span>
          </button>

          <button
            onClick={onRefresh}
            disabled={loading}
            className="h-8 px-3 rounded bg-[#0c0e12] hover:bg-[#181d28] border border-[#222834] text-slate-300 hover:text-white text-xs font-mono flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
            title="Refresh orders ledger"
          >
            <RotateCcw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-blue-400' : 'text-slate-400'}`} />
            <span className="hidden sm:inline">SYNC</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-[#222834] border border-[#222834] rounded overflow-hidden">
        <div className="bg-[#0c0e12] p-2.5 flex items-center justify-between">
          <div>
            <span className="text-[10px] text-slate-400 font-mono uppercase block">Total Orders</span>
            <span className="text-base font-mono font-bold text-white tabular-nums">{ordersCount}</span>
          </div>
          <ShoppingBag className="w-4 h-4 text-slate-500" />
        </div>

        <div className="bg-[#0c0e12] p-2.5 flex items-center justify-between">
          <div>
            <span className="text-[10px] text-amber-400 font-mono uppercase block">Active / In Progress</span>
            <span className="text-base font-mono font-bold text-amber-400 tabular-nums">{activeOrdersCount}</span>
          </div>
          <Clock className="w-4 h-4 text-amber-500" />
        </div>

        <div className="bg-[#0c0e12] p-2.5 flex items-center justify-between">
          <div>
            <span className="text-[10px] text-emerald-400 font-mono uppercase block">Fulfilled & Delivered</span>
            <span className="text-base font-mono font-bold text-emerald-400 tabular-nums">{deliveredCount}</span>
          </div>
          <CheckCircle2 className="w-4 h-4 text-emerald-500" />
        </div>

        <div className="bg-[#0c0e12] p-2.5 flex items-center justify-between">
          <div>
            <span className="text-[10px] text-blue-400 font-mono uppercase block">Gross Volume</span>
            <span className="text-base font-mono font-bold text-blue-400 tabular-nums truncate block">
              {api.formatKES(totalVolume)}
            </span>
          </div>
          <Banknote className="w-4 h-4 text-blue-500" />
        </div>
      </div>
    </>
  );
}
