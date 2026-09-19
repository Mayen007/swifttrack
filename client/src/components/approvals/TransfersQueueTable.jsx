// client/src/components/approvals/TransfersQueueTable.jsx
import React from 'react';
import { CheckCircle2, Eye, XCircle } from 'lucide-react';

export function TransfersQueueTable({
  transfers,
  onApproveTransfer,
  onOpenRejectModal,
  onOpenInspectModal,
}) {
  return (
    <div className="bg-[#12161f] border border-[#222834] rounded overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs font-mono border-collapse">
          <thead>
            <tr className="border-b border-[#222834] text-[10px] text-slate-400 uppercase tracking-wider bg-[#0c0e12]">
              <th className="p-3">Transfer Ref</th>
              <th className="p-3">Origin Hub</th>
              <th className="p-3">Destination Depot</th>
              <th className="p-3">Requested By</th>
              <th className="p-3">Cargo Specification</th>
              <th className="p-3">Transit Notes</th>
              <th className="p-3 text-right">Management Decision</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#222834]">
            {transfers.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-12 text-center text-slate-500 font-mono">
                  <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-emerald-400" />
                  <span className="font-bold text-slate-300 block">All Transfers Authorized</span>
                  <span className="text-[11px] text-slate-500 block mt-0.5">
                    No stock transfer movements currently pending managerial sign-off.
                  </span>
                </td>
              </tr>
            ) : (
              transfers.map((trf) => (
                <tr key={trf.id} className="hover:bg-[#181d28]/40 transition-colors">
                  {/* Transfer Ref */}
                  <td className="p-3 font-bold text-indigo-400">
                    {trf.transfer_number}
                  </td>

                  {/* Source */}
                  <td className="p-3 text-slate-300">
                    <div className="font-semibold">{trf.source_warehouse_name || trf.source_branch_name}</div>
                    <span className="text-[10px] text-slate-500">{trf.source_branch_name}</span>
                  </td>

                  {/* Target */}
                  <td className="p-3 text-emerald-400">
                    <div className="font-semibold">{trf.target_warehouse_name || trf.target_branch_name}</div>
                    <span className="text-[10px] text-slate-500">{trf.target_branch_name}</span>
                  </td>

                  {/* Requesting Staff */}
                  <td className="p-3 text-slate-300">
                    {trf.requested_by_name || 'Station Dispatcher'}
                  </td>

                  {/* Cargo Specification */}
                  <td className="p-3 text-slate-300">
                    {trf.items && trf.items.length > 0 ? (
                      <span>{trf.items.length} product SKU lines ({trf.items.reduce((s, i) => s + (i.quantity_requested || 0), 0)} units)</span>
                    ) : (
                      <span className="text-slate-500 italic">Inventory move</span>
                    )}
                  </td>

                  {/* Notes */}
                  <td className="p-3 text-slate-400 italic max-w-xs truncate" title={trf.notes}>
                    {trf.notes || 'Inter-hub replenishment'}
                  </td>

                  {/* Actions */}
                  <td className="p-3 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        onClick={() => onOpenInspectModal(trf, 'TRANSFER')}
                        className="p-1.5 rounded bg-[#0c0e12] hover:bg-[#181d28] text-slate-400 hover:text-white border border-[#222834] transition-colors cursor-pointer"
                        title="Inspect Transfer Manifest"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={() => onApproveTransfer(trf.id)}
                        className="px-2.5 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[10px] uppercase tracking-wider flex items-center gap-1 transition-colors cursor-pointer shadow-sm shadow-emerald-950"
                      >
                        <CheckCircle2 className="w-3 h-3" />
                        <span>Authorize</span>
                      </button>

                      <button
                        onClick={() => onOpenRejectModal(trf, 'TRANSFER')}
                        className="px-2.5 py-1.5 rounded bg-rose-600/20 hover:bg-rose-600 text-rose-300 hover:text-white border border-rose-500/40 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 transition-colors cursor-pointer"
                      >
                        <XCircle className="w-3 h-3" />
                        <span>Reject</span>
                      </button>
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
