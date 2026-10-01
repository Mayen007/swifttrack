import React from 'react';
import {
  CreditCard,
  Plus,
  ShieldCheck,
  Download,
  RotateCcw,
  Banknote,
  CheckCircle2,
  Clock,
  Smartphone,
  Filter,
  Search
} from 'lucide-react';
import { api } from '../../services/api.js';
import { sound } from '../../services/sound.js';

export function PaymentsConsoleHeader({
  selectedBranch,
  lastSyncTime,
  loading,
  onRefresh,
  onOpenInitiate,
  onOpenReconciliation,
  onExportCsv,
  totalVolume,
  successRate,
  activeCount,
  mpesaVolume,
  statusFilter,
  setStatusFilter,
  methodFilter,
  setMethodFilter,
  searchQuery,
  setSearchQuery,
  searchInputRef
}) {
  return (
    <div className="bg-[#12161f] border border-[#222834] rounded p-4 space-y-3.5 shadow-md">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded bg-[#181d28] border border-[#222834] flex items-center justify-center text-amber-400 shadow-sm">
            <CreditCard className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-bold text-slate-100 uppercase tracking-wider font-mono">
                Payments Engine // Gateway
              </h1>
              <span className="px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/30 text-[10px] font-mono text-emerald-400 font-semibold">
                DARAJA 2.0 & IDEMPOTENT
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
            onClick={onOpenInitiate}
            className="h-8 px-3.5 rounded bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-mono font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>+ INITIATE PAYMENT</span>
          </button>

          <button
            onClick={onOpenReconciliation}
            className="h-8 px-3 rounded bg-[#161c28] hover:bg-[#202738] border border-[#222834] text-slate-300 hover:text-white text-xs font-mono flex items-center gap-1.5 transition-colors cursor-pointer"
            title="Run payment reconciliation"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span className="hidden sm:inline">RECONCILIATION</span>
          </button>

          <button
            onClick={onExportCsv}
            className="h-8 px-3 rounded bg-[#161c28] hover:bg-[#202738] border border-[#222834] text-slate-300 hover:text-white text-xs font-mono flex items-center gap-1.5 transition-colors cursor-pointer"
            title="Export payments ledger to CSV"
          >
            <Download className="w-3.5 h-3.5 text-slate-400" />
            <span className="hidden sm:inline">EXPORT CSV</span>
          </button>

          <button
            onClick={() => {
              onRefresh();
              sound.playScan();
            }}
            disabled={loading}
            className="h-8 px-3 rounded bg-[#0c0e12] hover:bg-[#181d28] border border-[#222834] text-slate-300 hover:text-white text-xs font-mono flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
            title="Refresh payments"
          >
            <RotateCcw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-amber-400' : 'text-slate-400'}`} />
            <span className="hidden sm:inline">SYNC</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-[#222834] border border-[#222834] rounded overflow-hidden">
        <div className="bg-[#0c0e12] p-2.5 flex items-center justify-between">
          <div>
            <span className="text-[10px] text-slate-400 font-mono uppercase block">Total Settled</span>
            <span className="text-base font-mono font-bold text-emerald-400 tabular-nums">
              {api.formatKES(totalVolume)}
            </span>
          </div>
          <Banknote className="w-4 h-4 text-emerald-500" />
        </div>

        <div className="bg-[#0c0e12] p-2.5 flex items-center justify-between">
          <div>
            <span className="text-[10px] text-blue-400 font-mono uppercase block">Success Rate</span>
            <span className="text-base font-mono font-bold text-blue-400 tabular-nums">{successRate}%</span>
          </div>
          <CheckCircle2 className="w-4 h-4 text-blue-500" />
        </div>

        <div className="bg-[#0c0e12] p-2.5 flex items-center justify-between">
          <div>
            <span className="text-[10px] text-amber-400 font-mono uppercase block">In Progress</span>
            <span className="text-base font-mono font-bold text-amber-400 tabular-nums">{activeCount}</span>
          </div>
          <Clock className="w-4 h-4 text-amber-500" />
        </div>

        <div className="bg-[#0c0e12] p-2.5 flex items-center justify-between">
          <div>
            <span className="text-[10px] text-emerald-400 font-mono uppercase block">M-Pesa Volume</span>
            <span className="text-base font-mono font-bold text-emerald-300 tabular-nums">
              {api.formatKES(mpesaVolume)}
            </span>
          </div>
          <Smartphone className="w-4 h-4 text-emerald-500" />
        </div>
      </div>

      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-1 border-t border-[#1b212c]">
        <span className="text-[10px] font-mono text-slate-500 uppercase mr-1 flex items-center gap-1">
          <Filter className="w-3 h-3" /> STATUS:
        </span>
        {['ALL', 'PENDING', 'PROCESSING', 'SUCCESS', 'FAILED', 'TIMEOUT', 'CANCELLED', 'REFUNDED'].map((st) => (
          <button
            key={st}
            onClick={() => setStatusFilter(st)}
            className={`px-2.5 py-1 rounded text-[11px] font-mono whitespace-nowrap transition-colors cursor-pointer border ${
              statusFilter === st
                ? 'bg-amber-400 text-slate-950 font-bold border-amber-400'
                : 'bg-[#0c0e12] text-slate-400 border-[#222834] hover:text-white'
            }`}
          >
            {st}
          </button>
        ))}

        <div className="h-4 w-px bg-[#222834] mx-1" />

        <span className="text-[10px] font-mono text-slate-500 uppercase mr-1">METHOD:</span>
        {['ALL', 'MPESA', 'CARD', 'CASH', 'BANK'].map((m) => (
          <button
            key={m}
            onClick={() => setMethodFilter(m)}
            className={`px-2 py-0.5 rounded text-[10px] font-mono whitespace-nowrap transition-colors cursor-pointer border ${
              methodFilter === m
                ? 'bg-blue-600 text-white font-bold border-blue-500'
                : 'bg-[#0c0e12] text-slate-400 border-[#222834] hover:text-white'
            }`}
          >
            {m === 'ALL' ? 'ALL METHODS' : m}
          </button>
        ))}
      </div>

      <div className="relative">
        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
        <input
          ref={searchInputRef}
          type="text"
          placeholder="Search payments by Intent #, Customer, Phone, Checkout Request ID, or M-Pesa Receipt... (Press F2)"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-9 pr-14 py-2 rounded bg-[#0c0e12] border border-[#222834] text-white placeholder-slate-500 text-xs font-sans focus:outline-none focus:border-amber-400"
        />
        <span className="absolute right-2.5 top-2 text-[10px] font-mono text-slate-400 border border-[#222834] px-1.5 py-0.5 rounded bg-[#141822]">
          F2
        </span>
      </div>
    </div>
  );
}
