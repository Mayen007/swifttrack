import React from 'react';
import {
  Globe,
  RefreshCw,
  CheckCircle2,
  ShieldCheck,
  Clock,
  AlertTriangle,
  FileText,
  Truck
} from 'lucide-react';
import { sound } from '../../services/sound.js';

export function CrossBorderCustomsTab({
  crossBorderLegs,
  customsStatusFilter,
  setCustomsStatusFilter,
  crossBorderPostFilter,
  setCrossBorderPostFilter,
  loading,
  onSync,
  onOpenCustomsModal
}) {
  const statusPills = [
    { id: 'ALL', label: 'All', count: crossBorderLegs.length },
    {
      id: 'INSPECTION',
      label: 'Inspection',
      count: crossBorderLegs.filter((l) => l.customs_status === 'INSPECTION').length,
      color: 'amber'
    },
    {
      id: 'ON_HOLD',
      label: 'Hold',
      count: crossBorderLegs.filter((l) => l.customs_status === 'ON_HOLD').length,
      color: 'rose'
    },
    {
      id: 'CLEARED',
      label: 'Cleared / Released',
      count: crossBorderLegs.filter((l) => ['CLEARED', 'RELEASED'].includes(l.customs_status)).length,
      color: 'emerald'
    },
    {
      id: 'PENDING',
      label: 'Pending',
      count: crossBorderLegs.filter((l) => !l.customs_status || l.customs_status === 'PENDING').length,
      color: 'slate'
    },
  ];

  const filteredLegs = crossBorderLegs.filter((leg) => {
    if (crossBorderPostFilter !== 'ALL' && leg.border_post_name !== crossBorderPostFilter) return false;
    if (customsStatusFilter !== 'ALL') {
      if (customsStatusFilter === 'CLEARED') {
        if (!['CLEARED', 'RELEASED'].includes(leg.customs_status)) return false;
      } else if (customsStatusFilter === 'PENDING') {
        if (leg.customs_status && leg.customs_status !== 'PENDING') return false;
      } else {
        if (leg.customs_status !== customsStatusFilter) return false;
      }
    }
    return true;
  });

  return (
    <div className="bg-[#12161f] border border-[#222834] p-3.5 sm:p-4 rounded-xl space-y-3.5 shadow-sm">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-[#222834]">
        <div className="flex items-center gap-1 bg-[#0b0e14] p-1 rounded-lg border border-[#1e2433] overflow-x-auto no-scrollbar text-xs font-mono">
          {statusPills.map((pill) => {
            const isActive = customsStatusFilter === pill.id;
            return (
              <button
                key={pill.id}
                onClick={() => {
                  setCustomsStatusFilter(pill.id);
                  sound.playClick();
                }}
                className={`px-2.5 py-1 rounded-md text-xs font-mono font-medium flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
                  isActive
                    ? 'bg-blue-600 text-white font-bold shadow-xs'
                    : 'text-slate-400 hover:text-white hover:bg-white/[0.05]'
                }`}
              >
                <span>{pill.label}</span>
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold leading-none ${
                    isActive
                      ? 'bg-white/20 text-white'
                      : pill.color === 'rose' && pill.count > 0
                      ? 'bg-rose-500/20 text-rose-400'
                      : pill.color === 'amber' && pill.count > 0
                      ? 'bg-amber-500/20 text-amber-300'
                      : pill.color === 'emerald' && pill.count > 0
                      ? 'bg-emerald-500/20 text-emerald-400'
                      : 'bg-white/10 text-slate-400'
                  }`}
                >
                  {pill.count}
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 bg-[#0b0e14] border border-[#1e2433] px-2.5 py-1.5 rounded-lg text-xs text-slate-300">
            <Globe className="w-3.5 h-3.5 text-blue-400 shrink-0" />
            <select
              value={crossBorderPostFilter}
              onChange={(e) => setCrossBorderPostFilter(e.target.value)}
              className="bg-transparent text-white focus:outline-none text-xs font-mono cursor-pointer"
            >
              <option value="ALL">All Border Posts</option>
              <option value="Malaba Border Post (KE-UG)">Malaba (KE-UG)</option>
              <option value="Busia One Stop Border Post (KE-UG)">Busia (KE-UG)</option>
              <option value="Namanga One Stop Border Post (KE-TZ)">Namanga (KE-TZ)</option>
              <option value="Isebania Border Post (KE-TZ)">Isebania (KE-TZ)</option>
              <option value="Moyale Border Post (KE-ET)">Moyale (KE-ET)</option>
            </select>
          </div>

          <button
            onClick={onSync}
            disabled={loading}
            className="px-2.5 py-1.5 rounded-lg bg-[#0b0e14] hover:bg-[#181d28] border border-[#1e2433] text-xs font-mono font-medium text-slate-300 hover:text-white flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
            title="Sync customs feed"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-blue-400' : 'text-slate-400'}`} />
            <span className="hidden sm:inline">SYNC</span>
          </button>
        </div>
      </div>

      <div className="bg-[#12161f] border border-[#222834] rounded-xl overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-[#181d28] text-slate-400 font-semibold border-b border-[#222834]">
            <tr>
              <th className="py-2.5 px-3">Tracking / Waybill</th>
              <th className="py-2.5 px-3">Border Checkpoint</th>
              <th className="py-2.5 px-3">Corridor</th>
              <th className="py-2.5 px-3">Declaration / Ref</th>
              <th className="py-2.5 px-3">Customs Status</th>
              <th className="py-2.5 px-3 text-right">Border Inspection Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#222834] text-slate-300">
            {filteredLegs.length === 0 ? (
              <tr>
                <td colSpan="6" className="py-12 text-center text-slate-500">
                  <Globe className="w-8 h-8 mx-auto mb-2 text-slate-600 opacity-60" />
                  No cross-border consignments matching criteria.
                </td>
              </tr>
            ) : (
              filteredLegs.map((leg) => (
                <tr key={leg.id} className="hover:bg-white/[0.02]">
                  <td className="py-2.5 px-3">
                    <div className="font-mono font-bold text-white">{leg.tracking_number}</div>
                    <div className="text-[10px] text-slate-500 font-mono">{leg.waybill_number || `Leg #${leg.id}`}</div>
                  </td>
                  <td className="py-2.5 px-3">
                    <span className="font-semibold text-slate-200">{leg.border_post_name || 'Border Post'}</span>
                    <div className="text-[10px] text-slate-500 font-mono">One-Stop Border Post</div>
                  </td>
                  <td className="py-2.5 px-3">
                    <div className="flex items-center gap-1 font-medium text-slate-200">
                      <span>Hub #{leg.origin_hub_id}</span>
                      <span className="text-slate-500">&rarr;</span>
                      <span>Hub #{leg.destination_hub_id}</span>
                    </div>
                    <div className="text-[10px] text-slate-400 font-mono">
                      {leg.run_number ? `Run ${leg.run_number}` : 'Linehaul Transit'}
                    </div>
                  </td>
                  <td className="py-2.5 px-3 font-mono">
                    {leg.customs_declaration_number || <span className="text-slate-600">Pending</span>}
                    {leg.customs_hold_reason && (
                      <div className="text-[10px] text-rose-400 font-sans">
                        Hold: {leg.customs_hold_reason}
                      </div>
                    )}
                  </td>
                  <td className="py-2.5 px-3">
                    {leg.customs_status === 'RELEASED' && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                        <CheckCircle2 className="w-3 h-3" />
                        Released
                      </span>
                    )}
                    {leg.customs_status === 'CLEARED' && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-teal-500/15 text-teal-300 border border-teal-500/30">
                        <ShieldCheck className="w-3 h-3" />
                        Cleared
                      </span>
                    )}
                    {leg.customs_status === 'INSPECTION' && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30 animate-pulse">
                        <Clock className="w-3 h-3" />
                        Inspection
                      </span>
                    )}
                    {leg.customs_status === 'ON_HOLD' && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40">
                        <AlertTriangle className="w-3 h-3" />
                        Hold: {leg.customs_hold_reason || 'Detained'}
                      </span>
                    )}
                    {leg.customs_status === 'DECLARED' && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500/15 text-blue-300 border border-blue-500/30">
                        <FileText className="w-3 h-3" />
                        Declared
                      </span>
                    )}
                    {(!leg.customs_status || leg.customs_status === 'PENDING') && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-slate-500/15 text-slate-300 border border-slate-500/30">
                        <Clock className="w-3 h-3" />
                        Pending Declaration
                      </span>
                    )}
                  </td>
                  <td className="py-2.5 px-3 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      {(!leg.customs_status || leg.customs_status === 'PENDING') && (
                        <button
                          onClick={() => onOpenCustomsModal(leg, 'SUBMIT')}
                          className="px-2.5 py-1 rounded-lg bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/30 text-[11px] font-bold cursor-pointer"
                        >
                          Submit Declaration
                        </button>
                      )}
                      {leg.customs_status === 'DECLARED' && (
                        <button
                          onClick={() => onOpenCustomsModal(leg, 'INSPECT')}
                          className="px-2.5 py-1 rounded-lg bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 border border-amber-500/30 text-[11px] font-bold cursor-pointer"
                        >
                          Inspect
                        </button>
                      )}
                      {['DECLARED', 'INSPECTION'].includes(leg.customs_status) && (
                        <>
                          <button
                            onClick={() => onOpenCustomsModal(leg, 'CLEAR')}
                            className="px-2.5 py-1 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 text-[11px] font-bold cursor-pointer"
                          >
                            Clear
                          </button>
                          <button
                            onClick={() => onOpenCustomsModal(leg, 'HOLD')}
                            className="px-2.5 py-1 rounded-lg bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/30 text-[11px] font-bold cursor-pointer"
                          >
                            Hold
                          </button>
                        </>
                      )}
                      {leg.customs_status === 'ON_HOLD' && (
                        <button
                          onClick={() => onOpenCustomsModal(leg, 'CLEAR')}
                          className="px-2.5 py-1 rounded-lg bg-teal-600/20 hover:bg-teal-600/30 text-teal-300 border border-teal-500/30 text-[11px] font-bold cursor-pointer"
                        >
                          Resolve & Clear
                        </button>
                      )}
                      {leg.customs_status === 'CLEARED' && (
                        <button
                          onClick={() => onOpenCustomsModal(leg, 'RELEASE')}
                          className="px-2.5 py-1 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-[11px] font-bold flex items-center gap-1 shadow cursor-pointer"
                        >
                          <Truck className="w-3 h-3" />
                          Release Gate Pass
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
