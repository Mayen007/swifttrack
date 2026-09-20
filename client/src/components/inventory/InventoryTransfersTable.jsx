// client/src/components/inventory/InventoryTransfersTable.jsx
import React from 'react';
import { ArrowRightLeft, ArrowRight, CheckCircle2, Truck, Check } from 'lucide-react';
import { api } from '../../services/api.js';
import { sound } from '../../services/sound.js';

export function InventoryTransfersTable({
  loading,
  transfers = [],
  onRefresh,
}) {
  if (loading) {
    return (
      <div className="bg-[#12161f] border border-[#222834] rounded p-8 flex flex-col items-center justify-center space-y-3 font-mono">
        <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        <span className="text-xs text-slate-400">Loading transfers...</span>
      </div>
    );
  }

  if (transfers.length === 0) {
    return (
      <div className="bg-[#12161f] border border-[#222834] rounded p-12 text-center font-mono">
        <ArrowRightLeft className="w-10 h-10 text-slate-600 mx-auto mb-3" />
        <h3 className="text-sm font-bold text-slate-200 uppercase">No Transfers Found</h3>
        <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1">
          No inter-branch transfers exist for this branch or filter.
        </p>
      </div>
    );
  }

  const handleAction = async (transferId, action) => {
    try {
      sound.playScan();
      await api.post(`/api/v1/inventory/transfers/${transferId}/status`, { action });
      sound.playSuccess();
      api.toast(`Transfer status updated (${action})`, 'success');
      onRefresh();
    } catch (err) {
      api.toast(err.message || 'Action failed', 'error');
    }
  };

  const getStatusStyle = (st) => {
    switch (st) {
      case 'RECEIVED':
      case 'COMPLETED':
        return 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300';
      case 'IN_TRANSIT':
        return 'bg-blue-500/15 border-blue-500/30 text-blue-300 animate-pulse';
      case 'APPROVED':
        return 'bg-amber-500/15 border-amber-500/30 text-amber-300';
      case 'PENDING_APPROVAL':
        return 'bg-purple-500/15 border-purple-500/30 text-purple-300';
      default:
        return 'bg-slate-800 border-slate-700 text-slate-300';
    }
  };

  return (
    <div className="bg-[#12161f] border border-[#222834] rounded overflow-hidden font-mono">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[850px] text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-[#222834] bg-[#0e121a] text-slate-400 text-[10px] uppercase tracking-wider">
              <th className="py-2.5 px-3 whitespace-nowrap">Transfer #</th>
              <th className="py-2.5 px-3 min-w-[160px]">Source Route</th>
              <th className="py-2.5 px-3 min-w-[160px]">Target Route</th>
              <th className="py-2.5 px-3 min-w-[200px]">Items Manifest</th>
              <th className="py-2.5 px-3 text-center whitespace-nowrap">Status</th>
              <th className="py-2.5 px-3 text-right whitespace-nowrap">Workflow Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#1e2430]">
            {transfers.map((t) => (
              <tr key={t.id} className="hover:bg-[#181d28]/70 transition-colors">
                <td className="py-2.5 px-3 whitespace-nowrap">
                  <div className="font-bold text-blue-400">{t.transfer_number}</div>
                  <div className="text-[10px] text-slate-500">{t.created_at?.slice(0, 10)}</div>
                </td>
                <td className="py-2.5 px-3 max-w-[180px]">
                  <div className="font-semibold text-white truncate" title={t.source_branch_name}>{t.source_branch_name}</div>
                  <div className="text-[10px] text-slate-400 truncate" title={t.source_warehouse_name}>{t.source_warehouse_name}</div>
                </td>
                <td className="py-2.5 px-3 max-w-[180px]">
                  <div className="font-semibold text-white truncate" title={t.target_branch_name}>{t.target_branch_name}</div>
                  <div className="text-[10px] text-slate-400 truncate" title={t.target_warehouse_name}>{t.target_warehouse_name}</div>
                </td>
                <td className="py-2.5 px-3 max-w-[260px]">
                  <div className="text-slate-300 truncate" title={t.items?.map((it) => `${it.product_name} (${it.quantity_requested || it.quantity} ${it.unit || 'pcs'})`).join(', ')}>
                    {t.items?.map((it) => `${it.product_name} (${it.quantity_requested || it.quantity} ${it.unit || 'pcs'})`).join(', ') || 'Items'}
                  </div>
                  {t.notes && <div className="text-[10px] text-slate-500 truncate max-w-xs">{t.notes}</div>}
                </td>
                <td className="py-2.5 px-3 text-center whitespace-nowrap">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${getStatusStyle(t.status)}`}>
                    {t.status}
                  </span>
                </td>
                <td className="py-2.5 px-3 text-right whitespace-nowrap">
                  <div className="inline-flex items-center gap-1.5">
                    {t.status === 'PENDING_APPROVAL' && (
                      <button
                        onClick={() => handleAction(t.id, 'APPROVE')}
                        className="px-2 py-1 rounded bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-[10px] flex items-center gap-1 cursor-pointer"
                      >
                        <Check className="w-3 h-3 stroke-[3]" />
                        APPROVE
                      </button>
                    )}

                    {(t.status === 'APPROVED' || t.status === 'PENDING_APPROVAL') && (
                      <button
                        onClick={() => handleAction(t.id, 'DISPATCH')}
                        className="px-2 py-1 rounded bg-blue-600 hover:bg-blue-500 text-white font-bold text-[10px] flex items-center gap-1 cursor-pointer"
                      >
                        <Truck className="w-3 h-3" />
                        DISPATCH (TRANSIT)
                      </button>
                    )}

                    {t.status === 'IN_TRANSIT' && (
                      <button
                        onClick={() => handleAction(t.id, 'RECEIVE')}
                        className="px-2 py-1 rounded bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-[10px] flex items-center gap-1 cursor-pointer"
                      >
                        <CheckCircle2 className="w-3 h-3 stroke-[3]" />
                        RECEIVE STOCK
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
