// client/src/components/branches/BranchHeader.jsx
import React from 'react';
import { Globe, Building2, RotateCcw, Plus } from 'lucide-react';

export function BranchHeader({
  loading,
  isSuperAdmin,
  onRefresh,
  onOpenCreateModal,
}) {
  return (
    <div className="bg-[#12161f] border border-[#222834] rounded p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
      <div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-blue-500/10 border border-blue-500/30 text-blue-400 font-mono text-[10px] font-bold tracking-wider uppercase">
            <Globe className="w-3 h-3" />
            KENYA TOPOLOGY MESH
          </span>
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-mono text-[10px]">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
            MULTITENANT NODE CLUSTER
          </span>
        </div>
        <h1 className="text-lg font-bold text-white tracking-tight flex items-center gap-2 mt-1">
          <Building2 className="w-5 h-5 text-blue-400" />
          Regional Hub Network & Depot Topology
        </h1>
        <p className="text-xs text-slate-400 mt-0.5">
          Decentralized distribution centers across Kenya with autonomous inventory, POS, and strict branch-level isolation
        </p>
      </div>

      {/* Action switchboard */}
      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={onRefresh}
          disabled={loading}
          title="Reload branch network data and warehouse mappings"
          className="px-3 py-1.5 rounded border border-[#222834] bg-[#181d28] hover:bg-[#202736] hover:text-white text-xs font-mono text-slate-300 flex items-center gap-1.5 transition-colors cursor-pointer"
        >
          <RotateCcw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-blue-400' : 'text-slate-400'}`} />
          <span>SYNC TOPOLOGY</span>
        </button>

        {isSuperAdmin && (
          <button
            onClick={onOpenCreateModal}
            className="px-3 py-1.5 rounded bg-blue-600 hover:bg-blue-500 text-white text-xs font-mono font-bold flex items-center gap-1.5 shadow-sm shadow-blue-900/40 transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>PROVISION REGIONAL HUB</span>
          </button>
        )}
      </div>
    </div>
  );
}
