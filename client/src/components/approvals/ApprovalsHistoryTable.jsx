// client/src/components/approvals/ApprovalsHistoryTable.jsx
import React from 'react';
import { api } from '../../services/api.js';

export function ApprovalsHistoryTable({ history, user }) {
  return (
    <div className="bg-[#12161f] border border-[#222834] rounded overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs font-mono border-collapse">
          <thead>
            <tr className="border-b border-[#222834] text-[10px] text-slate-400 uppercase tracking-wider bg-[#0c0e12]">
              <th className="p-3">Reference #</th>
              <th className="p-3">Authorization Category</th>
              <th className="p-3">Request Details</th>
              <th className="p-3">Requested By</th>
              <th className="p-3">Sign-off Approver</th>
              <th className="p-3 text-center">Status</th>
              <th className="p-3 text-right">Settled Amount / Items</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#222834]">
            {history.map((item, idx) => {
              const isRefund = item.record_type === 'REFUND';
              const isApproved = ['APPROVED', 'COMPLETED', 'RECEIVED', 'DISPATCHED'].includes(item.status);
              const isRejected = item.status === 'REJECTED';

              return (
                <tr key={idx} className="hover:bg-[#181d28]/40 transition-colors">
                  <td className="p-3 font-bold text-slate-200">
                    {item.refund_request_number || item.transfer_number || `#${item.id}`}
                  </td>
                  <td className="p-3">
                    <span
                      className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${
                        isRefund
                          ? 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                          : 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/30'
                      }`}
                    >
                      {isRefund ? 'CUSTOMER REFUND' : 'STOCK TRANSFER'}
                    </span>
                  </td>
                  <td className="p-3 text-slate-300 max-w-xs truncate">
                    {isRefund ? (
                      <span>Sale: {item.sale_number} ({item.customer_name})</span>
                    ) : (
                      <span>{item.source_warehouse_name} → {item.target_warehouse_name}</span>
                    )}
                  </td>
                  <td className="p-3 text-slate-400">
                    {item.requested_by_name || 'Staff'}
                  </td>
                  <td className="p-3 text-slate-300 font-semibold">
                    {item.approved_by_name || user?.full_name || 'Management'}
                  </td>
                  <td className="p-3 text-center">
                    <span
                      className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${
                        isApproved
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                          : isRejected
                            ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
                            : 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                      }`}
                    >
                      {item.status}
                    </span>
                  </td>
                  <td className="p-3 text-right font-mono font-bold text-slate-200 tabular-nums">
                    {isRefund && item.amount ? api.formatKES(item.amount) : `${item.items?.length || 1} lines`}
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
