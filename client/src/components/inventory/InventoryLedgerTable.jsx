// client/src/components/inventory/InventoryLedgerTable.jsx
import React from 'react';
import { FileText, ArrowRight, User } from 'lucide-react';

export function InventoryLedgerTable({ loading, movements = [] }) {
  if (loading) {
    return (
      <div className="bg-[#12161f] border border-[#222834] rounded p-8 flex flex-col items-center justify-center space-y-3 font-mono">
        <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        <span className="text-xs text-slate-400">Loading immutable movement ledger...</span>
      </div>
    );
  }

  if (movements.length === 0) {
    return (
      <div className="bg-[#12161f] border border-[#222834] rounded p-12 text-center font-mono">
        <FileText className="w-10 h-10 text-slate-600 mx-auto mb-3" />
        <h3 className="text-sm font-bold text-slate-200 uppercase">No Movement Ledger Records</h3>
        <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1">
          No stock movements have been recorded yet.
        </p>
      </div>
    );
  }

  const getStateBadgeStyle = (state) => {
    switch (state) {
      case 'AVAILABLE':
        return 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300';
      case 'RESERVED':
        return 'bg-amber-500/15 border-amber-500/30 text-amber-300';
      case 'IN_TRANSIT':
        return 'bg-blue-500/15 border-blue-500/30 text-blue-300';
      case 'DAMAGED':
        return 'bg-rose-500/20 border-rose-500/40 text-rose-300';
      case 'EXPIRED':
        return 'bg-red-500/20 border-red-500/40 text-red-300';
      default:
        return 'bg-slate-800 border-slate-700 text-slate-300';
    }
  };

  return (
    <div className="bg-[#12161f] border border-[#222834] rounded overflow-hidden font-mono">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-[#222834] bg-[#0e121a] text-slate-400 text-[10px] uppercase tracking-wider">
              <th className="py-2.5 px-3">Timestamp</th>
              <th className="py-2.5 px-3">Product / SKU</th>
              <th className="py-2.5 px-3">State Transition</th>
              <th className="py-2.5 px-3">Movement Type</th>
              <th className="py-2.5 px-3 text-right">Delta</th>
              <th className="py-2.5 px-3 text-right">Balance</th>
              <th className="py-2.5 px-3">Reference / Reason</th>
              <th className="py-2.5 px-3">Actor</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#1e2430]">
            {movements.map((m) => {
              const delta = Number(m.quantity_change) || 0;
              const isPositive = delta > 0;
              return (
                <tr key={m.id} className="hover:bg-[#181d28]/70 transition-colors">
                  <td className="py-2.5 px-3 text-[11px] text-slate-400 whitespace-nowrap">
                    {m.created_at ? m.created_at.replace('T', ' ').slice(0, 19) : 'Recent'}
                  </td>
                  <td className="py-2.5 px-3">
                    <div className="font-bold text-white truncate max-w-[180px]">{m.product_name}</div>
                    <div className="text-[10px] text-slate-400">{m.sku}</div>
                  </td>
                  <td className="py-2.5 px-3">
                    <div className="inline-flex items-center gap-1 text-[10px]">
                      <span className={`px-1.5 py-0.5 rounded border ${getStateBadgeStyle(m.from_state)}`}>
                        {m.from_state || 'AVAILABLE'}
                      </span>
                      <ArrowRight className="w-3 h-3 text-slate-500" />
                      <span className={`px-1.5 py-0.5 rounded border ${getStateBadgeStyle(m.to_state)}`}>
                        {m.to_state || 'AVAILABLE'}
                      </span>
                    </div>
                  </td>
                  <td className="py-2.5 px-3">
                    <span className="px-1.5 py-0.5 rounded text-[10px] bg-[#181d28] border border-[#2b3548] text-slate-300">
                      {m.movement_type}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-right font-bold">
                    <span className={isPositive ? 'text-emerald-400' : 'text-rose-400'}>
                      {isPositive ? `+${delta}` : delta}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-right text-slate-300">
                    {m.previous_quantity} &rarr; <span className="text-white font-bold">{m.new_quantity}</span>
                  </td>
                  <td className="py-2.5 px-3 text-[11px]">
                    <div className="text-amber-400 font-bold">{m.reference_id || m.reference_type}</div>
                    <div className="text-slate-400 text-[10px] truncate max-w-[160px]">{m.reason}</div>
                  </td>
                  <td className="py-2.5 px-3 text-[10px] text-slate-400">
                    <div className="flex items-center gap-1">
                      <User className="w-3 h-3 text-slate-500" />
                      <span>{m.user_full_name || m.username || 'System'}</span>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
