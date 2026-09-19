// client/src/components/branches/BranchCard.jsx
import React from 'react';
import {
  MapPin,
  Phone,
  Mail,
  Warehouse,
  ExternalLink,
  CheckCircle2,
  ArrowRight,
  Layers,
  Edit3,
  Check,
} from 'lucide-react';

export function BranchCard({
  branch,
  isSelected,
  warehouses = [],
  canEdit,
  onSelectBranch,
  onOpenInspector,
  onOpenEdit,
}) {
  const isOnline = branch.is_active !== 0;

  return (
    <div
      className={`rounded border transition-all duration-150 flex flex-col justify-between ${
        isSelected
          ? 'bg-[#12161f] border-blue-500/80 shadow-md shadow-blue-950/40 ring-1 ring-blue-500/50'
          : 'bg-[#12161f] border-[#222834] hover:border-slate-700'
      }`}
    >
      {/* Hub Node Header */}
      <div className="p-4 border-b border-[#222834] space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="font-mono text-xs font-black px-2 py-0.5 rounded bg-blue-950/80 text-blue-400 border border-blue-800/60 tracking-wider">
              {branch.code}
            </span>
            <div>
              <h2 className="text-sm font-bold text-white tracking-tight leading-tight flex items-center gap-1.5">
                {branch.name}
              </h2>
              <span className="font-mono text-[11px] text-slate-400 uppercase tracking-wider">
                {branch.city}, KENYA
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {isOnline ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                ONLINE
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                OFFLINE
              </span>
            )}

            {isSelected && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-blue-500/20 text-blue-300 border border-blue-500/40">
                <Check className="w-3 h-3 text-blue-400" />
                ACTIVE SCOPE
              </span>
            )}
          </div>
        </div>

        {/* Physical & Dispatch Connectivity */}
        <div className="bg-[#181d28] border border-[#222834] rounded p-2.5 space-y-1.5 font-mono text-[11px] text-slate-300">
          <div className="flex items-center gap-2">
            <MapPin className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span className="truncate text-slate-300">
              {branch.address || `${branch.city}, Kenya`}
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 border-t border-[#222834]/80">
            <div className="flex items-center gap-1.5">
              <Phone className="w-3.5 h-3.5 text-blue-400 shrink-0" />
              <span className="truncate text-slate-400">{branch.phone || '+254 20 123 4567'}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Mail className="w-3.5 h-3.5 text-purple-400 shrink-0" />
              <span className="truncate text-slate-400">
                {branch.email || `hub.${branch.code.toLowerCase()}@swifttrack.co.ke`}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Attached Warehouses & Depots Micro-Strip */}
      <div className="px-4 py-3 border-b border-[#222834] bg-[#0f121a]">
        <div className="flex items-center justify-between text-[11px] font-mono mb-2">
          <span className="text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <Warehouse className="w-3 h-3 text-blue-400" />
            ATTACHED STORAGE DEPOTS ({warehouses.length})
          </span>
          <button
            onClick={() => onOpenInspector(branch)}
            className="text-blue-400 hover:text-blue-300 hover:underline flex items-center gap-1 text-[10px] cursor-pointer"
          >
            <span>VIEW FACILITY SPECS</span>
            <ExternalLink className="w-2.5 h-2.5" />
          </button>
        </div>

        {warehouses.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {warehouses.map((wh) => (
              <div
                key={wh.id}
                className="px-2 py-1 rounded bg-[#181d28] border border-[#222834] flex items-center gap-1.5 font-mono text-[10px]"
              >
                <span className="font-bold text-blue-400">{wh.code}</span>
                <span className="text-slate-400">({wh.name})</span>
                {wh.location_desc && (
                  <span className="text-slate-400 text-[9px] hidden sm:inline">
                    • {wh.location_desc}
                  </span>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-[10px] font-mono text-slate-400 italic">
            Default depot initialization in progress...
          </div>
        )}
      </div>

      {/* Node Telemetry Counters (3 columns) */}
      <div className="grid grid-cols-3 divide-x divide-[#222834] p-3 text-center bg-[#12161f]">
        <div>
          <span className="block font-mono text-[10px] text-slate-400 uppercase">
            PERSONNEL
          </span>
          <span className="font-mono text-sm font-bold text-white tabular-nums">
            {branch.staff_count || 0}
          </span>
          <span className="block font-mono text-[9px] text-slate-400">ASSIGNED</span>
        </div>
        <div>
          <span className="block font-mono text-[10px] text-slate-400 uppercase">
            DEPOTS
          </span>
          <span className="font-mono text-sm font-bold text-white tabular-nums">
            {warehouses.length || branch.warehouse_count || 0}
          </span>
          <span className="block font-mono text-[9px] text-slate-400">FACILITIES</span>
        </div>
        <div>
          <span className="block font-mono text-[10px] text-slate-400 uppercase">
            CARGO ORDERS
          </span>
          <span className="font-mono text-sm font-bold text-amber-400 tabular-nums">
            {branch.total_orders || 0}
          </span>
          <span className="block font-mono text-[9px] text-slate-400">ROUTED</span>
        </div>
      </div>

      {/* Card Actions Footer */}
      <div className="p-3 border-t border-[#222834] bg-[#141822] flex items-center gap-2">
        <button
          onClick={() => onSelectBranch(branch)}
          disabled={isSelected}
          className={`flex-1 py-1.5 px-2 rounded text-xs font-mono font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
            isSelected
              ? 'bg-blue-900/40 text-blue-400 border border-blue-500/40 cursor-default'
              : 'bg-[#181d28] hover:bg-[#222938] text-slate-200 hover:text-white border border-[#222834]'
          }`}
        >
          {isSelected ? (
            <>
              <CheckCircle2 className="w-3.5 h-3.5 text-blue-400" />
              <span>ACTIVE SCOPE</span>
            </>
          ) : (
            <>
              <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
              <span>SWITCH CONTEXT</span>
            </>
          )}
        </button>

        <button
          onClick={() => onOpenInspector(branch)}
          title="Inspect facility depots and add warehouses"
          className="p-1.5 rounded bg-[#181d28] hover:bg-[#222938] text-slate-300 hover:text-white border border-[#222834] transition-colors cursor-pointer"
        >
          <Layers className="w-4 h-4 text-blue-400" />
        </button>

        {canEdit && (
          <button
            onClick={() => onOpenEdit(branch)}
            title="Edit hub details and physical address"
            className="p-1.5 rounded bg-[#181d28] hover:bg-[#222938] text-slate-300 hover:text-white border border-[#222834] transition-colors cursor-pointer"
          >
            <Edit3 className="w-4 h-4 text-slate-400 hover:text-amber-400" />
          </button>
        )}
      </div>
    </div>
  );
}
