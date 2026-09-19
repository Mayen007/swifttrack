// client/src/components/approvals/ApprovalsHeader.jsx
import React from 'react';
import {
  ShieldCheck,
  RotateCcw,
  ArrowRightLeft,
  FileCheck,
} from 'lucide-react';
import { sound } from '../../services/sound.js';

export function ApprovalsHeader({
  selectedBranch,
  lastSyncTime,
  activeTab,
  setActiveTab,
  refundsCount,
  transfersCount,
  loading,
  onRefresh,
}) {
  return (
    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded bg-[#181d28] border border-[#222834] flex items-center justify-center text-amber-400">
          <ShieldCheck className="w-5 h-5" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-sm font-bold text-slate-100 uppercase tracking-wider font-mono">
              Manager Approvals & Authorization Console
            </h1>
            <span className="px-2 py-0.5 rounded bg-[#181d28] border border-[#222834] text-[10px] font-mono text-slate-400">
              GOVERNANCE // INTERNAL CONTROLS
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5 font-mono">
            STATION: <span className="text-slate-200 font-semibold">{selectedBranch?.name || 'All Regional Branches'}</span>
            <span className="mx-2 text-[#222834]">|</span>
            POLICY: <span className="text-amber-400 font-bold">DUAL-CONTROL ENFORCED</span>
            {lastSyncTime && <span className="ml-1 text-slate-500 font-mono">({lastSyncTime} EAT)</span>}
          </p>
        </div>
      </div>

      {/* Action & View Switcher */}
      <div className="flex items-center flex-wrap gap-2">
        <div className="flex bg-[#0c0e12] p-0.5 rounded border border-[#222834] text-xs font-mono">
          <button
            onClick={() => {
              setActiveTab('REFUNDS');
              sound.playScan();
            }}
            className={`px-3 py-1.5 rounded text-[11px] font-bold transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'REFUNDS'
                ? 'bg-[#181d28] text-white border border-[#222834]'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <RotateCcw className="w-3.5 h-3.5 text-rose-400" />
            <span>CUSTOMER REFUNDS ({refundsCount})</span>
          </button>

          <button
            onClick={() => {
              setActiveTab('TRANSFERS');
              sound.playScan();
            }}
            className={`px-3 py-1.5 rounded text-[11px] font-bold transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'TRANSFERS'
                ? 'bg-[#181d28] text-white border border-[#222834]'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <ArrowRightLeft className="w-3.5 h-3.5 text-indigo-400" />
            <span>STOCK TRANSFERS ({transfersCount})</span>
          </button>

          <button
            onClick={() => {
              setActiveTab('HISTORY');
              sound.playScan();
            }}
            className={`px-3 py-1.5 rounded text-[11px] font-bold transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'HISTORY'
                ? 'bg-[#181d28] text-white border border-[#222834]'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>DECISION AUDIT</span>
          </button>
        </div>

        <button
          onClick={onRefresh}
          disabled={loading}
          className="h-8 px-3 rounded bg-[#0c0e12] hover:bg-[#181d28] border border-[#222834] text-slate-300 hover:text-white text-xs font-mono font-medium flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
          title="Refresh approvals queue"
        >
          <RotateCcw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-amber-400' : 'text-slate-400'}`} />
          <span>SYNC</span>
        </button>
      </div>
    </div>
  );
}
