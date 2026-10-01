import React from 'react';
import { Split, X, Plus, Trash2 } from 'lucide-react';
import { api } from '../../services/api.js';

export function SplitPaymentModal({
  isOpen,
  onClose,
  totals,
  splitLines,
  setSplitLines,
  mpesaPhone,
  onCompleteSale,
}) {
  if (!isOpen) return null;

  const totalSplitAllocated = splitLines.reduce((sum, l) => sum + (Number(l.amount) || 0), 0);
  const remainingSplitDue = totals.grandTotal - totalSplitAllocated;

  return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 select-none">
          <div className="bg-[#12161f] border border-[#222834] rounded-lg p-5 max-w-md w-full shadow-2xl relative animate-in fade-in duration-150">
            <button
              onClick={() => onClose()}
              className="absolute top-3.5 right-3.5 text-slate-400 hover:text-white p-1 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-2.5 pb-3 border-b border-[#222834]">
              <div className="w-9 h-9 rounded bg-amber-400/10 border border-amber-400/30 text-amber-400 flex items-center justify-center">
                <Split className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white uppercase font-mono">SPLIT TENDER PAYMENT</h3>
                <p className="text-[11px] text-slate-400">
                  Total Due: <strong className="text-emerald-400 tabular-nums">{api.formatKES(totals.grandTotal)}</strong>
                </p>
              </div>
            </div>

            <div className="mt-4 space-y-3 font-mono text-xs">
              {splitLines.map((line, idx) => (
                <div key={line.id} className="p-2.5 rounded bg-[#0c0e12] border border-[#222834] space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-slate-400 uppercase font-bold">TENDER #{idx + 1}</span>
                    {splitLines.length > 1 && (
                      <button
                        onClick={() => setSplitLines(splitLines.filter((l) => l.id !== line.id))}
                        className="text-rose-400 hover:text-rose-300 p-0.5 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <select
                      value={line.method}
                      onChange={(e) => {
                        const m = e.target.value;
                        setSplitLines(splitLines.map((l) => (l.id === line.id ? { ...l, method: m } : l)));
                      }}
                      className="px-2 py-1.5 rounded bg-[#161c28] border border-[#222834] text-white text-xs focus:outline-none"
                    >
                      <option value="CASH">CASH</option>
                      <option value="MPESA">M-PESA</option>
                      <option value="CARD">CARD</option>
                      <option value="BANK_TRANSFER">BANK</option>
                    </select>

                    <input
                      type="number"
                      min="1"
                      step="1"
                      placeholder="Amount (KES)"
                      value={line.amount}
                      onChange={(e) => {
                        const val = e.target.value;
                        setSplitLines(splitLines.map((l) => (l.id === line.id ? { ...l, amount: val } : l)));
                      }}
                      className="px-2 py-1.5 rounded bg-[#161c28] border border-[#222834] text-emerald-400 font-bold text-xs focus:outline-none"
                    />
                  </div>
                </div>
              ))}

              <button
                type="button"
                onClick={() => {
                  const rem = Math.max(0, remainingSplitDue);
                  setSplitLines([...splitLines, { id: Date.now(), method: 'CASH', amount: rem || '' }]);
                }}
                className="w-full py-1.5 rounded bg-[#161c28] hover:bg-[#202738] border border-[#222834] text-[11px] text-slate-300 hover:text-white flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-3 h-3" />
                <span>ADD ANOTHER TENDER LINE</span>
              </button>

              {/* Status breakdown */}
              <div className="bg-[#0c0e12] p-2.5 rounded border border-[#222834] space-y-1">
                <div className="flex justify-between text-slate-400">
                  <span>Allocated:</span>
                  <span className="text-white tabular-nums">{api.formatKES(totalSplitAllocated)}</span>
                </div>
                <div className="flex justify-between font-bold">
                  <span>Remaining Due:</span>
                  <span className={`tabular-nums ${remainingSplitDue <= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {api.formatKES(remainingSplitDue)}
                  </span>
                </div>
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const formatted = splitLines.map((l) => ({
                      method: l.method,
                      amount: Number(l.amount) || 0,
                      reference_code: `${l.method}-${Date.now()}`,
                    }));
                    onCompleteSale('SPLIT', null, formatted);
                  }}
                  disabled={remainingSplitDue > 0.05}
                  className="flex-1 py-2.5 rounded bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-bold transition-colors cursor-pointer disabled:cursor-not-allowed"
                >
                  CONFIRM SPLIT PAYMENT
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
