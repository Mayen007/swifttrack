import React from 'react';
import { ShieldCheck, Clock, Check } from 'lucide-react';

export function PodHistoryTable({ history }) {
  return (
    <div className="bg-[#12161f] border border-[#222834] rounded p-5 space-y-4">
      <div className="flex items-center justify-between border-b border-[#222834] pb-3">
        <div>
          <h2 className="text-xs font-bold text-slate-100 uppercase tracking-wider font-mono flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            Proof of Delivery (POD) Historical Ledger
          </h2>
          <p className="text-[11px] text-slate-400 mt-0.5 font-mono">
            Log of completed, signed, and OTP-verified deliveries fulfilled by your terminal
          </p>
        </div>
        <span className="px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-mono font-bold tabular-nums">
          {history.length} DELIVERED
        </span>
      </div>

      {history.length === 0 ? (
        <div className="border border-dashed border-[#222834] rounded p-12 text-center space-y-2">
          <Clock className="w-8 h-8 text-slate-600 mx-auto" />
          <h3 className="text-xs font-mono font-bold text-slate-300 uppercase tracking-wider">
            No Completed Runs Logged Yet
          </h3>
          <p className="text-[11px] text-slate-500 font-mono">
            Deliveries that you complete with digital signature and OTP verification will archive here.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono border-collapse">
            <thead>
              <tr className="border-b border-[#222834] text-[10px] text-slate-400 uppercase tracking-wider bg-[#0c0e12]">
                <th className="p-3">Manifest #</th>
                <th className="p-3">Recipient</th>
                <th className="p-3">Destination Address</th>
                <th className="p-3">Status</th>
                <th className="p-3">POD Verification</th>
                <th className="p-3 text-right">Delivered Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#222834]">
              {history.map((item) => (
                <tr key={item.id} className="hover:bg-[#181d28]/40 transition-colors">
                  <td className="p-3 font-bold text-blue-400">
                    {item.delivery_number}
                    <span className="block text-[10px] text-slate-500">{item.order_number}</span>
                  </td>
                  <td className="p-3 text-slate-200 font-semibold">{item.recipient_name}</td>
                  <td className="p-3 text-slate-400 max-w-xs truncate">{item.delivery_address}</td>
                  <td className="p-3">
                    <span className="px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[10px] font-bold uppercase">
                      {item.status}
                    </span>
                  </td>
                  <td className="p-3">
                    <span className="text-[10px] text-slate-300 flex items-center gap-1">
                      <Check className="w-3 h-3 text-emerald-400" />
                      {item.otp_verified ? 'OTP VERIFIED' : 'SIGNED POD'}
                    </span>
                  </td>
                  <td className="p-3 text-right text-slate-400 font-mono">
                    {item.verified_at ? new Date(item.verified_at).toLocaleTimeString('en-KE') : 'TODAY'}
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
