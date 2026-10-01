import React from 'react';
import { Coins, X } from 'lucide-react';
import { api } from '../../services/api.js';

export function CashMovementModal({
  isOpen,
  onClose,
  activeShift,
  movementType,
  setMovementType,
  movementAmount,
  setMovementAmount,
  movementReason,
  setMovementReason,
  onSubmit,
}) {
  if (!isOpen || !activeShift) return null;

  return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 select-none">
          <div className="bg-[#12161f] border border-[#222834] rounded-lg p-5 max-w-sm w-full shadow-2xl relative animate-in fade-in duration-150">
            <button
              onClick={() => onClose()}
              className="absolute top-3.5 right-3.5 text-slate-400 hover:text-white p-1 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-2.5 pb-3 border-b border-[#222834]">
              <div className="w-9 h-9 rounded bg-amber-400/10 border border-amber-400/30 text-amber-400 flex items-center justify-center">
                <Coins className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white uppercase font-mono">DRAWER MOVEMENT</h3>
                <p className="text-[11px] text-slate-400">Current Cash: {api.formatKES(activeShift.expected_cash)}</p>
              </div>
            </div>

            <form onSubmit={onSubmit} className="mt-4 space-y-3.5 text-xs font-mono">
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setMovementType('PAYOUT')}
                  className={`py-2 rounded font-bold cursor-pointer border ${
                    movementType === 'PAYOUT'
                      ? 'bg-amber-400 text-slate-950 border-amber-400'
                      : 'bg-[#0c0e12] text-slate-300 border-[#222834]'
                  }`}
                >
                  PETTY PAYOUT
                </button>
                <button
                  type="button"
                  onClick={() => setMovementType('DROP_OUT')}
                  className={`py-2 rounded font-bold cursor-pointer border ${
                    movementType === 'DROP_OUT'
                      ? 'bg-amber-400 text-slate-950 border-amber-400'
                      : 'bg-[#0c0e12] text-slate-300 border-[#222834]'
                  }`}
                >
                  SAFE DROP
                </button>
              </div>

              <div>
                <label className="block text-[11px] text-slate-400 uppercase mb-1">
                  Amount (KES) *
                </label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={movementAmount}
                  onChange={(e) => setMovementAmount(e.target.value)}
                  placeholder="e.g. 500"
                  className="w-full px-3 py-2 rounded bg-[#0c0e12] border border-[#222834] text-white font-bold text-sm focus:outline-none focus:border-amber-400"
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] text-slate-400 uppercase mb-1">
                  Reason / Purpose *
                </label>
                <input
                  type="text"
                  value={movementReason}
                  onChange={(e) => setMovementReason(e.target.value)}
                  placeholder="e.g. Packaging tape & bubble wrap"
                  className="w-full px-3 py-2 rounded bg-[#0c0e12] border border-[#222834] text-white focus:outline-none focus:border-amber-400"
                  required
                />
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold transition-colors cursor-pointer"
                >
                  RECORD MOVEMENT
                </button>
                <button
                  type="button"
                  onClick={() => onClose()}
                  className="px-4 py-2.5 rounded bg-[#161c28] hover:bg-[#202738] text-slate-300 transition-colors cursor-pointer"
                >
                  CANCEL
                </button>
              </div>
            </form>
          </div>
        </div>
  );
}
