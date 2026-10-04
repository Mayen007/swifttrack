import React from 'react';
import { ShieldAlert, CheckCircle2 } from 'lucide-react';

export function ExceptionsTab({
  exceptionItems,
  onRequeueDelivery
}) {
  return (
    <div className="bg-[#12161f] border border-[#222834] rounded p-5 space-y-4">
      <div className="flex items-center justify-between border-b border-[#222834] pb-3">
        <div>
          <h2 className="text-xs font-bold text-slate-100 uppercase tracking-wider font-mono flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-rose-400" />
            Delivery Exceptions & Return-to-Branch Ledger
          </h2>
          <p className="text-[11px] text-slate-400 mt-0.5 font-mono">
            Log of failed drop-offs, rejected deliveries, and items returning to hub inventory
          </p>
        </div>
        <span className="px-2 py-0.5 rounded bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-mono font-bold tabular-nums">
          {exceptionItems.length} EXCEPTIONS
        </span>
      </div>

      {exceptionItems.length === 0 ? (
        <div className="border border-dashed border-[#222834] rounded p-12 text-center">
          <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
          <h3 className="text-xs font-mono font-bold text-slate-300 uppercase tracking-wider">
            Zero Exceptions Logged
          </h3>
          <p className="text-[11px] text-slate-500 font-mono mt-1">
            All dispatches in the current filter are progressing safely through standard pipeline stages.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono border-collapse">
            <thead>
              <tr className="border-b border-[#222834] text-[10px] text-slate-400 uppercase tracking-wider bg-[#0c0e12]">
                <th className="p-3">Manifest #</th>
                <th className="p-3">Recipient & Phone</th>
                <th className="p-3">Destination</th>
                <th className="p-3">Courier</th>
                <th className="p-3">Exception Status</th>
                <th className="p-3">Failure Reason / Notes</th>
                <th className="p-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#222834]">
              {exceptionItems.map((item) => (
                <tr key={item.id} className="hover:bg-[#181d28]/40 transition-colors">
                  <td className="p-3 font-bold text-blue-400">
                    {item.delivery_number}
                    <span className="block text-[10px] text-slate-500">{item.order_number}</span>
                  </td>
                  <td className="p-3">
                    <span className="font-semibold text-slate-200 block">{item.recipient_name}</span>
                    <span className="text-slate-400 text-[10px]">{item.recipient_phone}</span>
                  </td>
                  <td className="p-3 text-slate-300 max-w-xs truncate">
                    {item.delivery_address}, {item.delivery_city}
                  </td>
                  <td className="p-3 text-slate-300">
                    {item.driver_name || <span className="text-slate-500 italic">Unassigned</span>}
                  </td>
                  <td className="p-3">
                    <span className="px-2 py-0.5 rounded bg-rose-500/20 border border-rose-500/40 text-rose-400 text-[10px] font-bold uppercase">
                      {item.status}
                    </span>
                  </td>
                  <td className="p-3 max-w-xs">
                    <span className="text-slate-200 font-semibold block">{item.failure_reason || 'Dispatch Exception'}</span>
                    <span className="text-slate-500 text-[10px] block truncate">{item.failure_notes || 'No notes logged'}</span>
                  </td>
                  <td className="p-3 text-right">
                    <button
                      onClick={() => onRequeueDelivery(item)}
                      className="px-2.5 py-1 rounded bg-[#0c0e12] hover:bg-blue-600/20 text-blue-400 hover:text-blue-300 border border-[#222834] hover:border-blue-500/40 text-[10px] font-mono font-bold cursor-pointer transition-colors"
                      title="Re-queue to Ready for Dispatch"
                    >
                      RE-QUEUE
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
