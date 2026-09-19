// client/src/components/approvals/RefundsQueueTable.jsx
import React from 'react';
import { CheckCircle2, User, Eye, XCircle } from 'lucide-react';
import { api } from '../../services/api.js';

export function RefundsQueueTable({
  refunds,
  onApproveRefund,
  onOpenRejectModal,
  onOpenInspectModal,
}) {
  return (
    <div className="bg-[#12161f] border border-[#222834] rounded overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs font-mono border-collapse">
          <thead>
            <tr className="border-b border-[#222834] text-[10px] text-slate-400 uppercase tracking-wider bg-[#0c0e12]">
              <th className="p-3">Request Ref</th>
              <th className="p-3">Original Order / Sale</th>
              <th className="p-3">Requesting Cashier</th>
              <th className="p-3">Customer</th>
              <th className="p-3">Return Reason</th>
              <th className="p-3 text-right">Original Sale</th>
              <th className="p-3 text-right">Refund Capital</th>
              <th className="p-3 text-right">Management Decision</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#222834]">
            {refunds.length === 0 ? (
              <tr>
                <td colSpan={8} className="p-12 text-center text-slate-500 font-mono">
                  <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-emerald-400" />
                  <span className="font-bold text-slate-300 block">Queue Cleared</span>
                  <span className="text-[11px] text-slate-500 block mt-0.5">
                    No customer refund requests currently awaiting managerial authorization.
                  </span>
                </td>
              </tr>
            ) : (
              refunds.map((req) => (
                <tr key={req.id} className="hover:bg-[#181d28]/40 transition-colors">
                  {/* Request Ref */}
                  <td className="p-3">
                    <span className="font-bold text-rose-400">
                      {req.refund_request_number || `#REF-${req.id}`}
                    </span>
                  </td>

                  {/* Order / Sale Number */}
                  <td className="p-3">
                    <span className="text-slate-200 font-semibold">{req.sale_number || req.order_number || 'SALE'}</span>
                    <span className="text-slate-500 text-[10px] block">
                      {req.branch_name || 'Main Branch'}
                    </span>
                  </td>

                  {/* Cashier */}
                  <td className="p-3 text-slate-300">
                    <div className="flex items-center gap-1.5">
                      <User className="w-3 h-3 text-indigo-400 shrink-0" />
                      <span>{req.requested_by_name || 'Cashier'}</span>
                    </div>
                  </td>

                  {/* Customer */}
                  <td className="p-3 text-slate-300 font-medium">
                    {req.customer_name || 'Retail Walk-in'}
                  </td>

                  {/* Reason */}
                  <td className="p-3 text-slate-400 italic max-w-xs truncate" title={req.reason}>
                    {req.reason}
                  </td>

                  {/* Original Sale */}
                  <td className="p-3 text-right text-slate-400 tabular-nums">
                    {api.formatKES(req.sale_total || req.original_total || req.total_amount)}
                  </td>

                  {/* Refund Value */}
                  <td className="p-3 text-right font-bold text-rose-400 tabular-nums text-sm">
                    {api.formatKES(req.amount || req.refund_amount)}
                  </td>

                  {/* Action Decision Buttons */}
                  <td className="p-3 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        onClick={() => onOpenInspectModal(req, 'REFUND')}
                        className="p-1.5 rounded bg-[#0c0e12] hover:bg-[#181d28] text-slate-400 hover:text-white border border-[#222834] transition-colors cursor-pointer"
                        title="Inspect Details"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={() => onApproveRefund(req.id)}
                        className="px-2.5 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[10px] uppercase tracking-wider flex items-center gap-1 transition-colors cursor-pointer shadow-sm shadow-emerald-950"
                      >
                        <CheckCircle2 className="w-3 h-3" />
                        <span>Approve</span>
                      </button>

                      <button
                        onClick={() => onOpenRejectModal(req, 'REFUND')}
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
