// client/src/components/approvals/ApprovalInspectModal.jsx
import React from 'react';
import { X } from 'lucide-react';
import { api } from '../../services/api.js';

export function ApprovalInspectModal({ isOpen, item, onClose }) {
  if (!isOpen || !item) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-xs p-4">
      <div className="bg-[#12161f] border border-[#222834] rounded p-6 max-w-md w-full shadow-2xl relative space-y-4 animate-in fade-in zoom-in-95">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        <div>
          <span className="text-[10px] font-mono text-amber-400 uppercase tracking-wider font-bold">
            AUDIT VERIFICATION // DETAILS
          </span>
          <h3 className="text-base font-bold text-slate-100 font-mono mt-0.5">
            {item.refund_request_number || item.transfer_number}
          </h3>
        </div>

        <div className="bg-[#0c0e12] border border-[#222834] rounded p-3 text-xs font-mono space-y-2">
          <div className="flex justify-between border-b border-[#222834] pb-1.5">
            <span className="text-slate-500">Authorization Type:</span>
            <span className="font-bold text-amber-400">{item.record_type}</span>
          </div>
          <div className="flex justify-between border-b border-[#222834] pb-1.5">
            <span className="text-slate-500">Requested By:</span>
            <span className="text-slate-200">{item.requested_by_name || 'Staff'}</span>
          </div>
          <div className="flex justify-between border-b border-[#222834] pb-1.5">
            <span className="text-slate-500">Status:</span>
            <span className="font-bold text-slate-200">{item.status}</span>
          </div>
          {item.record_type === 'REFUND' ? (
            <>
              <div className="flex justify-between border-b border-[#222834] pb-1.5">
                <span className="text-slate-500">Sale Number:</span>
                <span className="text-slate-200 font-semibold">{item.sale_number}</span>
              </div>
              <div className="flex justify-between border-b border-[#222834] pb-1.5">
                <span className="text-slate-500">Customer:</span>
                <span className="text-slate-200">{item.customer_name || 'Walk-in'}</span>
              </div>
              <div className="flex justify-between border-b border-[#222834] pb-1.5">
                <span className="text-slate-500">Refund Amount:</span>
                <span className="text-rose-400 font-bold tabular-nums">
                  {api.formatKES(item.amount)}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block">Cashier Reason:</span>
                <span className="text-slate-200 italic mt-0.5 block">{item.reason}</span>
              </div>
            </>
          ) : (
            <>
              <div className="flex justify-between border-b border-[#222834] pb-1.5">
                <span className="text-slate-500">Source:</span>
                <span className="text-slate-200">{item.source_warehouse_name}</span>
              </div>
              <div className="flex justify-between border-b border-[#222834] pb-1.5">
                <span className="text-slate-500">Destination:</span>
                <span className="text-emerald-400 font-semibold">{item.target_warehouse_name}</span>
              </div>
              <div>
                <span className="text-slate-500 block">Transit Notes:</span>
                <span className="text-slate-200 italic mt-0.5 block">{item.notes || 'None'}</span>
              </div>
            </>
          )}
        </div>

        <button
          onClick={onClose}
          className="w-full py-2 rounded bg-[#0c0e12] hover:bg-[#181d28] text-slate-400 hover:text-slate-200 border border-[#222834] text-xs font-mono cursor-pointer"
        >
          Close Inspector
        </button>
      </div>
    </div>
  );
}
