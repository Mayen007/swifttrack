import React from 'react';
import { X, Printer } from 'lucide-react';
import { api } from '../../services/api.js';
import { sound } from '../../services/sound.js';

export function InspectExpenseModal({ isOpen, onClose, expense }) {
  if (!isOpen || !expense) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-xs p-4">
      <div className="bg-[#12161f] border border-[#222834] rounded p-6 max-w-sm w-full shadow-2xl relative space-y-4 animate-in fade-in zoom-in-95">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        <div>
          <span className="text-[10px] font-mono text-emerald-400 uppercase tracking-wider font-bold">
            AUDIT SLIP // PETTY CASH VOUCHER
          </span>
          <h3 className="text-base font-bold text-slate-100 font-mono mt-0.5">
            {expense.expense_number}
          </h3>
        </div>

        <div className="bg-[#0c0e12] border border-[#222834] rounded p-3 text-xs font-mono space-y-2">
          <div className="flex justify-between border-b border-[#222834] pb-1.5">
            <span className="text-slate-500">Category:</span>
            <span className="text-slate-200 font-bold">{expense.category}</span>
          </div>
          <div className="flex justify-between border-b border-[#222834] pb-1.5">
            <span className="text-slate-500">Merchant / Payee:</span>
            <span className="text-slate-200 font-semibold">{expense.payee || 'Direct Vendor'}</span>
          </div>
          <div className="flex justify-between border-b border-[#222834] pb-1.5">
            <span className="text-slate-500">Disbursed Amount:</span>
            <span className="text-rose-400 font-bold tabular-nums">
              {api.formatKES(expense.amount)}
            </span>
          </div>
          <div className="flex justify-between border-b border-[#222834] pb-1.5">
            <span className="text-slate-500">Tender Method:</span>
            <span className="text-slate-200">{expense.payment_method}</span>
          </div>
          <div className="flex justify-between border-b border-[#222834] pb-1.5">
            <span className="text-slate-500">Submitted By:</span>
            <span className="text-slate-200">{expense.created_by_name || 'Staff'}</span>
          </div>
          <div className="flex justify-between border-b border-[#222834] pb-1.5">
            <span className="text-slate-500">Audit Status:</span>
            <span className="font-bold text-emerald-400">{expense.status}</span>
          </div>
          <div>
            <span className="text-slate-500 block text-[10px]">Justification:</span>
            <span className="text-slate-200 italic mt-0.5 block">{expense.description}</span>
          </div>
        </div>

        <div className="flex gap-2 pt-1">
          <button
            onClick={() => {
              sound.playSuccess();
              window.print();
            }}
            className="flex-1 py-2 rounded bg-blue-600 hover:bg-blue-500 text-white font-bold font-mono text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print Voucher</span>
          </button>
          <button
            onClick={onClose}
            className="py-2 px-4 rounded bg-[#181d28] hover:bg-slate-700 text-slate-300 font-semibold font-mono text-xs cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
