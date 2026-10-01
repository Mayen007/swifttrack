import React from 'react';
import { Lock, X, AlertTriangle } from 'lucide-react';
import { api } from '../../services/api.js';

export function CloseShiftModal({
  isOpen,
  onClose,
  activeShift,
  countedCash,
  setCountedCash,
  closeShiftNotes,
  setCloseShiftNotes,
  onSubmit,
}) {
  if (!isOpen || !activeShift) return null;

  const cashExpected = activeShift ? Number(activeShift.expected_cash || 0) : 0;
  const cashVariance = Number(countedCash) - cashExpected;

  return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 select-none">
          <div className="bg-[#12161f] border border-[#222834] rounded-lg p-5 max-w-lg w-full shadow-2xl relative animate-in fade-in duration-150">
            <button
              onClick={() => onClose()}
              className="absolute top-3.5 right-3.5 text-slate-400 hover:text-white p-1 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-2.5 pb-3 border-b border-[#222834]">
              <div className="w-9 h-9 rounded bg-rose-500/10 border border-rose-500/30 text-rose-400 flex items-center justify-center">
                <Lock className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white uppercase font-mono">
                  CLOSE SHIFT // RECONCILIATION
                </h3>
                <p className="text-[11px] text-slate-400">Shift #{activeShift.shift_number} End-of-Day Balancing</p>
              </div>
            </div>

            <form onSubmit={onSubmit} className="mt-4 space-y-3.5 text-xs font-mono">
              {/* Ledger breakdown */}
              <div className="bg-[#0c0e12] border border-[#222834] rounded p-3 space-y-1.5">
                <div className="flex justify-between text-slate-400">
                  <span>Opening Float:</span>
                  <span className="text-white tabular-nums">{api.formatKES(activeShift.opening_float)}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Cash Sales ({activeShift.total_sales_count} tx):</span>
                  <span className="text-emerald-400 font-bold tabular-nums">+{api.formatKES(activeShift.total_cash_amount)}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>M-Pesa / Card / Bank:</span>
                  <span className="text-blue-400 tabular-nums">
                    {api.formatKES(Number(activeShift.total_mpesa_amount) + Number(activeShift.total_card_amount) + Number(activeShift.total_bank_amount))}
                  </span>
                </div>
                <div className="flex justify-between text-slate-300 font-bold pt-1.5 border-t border-[#222834]">
                  <span>EXPECTED DRAWER CASH:</span>
                  <span className="text-emerald-400 text-sm tabular-nums">{api.formatKES(cashExpected)}</span>
                </div>
              </div>

              {/* Physical Cash Counted input */}
              <div>
                <label className="block text-[11px] text-slate-400 uppercase mb-1">
                  Physical Cash Counted (KES) *
                </label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={countedCash}
                  onChange={(e) => setCountedCash(e.target.value)}
                  className="w-full px-3 py-2 rounded bg-[#0c0e12] border border-[#222834] text-white text-base font-bold focus:outline-none focus:border-amber-400"
                  required
                />
              </div>

              {/* Variance Indicator */}
              <div className={`p-3 rounded border flex items-center justify-between ${
                Math.abs(cashVariance) < 0.01
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                  : cashVariance > 0
                  ? 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                  : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
              }`}>
                <div>
                  <span className="text-[10px] uppercase block font-bold">CASH VARIANCE</span>
                  <span className="font-bold text-sm">
                    {Math.abs(cashVariance) < 0.01
                      ? 'PERFECTLY BALANCED (0.00 KES)'
                      : cashVariance > 0
                      ? `OVERAGE (+${api.formatKES(cashVariance)})`
                      : `SHORTAGE (-${api.formatKES(Math.abs(cashVariance))})`}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-slate-400 block">Status</span>
                  <span className="font-bold uppercase">
                    {Math.abs(cashVariance) < 0.01 ? 'BALANCED' : cashVariance > 0 ? 'OVER' : 'SHORT'}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-[11px] text-slate-400 uppercase mb-1">
                  Handover Notes / Discrepancy Reason
                </label>
                <textarea
                  rows="2"
                  value={closeShiftNotes}
                  onChange={(e) => setCloseShiftNotes(e.target.value)}
                  placeholder="Notes for the branch manager / supervisor..."
                  className="w-full px-3 py-2 rounded bg-[#0c0e12] border border-[#222834] text-white focus:outline-none focus:border-amber-400 font-sans"
                />
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded bg-rose-600 hover:bg-rose-500 text-white font-bold transition-colors cursor-pointer"
                >
                  SUBMIT COUNT & CLOSE SHIFT
                </button>
                <button
                  type="button"
                  onClick={() => onClose()}
                  className="px-4 py-2.5 rounded bg-[#161c28] hover:bg-[#202738] text-slate-300 transition-colors cursor-pointer"
                >
                  BACK
                </button>
              </div>
            </form>
          </div>
        </div>
  );
}
