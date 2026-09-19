// client/src/components/approvals/ApprovalsKpis.jsx
import React from 'react';
import { Clock, ArrowRightLeft, CheckCircle2 } from 'lucide-react';
import { api } from '../../services/api.js';

export function ApprovalsKpis({
  pendingRefundsCount,
  pendingRefundsValue,
  pendingTransfersCount,
  approvedTotalCount,
}) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-[#222834] border border-[#222834] rounded overflow-hidden">
      <div className="bg-[#0c0e12] p-2.5 flex items-center justify-between min-w-0">
        <div className="min-w-0">
          <span className="text-[10px] text-amber-400 font-mono uppercase tracking-wider block truncate">Pending Customer Refunds</span>
          <span className="text-base sm:text-lg font-mono font-bold text-amber-300 tabular-nums truncate block">{pendingRefundsCount}</span>
        </div>
        <Clock className="w-4 h-4 text-amber-400 shrink-0 ml-1" />
      </div>

      <div className="bg-[#0c0e12] p-2.5 flex items-center justify-between min-w-0">
        <div className="min-w-0">
          <span className="text-[10px] text-rose-400 font-mono uppercase tracking-wider block truncate">Awaiting Refund Capital</span>
          <span className="text-base sm:text-lg font-mono font-bold text-rose-400 tabular-nums truncate block" title={api.formatKES(pendingRefundsValue)}>
            {pendingRefundsValue >= 1000000 ? api.formatCompactKES(pendingRefundsValue) : api.formatKES(pendingRefundsValue)}
          </span>
        </div>
        <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse shrink-0 ml-2" />
      </div>

      <div className="bg-[#0c0e12] p-2.5 flex items-center justify-between min-w-0">
        <div className="min-w-0">
          <span className="text-[10px] text-indigo-400 font-mono uppercase tracking-wider block truncate">Pending Stock Transfers</span>
          <span className="text-base sm:text-lg font-mono font-bold text-indigo-300 tabular-nums truncate block">{pendingTransfersCount}</span>
        </div>
        <ArrowRightLeft className="w-4 h-4 text-indigo-400 shrink-0 ml-1" />
      </div>

      <div className="bg-[#0c0e12] p-2.5 flex items-center justify-between min-w-0">
        <div className="min-w-0">
          <span className="text-[10px] text-emerald-400 font-mono uppercase tracking-wider block truncate">Approved Decisions</span>
          <span className="text-base sm:text-lg font-mono font-bold text-emerald-400 tabular-nums truncate block">{approvedTotalCount}</span>
        </div>
        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 ml-1" />
      </div>
    </div>
  );
}
