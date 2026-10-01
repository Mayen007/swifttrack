import React from 'react';
import { PauseCircle, X, Trash2 } from 'lucide-react';
import { api } from '../../services/api.js';

export function HeldCartsModal({
  isOpen,
  onClose,
  heldCarts,
  onRecall,
  onDiscard,
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
                <PauseCircle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white uppercase font-mono">HELD REGISTER CARTS</h3>
                <p className="text-[11px] text-slate-400">{heldCarts.length} cart(s) on reserve</p>
              </div>
            </div>

            <div className="mt-4 space-y-2.5 max-h-72 overflow-y-auto pr-1">
              {heldCarts.length === 0 ? (
                <p className="text-center py-8 text-slate-500 font-mono text-xs">No held carts currently on reserve.</p>
              ) : (
                heldCarts.map((c) => {
                  const cartSum = c.items.reduce(
                    (s, it) => s + (it.product.price ?? it.product.selling_price ?? 0) * it.quantity,
                    0
                  );
                  return (
                    <div
                      key={c.id}
                      className="p-3 rounded bg-[#0c0e12] border border-[#222834] flex items-center justify-between gap-3 text-xs font-mono"
                    >
                      <div>
                        <div className="font-bold text-white flex items-center gap-1.5">
                          <span>{c.customerName || 'Walk-in Customer'}</span>
                          <span className="text-[10px] text-slate-500">({c.heldAt})</span>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          {c.items.length} product(s) • <strong className="text-emerald-400">{api.formatKES(cartSum)}</strong>
                        </p>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => {
                            onRecall(c.id);
                            onClose();
                          }}
                          className="px-2.5 py-1 rounded bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-[10px] cursor-pointer"
                        >
                          RESUME
                        </button>
                        <button
                          onClick={() => onDiscard(c.id)}
                          className="p-1 rounded bg-[#161c28] hover:bg-rose-950 text-slate-400 hover:text-rose-400 border border-[#222834] cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="pt-3 border-t border-[#222834] mt-3">
              <button
                onClick={() => onClose()}
                className="w-full py-2 rounded bg-[#161c28] hover:bg-[#202738] text-slate-300 text-xs font-mono cursor-pointer"
              >
                CLOSE
              </button>
            </div>
          </div>
        </div>
  );
}
