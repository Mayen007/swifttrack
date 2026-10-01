import React from 'react';
import { Unlock, X } from 'lucide-react';

export function OpenShiftModal({
  isOpen,
  onClose,
  user,
  selectedBranch,
  openingFloat,
  setOpeningFloat,
  shiftNotes,
  setShiftNotes,
  onSubmit,
}) {
  if (!isOpen) return null;

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
                <Unlock className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white uppercase font-mono">OPEN REGISTER SHIFT</h3>
                <p className="text-[11px] text-slate-400">Initialize drawer cash float and station session</p>
              </div>
            </div>

            <form onSubmit={onSubmit} className="mt-4 space-y-4 text-xs font-mono">
              <div className="grid grid-cols-2 gap-3 text-slate-300">
                <div className="bg-[#0c0e12] p-2.5 rounded border border-[#222834]">
                  <span className="text-[10px] text-slate-500 uppercase block">Cashier</span>
                  <span className="font-bold text-white">{user?.full_name || user?.username}</span>
                </div>
                <div className="bg-[#0c0e12] p-2.5 rounded border border-[#222834]">
                  <span className="text-[10px] text-slate-500 uppercase block">Station Hub</span>
                  <span className="font-bold text-white">{selectedBranch?.name || 'Nairobi Central Hub'}</span>
                </div>
              </div>

              <div>
                <label className="block text-[11px] text-slate-400 uppercase mb-1">
                  Opening Cash Float (KES) *
                </label>
                <input
                  type="number"
                  min="0"
                  step="50"
                  value={openingFloat}
                  onChange={(e) => setOpeningFloat(e.target.value)}
                  className="w-full px-3 py-2 rounded bg-[#0c0e12] border border-[#222834] text-emerald-400 text-sm font-bold focus:outline-none focus:border-amber-400"
                  required
                />
                <div className="flex gap-2 mt-1.5">
                  {[2000, 5000, 10000].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setOpeningFloat(preset)}
                      className="px-2 py-0.5 text-[10px] rounded bg-[#161c28] border border-[#222834] text-slate-300 hover:text-white cursor-pointer"
                    >
                      KES {preset.toLocaleString()}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-[11px] text-slate-400 uppercase mb-1">
                  Opening Notes / Denomination Details
                </label>
                <input
                  type="text"
                  value={shiftNotes}
                  onChange={(e) => setShiftNotes(e.target.value)}
                  placeholder="e.g. 5x 1000, 10x 200, 10x 100"
                  className="w-full px-3 py-2 rounded bg-[#0c0e12] border border-[#222834] text-white focus:outline-none focus:border-amber-400"
                />
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold transition-colors cursor-pointer"
                >
                  START CASHIER SHIFT
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
