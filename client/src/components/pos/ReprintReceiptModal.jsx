import React from 'react';
import { Printer, X, Search } from 'lucide-react';
import { api } from '../../services/api.js';

export function ReprintReceiptModal({
  isOpen,
  onClose,
  reprintQuery,
  setReprintQuery,
  onLookupReceipt,
  reprintLoading,
  reprintData,
  setReprintData,
  lastCompletedSaleNumber,
}) {
  if (!isOpen) return null;

  return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 select-none">
          <div className="bg-[#12161f] border border-[#222834] rounded-lg p-5 max-w-md w-full shadow-2xl relative animate-in fade-in duration-150">
            <button
              onClick={() => {
                onClose();
                setReprintData(null);
              }}
              className="absolute top-3.5 right-3.5 text-slate-400 hover:text-white p-1 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-2.5 pb-3 border-b border-[#222834]">
              <div className="w-9 h-9 rounded bg-slate-800 border border-slate-700 text-slate-300 flex items-center justify-center">
                <Printer className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white uppercase font-mono">REPRINT RECEIPT LOOKUP</h3>
                <p className="text-[11px] text-slate-400">Search sale/receipt number for duplicate thermal copy</p>
              </div>
            </div>

            <div className="mt-4 space-y-3 font-mono text-xs">
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="e.g. SALE-1-347925"
                  value={reprintQuery}
                  onChange={(e) => setReprintQuery(e.target.value)}
                  className="flex-1 px-3 py-2 rounded bg-[#0c0e12] border border-[#222834] text-white focus:outline-none focus:border-amber-400"
                />
                <button
                  onClick={() => onLookupReceipt()}
                  disabled={reprintLoading}
                  className="px-3 py-2 rounded bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold cursor-pointer"
                >
                  {reprintLoading ? 'LOOKING UP...' : 'SEARCH'}
                </button>
              </div>

              {lastCompletedSaleNumber && (
                <button
                  type="button"
                  onClick={() => {
                    setReprintQuery(lastCompletedSaleNumber);
                    onLookupReceipt(lastCompletedSaleNumber);
                  }}
                  className="text-[10px] text-slate-400 hover:text-amber-300 underline cursor-pointer"
                >
                  Reprint Last Sale ({lastCompletedSaleNumber})
                </button>
              )}

              {/* Receipt Preview if loaded */}
              {reprintData && (
                <div className="mt-3 p-3 bg-white text-black rounded text-[10px] font-mono space-y-2 max-h-60 overflow-y-auto">
                  <div className="text-center border-b border-black pb-1">
                    <p className="font-bold uppercase">*** DUPLICATE REPRINT ***</p>
                    <p className="font-bold text-xs">SWIFTTRACK KENYA</p>
                    <p>{reprintData.sale.sale_number}</p>
                    <p className="text-[9px] text-neutral-600">{reprintData.sale.created_at}</p>
                  </div>
                  <div className="space-y-0.5">
                    {reprintData.items.map((it) => (
                      <div key={it.id} className="flex justify-between">
                        <span>{it.quantity}x {it.product_name}</span>
                        <span className="font-bold">{api.formatKES(it.line_total)}</span>
                      </div>
                    ))}
                  </div>
                  <div className="border-t border-black pt-1 flex justify-between font-bold">
                    <span>TOTAL:</span>
                    <span>{api.formatKES(reprintData.sale.total_amount)}</span>
                  </div>
                </div>
              )}

              <div className="pt-2 flex gap-2">
                {reprintData && (
                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="flex-1 py-2.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <Printer className="w-4 h-4" />
                    <span>PRINT DUPLICATE</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    setReprintData(null);
                  }}
                  className="px-4 py-2.5 rounded bg-[#161c28] hover:bg-[#202738] text-slate-300 transition-colors cursor-pointer"
                >
                  CLOSE
                </button>
              </div>
            </div>
          </div>
        </div>
  );
}
