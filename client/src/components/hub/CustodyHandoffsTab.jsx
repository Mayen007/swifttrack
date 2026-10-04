import React from 'react';
import { Plus } from 'lucide-react';

export function CustodyHandoffsTab({
  handoffs,
  handoffTypeFilter,
  setHandoffTypeFilter,
  onRecordHandoff
}) {
  const allHandoffs = handoffs || [];

  const filteredHandoffs = allHandoffs.filter(
    (h) => handoffTypeFilter === 'ALL' || h.transfer_type === handoffTypeFilter
  );

  return (
    <div className="bg-[#121622] border border-[#222834] p-3.5 sm:p-4 rounded-xl space-y-4 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#222834]">
        <div>
          <h3 className="font-bold text-white text-sm font-mono uppercase tracking-wider">Chain of Custody Transfers</h3>
          <p className="text-xs text-slate-400">Legally binding custody transfers between drivers, hubs, and couriers</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 bg-[#0b0e14] p-0.5 rounded-lg border border-[#1e2433] text-xs font-mono">
            {['ALL', 'HUB_TO_DRIVER', 'DRIVER_TO_HUB'].map((tp) => (
              <button
                key={tp}
                onClick={() => setHandoffTypeFilter(tp)}
                className={`px-2.5 py-1 rounded text-[11px] font-semibold transition-all cursor-pointer ${
                  handoffTypeFilter === tp
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {tp === 'ALL' ? 'All Types' : tp.replace(/_/g, ' ')}
              </button>
            ))}
          </div>

          <button
            onClick={onRecordHandoff}
            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg text-xs font-mono flex items-center gap-1.5 shadow-sm cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>RECORD HANDOFF</span>
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-[#181d28] text-slate-400 font-semibold border-b border-[#222834]">
            <tr>
              <th className="py-2 px-3">Handoff ID</th>
              <th className="py-2 px-3">Transfer Type</th>
              <th className="py-2 px-3">Releasing Actor</th>
              <th className="py-2 px-3">Receiving Actor</th>
              <th className="py-2 px-3">Security Seal</th>
              <th className="py-2 px-3 text-right">Timestamp</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#222834] text-slate-300">
            {filteredHandoffs.map((h) => (
              <tr key={h.id || h.handoff_number} className="hover:bg-white/[0.02]">
                <td className="py-2 px-3 font-mono font-bold text-white">{h.handoff_number || `HND-${h.id}`}</td>
                <td className="py-2 px-3">
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500/10 text-blue-400">
                    {h.transfer_type}
                  </span>
                </td>
                <td className="py-2 px-3">{h.releasing_actor}</td>
                <td className="py-2 px-3">{h.receiving_actor}</td>
                <td className="py-2 px-3 font-mono text-emerald-400">{h.security_seal}</td>
                <td className="py-2 px-3 text-right text-slate-500 font-mono">{h.timestamp}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
