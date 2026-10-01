import React from 'react';
import { Undo2, X } from 'lucide-react';
import { api } from '../../services/api.js';

export function PaymentRefundModal({
  isOpen,
  refundPaymentRecord,
  refundAmount,
  setRefundAmount,
  refundReason,
  setRefundReason,
  refunding,
  onClose,
  onSubmit
}) {
  if (!isOpen || !refundPaymentRecord) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3 select-none overflow-y-auto">
      <div className="bg-[#12161f] border border-[#222834] rounded-lg max-w-sm w-full shadow-2xl p-5 space-y-4 my-auto text-xs font-mono">
        <div className="flex items-center justify-between border-b border-[#222834] pb-3">
          <div className="flex items-center gap-2">
            <Undo2 className="w-5 h-5 text-rose-400" />
            <h3 className="font-bold text-white text-sm">PROCESS REFUND</h3>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-2">
          <div className="bg-[#0c0e12] p-2.5 rounded border border-[#222834]">
            <span className="text-[10px] text-slate-500 block uppercase">Original Payment</span>
            <span className="font-bold text-white">{refundPaymentRecord.payment_number}</span>
            <span className="text-emerald-400 font-bold block">{api.formatKES(refundPaymentRecord.amount)}</span>
          </div>

          <div>
            <label className="text-slate-400 text-[10px] uppercase block mb-1">Refund Amount (KES)</label>
            <input
              type="number"
              step="0.01"
              required
              max={refundPaymentRecord.amount}
              value={refundAmount}
              onChange={(e) => setRefundAmount(e.target.value)}
              className="w-full p-2 rounded bg-[#0c0e12] border border-[#222834] text-rose-300 font-bold focus:border-amber-400 focus:outline-none"
            />
          </div>

          <div>
            <label className="text-slate-400 text-[10px] uppercase block mb-1">Reason for Refund</label>
            <textarea
              rows="2"
              required
              value={refundReason}
              onChange={(e) => setRefundReason(e.target.value)}
              className="w-full p-2 rounded bg-[#0c0e12] border border-[#222834] text-white focus:border-amber-400 focus:outline-none text-xs"
            />
          </div>
        </div>

        <div className="pt-2 flex justify-end gap-2 border-t border-[#222834]">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 rounded bg-[#161c28] hover:bg-[#202738] text-slate-300 font-bold cursor-pointer"
          >
            CANCEL
          </button>
          <button
            type="button"
            onClick={onSubmit}
            disabled={refunding}
            className="px-4 py-1.5 rounded bg-rose-600 hover:bg-rose-500 text-white font-bold cursor-pointer disabled:opacity-50"
          >
            {refunding ? 'PROCESSING...' : 'CONFIRM REFUND'}
          </button>
        </div>
      </div>
    </div>
  );
}
