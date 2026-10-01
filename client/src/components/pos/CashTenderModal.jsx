import React from 'react';
import { Banknote, X } from 'lucide-react';
import { api } from '../../services/api.js';

export function CashTenderModal({
  isOpen,
  onClose,
  totals,
  cashTendered,
  setCashTendered,
  onCompleteSale,
}) {
  if (!isOpen) return null;

  return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 select-none">
          <div className="bg-[#12161f] border border-[#222834] rounded-lg p-5 max-w-sm w-full shadow-2xl relative animate-in fade-in duration-150">
            <button
              onClick={() => onClose()}
              className="absolute top-3.5 right-3.5 text-slate-400 hover:text-white p-1 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="text-center pb-3 border-b border-[#222834]">
              <Banknote className="w-8 h-8 text-emerald-400 mx-auto mb-1.5" />
              <h3 className="text-sm font-bold text-white uppercase font-mono">CASH PAYMENT & CHANGE</h3>
              <p className="text-xs text-slate-400 font-mono mt-0.5">
                Total Due: <strong className="text-emerald-400 tabular-nums">{api.formatKES(totals.grandTotal)}</strong>
              </p>
            </div>

            <div className="mt-4 space-y-3 font-mono text-xs">
              <div>
                <label className="block text-[11px] text-slate-400 uppercase mb-1">
                  Cash Tendered (KES)
                </label>
                <input
                  type="number"
                  min={totals.grandTotal}
                  step="10"
                  value={cashTendered}
                  onChange={(e) => setCashTendered(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded bg-[#0c0e12] border border-[#222834] text-white font-bold text-base focus:outline-none focus:border-emerald-500"
                />
                <div className="flex gap-1.5 mt-2">
                  <button
                    type="button"
                    onClick={() => setCashTendered(totals.grandTotal)}
                    className="flex-1 py-1 text-[10px] rounded bg-[#161c28] border border-[#222834] text-slate-300 hover:text-white cursor-pointer"
                  >
                    EXACT
                  </button>
                  {[500, 1000, 2000].map((extra) => (
                    <button
                      key={extra}
                      type="button"
                      onClick={() => setCashTendered(Math.ceil(totals.grandTotal / extra) * extra)}
                      className="flex-1 py-1 text-[10px] rounded bg-[#161c28] border border-[#222834] text-slate-300 hover:text-white cursor-pointer"
                    >
                      +{extra}
                    </button>
                  ))}
                </div>
              </div>

              {/* Change Output */}
              <div className="bg-[#0c0e12] border border-[#222834] p-3 rounded flex justify-between items-baseline">
                <span className="text-xs text-slate-400 uppercase">CHANGE DUE:</span>
                <span className="text-lg font-bold text-emerald-400 tabular-nums">
                  {api.formatKES(Math.max(0, cashTendered - totals.grandTotal))}
                </span>
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const change = Math.max(0, cashTendered - totals.grandTotal);
                    onCompleteSale('CASH', `CASH-${Date.now()}`, null, cashTendered, change);
                  }}
                  disabled={cashTendered < totals.grandTotal}
                  className="flex-1 py-2.5 rounded bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-bold transition-colors cursor-pointer disabled:cursor-not-allowed"
                >
                  CONFIRM CASH TENDER
                </button>
                <button
                  type="button"
                  onClick={() => onClose()}
                  className="px-4 py-2.5 rounded bg-[#161c28] hover:bg-[#202738] text-slate-300 transition-colors cursor-pointer"
                >
                  CANCEL
                </button>
              </div>
            </div>
          </div>
        </div>
  );
}
