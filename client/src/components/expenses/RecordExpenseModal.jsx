import React from 'react';
import { X, Banknote, ShieldAlert } from 'lucide-react';

export function RecordExpenseModal({
  isOpen,
  onClose,
  category,
  setCategory,
  payee,
  setPayee,
  amount,
  setAmount,
  description,
  setDescription,
  paymentMethod,
  setPaymentMethod,
  onSubmit
}) {
  if (!isOpen) return null;

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
          <span className="text-[10px] font-mono text-emerald-400 uppercase tracking-wider font-bold">
            PETTY CASH // NEW DISBURSEMENT VOUCHER
          </span>
          <h3 className="text-base font-bold text-slate-100 font-mono mt-0.5 flex items-center gap-2">
            <Banknote className="w-4 h-4 text-emerald-400" />
            Record Operational Expense
          </h3>
        </div>

        <div className="space-y-3.5 text-xs font-mono">
          <div>
            <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1.5">
              Expense Category *
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-3 py-2 rounded bg-[#0c0e12] border border-[#222834] text-slate-200 font-mono focus:outline-none focus:border-emerald-500 cursor-pointer"
            >
              <option value="Fuel">Fuel (TotalEnergies / Shell / Rubis)</option>
              <option value="Maintenance">Vehicle & Fleet Maintenance</option>
              <option value="Packaging">Packaging Materials, Tape & Boxes</option>
              <option value="Utilities">Utilities, Power & High-Speed Fiber</option>
              <option value="Sundry">Staff Welfare & Station Sundries</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1.5">
              Merchant / Payee Name *
            </label>
            <input
              type="text"
              value={payee}
              onChange={(e) => setPayee(e.target.value)}
              placeholder="e.g. TotalEnergies Westlands, KPLC, Crown Packaging"
              className="w-full px-3 py-2 rounded bg-[#0c0e12] border border-[#222834] text-slate-100 font-mono focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1.5">
              Disbursement Amount (KES) *
            </label>
            <input
              type="number"
              min="1"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="e.g. 3500"
              className="w-full px-3 py-2 rounded bg-[#0c0e12] border border-[#222834] text-slate-100 font-mono font-bold text-sm focus:outline-none focus:border-emerald-500"
            />
            <div className="flex gap-1.5 mt-1.5">
              {[500, 1500, 3500, 8000].map((amt) => (
                <button
                  key={amt}
                  type="button"
                  onClick={() => setAmount(String(amt))}
                  className="px-2 py-1 rounded bg-[#181d28] hover:bg-[#222834] border border-[#222834] text-slate-300 text-[10px] font-mono cursor-pointer"
                >
                  KSh {amt}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1.5">
              Justification / Fleet Registration *
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Fuel replenishment for delivery van KDA 482B"
              className="w-full px-3 py-2 rounded bg-[#0c0e12] border border-[#222834] text-slate-100 font-mono focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1.5">
              Disbursement Tender
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'CASH', label: 'Petty Cash' },
                { id: 'MPESA', label: 'M-Pesa Till' },
                { id: 'CARD', label: 'Card' },
              ].map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setPaymentMethod(m.id)}
                  className={`py-1.5 rounded font-bold text-[10px] font-mono border transition-colors cursor-pointer ${
                    paymentMethod === m.id
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                      : 'bg-[#0c0e12] text-slate-400 border-[#222834]'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          {Number(amount) > 10000 && (
            <div className="p-2.5 rounded bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[10px] font-mono flex items-start gap-1.5">
              <ShieldAlert className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
              <span>
                Amounts exceeding KSh 10,000 require manager approval before fund release.
              </span>
            </div>
          )}

          <div className="pt-2 flex gap-2.5">
            <button
              onClick={onSubmit}
              className="flex-1 py-2.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-bold font-mono text-xs uppercase tracking-wider shadow-lg shadow-emerald-950/40 transition-colors cursor-pointer"
            >
              Save & Commit Voucher
            </button>
            <button
              onClick={onClose}
              className="py-2.5 px-4 rounded bg-[#181d28] hover:bg-slate-700 text-slate-300 font-semibold font-mono text-xs cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
