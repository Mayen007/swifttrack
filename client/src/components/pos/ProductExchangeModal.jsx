import React from 'react';
import { ArrowRightLeft, X } from 'lucide-react';
import { api } from '../../services/api.js';

export function ProductExchangeModal({
  isOpen,
  onClose,
  exchangeReturnProduct,
  setExchangeReturnProduct,
  exchangeReturnQty,
  setExchangeReturnQty,
  exchangePurchaseProduct,
  setExchangePurchaseProduct,
  exchangePurchaseQty,
  setExchangePurchaseQty,
  exchangeSubmitting,
  products,
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
              <div className="w-9 h-9 rounded bg-blue-500/10 border border-blue-500/30 text-blue-400 flex items-center justify-center">
                <ArrowRightLeft className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white uppercase font-mono">PRODUCT EXCHANGE</h3>
                <p className="text-[11px] text-slate-400">Return item and purchase replacement with net settlement</p>
              </div>
            </div>

            <form onSubmit={onSubmit} className="mt-4 space-y-3 font-mono text-xs">
              {/* Return Section */}
              <div className="p-2.5 rounded bg-rose-500/5 border border-rose-500/20 space-y-2">
                <span className="text-[10px] font-bold text-rose-400 uppercase block">1. ITEM RETURNED BY CUSTOMER</span>
                <select
                  value={exchangeReturnProduct}
                  onChange={(e) => setExchangeReturnProduct(e.target.value)}
                  className="w-full px-2 py-1.5 rounded bg-[#0c0e12] border border-[#222834] text-white focus:outline-none"
                  required
                >
                  <option value="">Select Returned Product...</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({api.formatKES(p.price ?? p.selling_price)})
                    </option>
                  ))}
                </select>
                <div className="flex items-center gap-2">
                  <span className="text-slate-400">Qty Returned:</span>
                  <input
                    type="number"
                    min="1"
                    value={exchangeReturnQty}
                    onChange={(e) => setExchangeReturnQty(e.target.value)}
                    className="w-20 px-2 py-1 rounded bg-[#0c0e12] border border-[#222834] text-white font-bold"
                  />
                </div>
              </div>

              {/* Purchase Section */}
              <div className="p-2.5 rounded bg-emerald-500/5 border border-emerald-500/20 space-y-2">
                <span className="text-[10px] font-bold text-emerald-400 uppercase block">2. NEW REPLACEMENT ITEM</span>
                <select
                  value={exchangePurchaseProduct}
                  onChange={(e) => setExchangePurchaseProduct(e.target.value)}
                  className="w-full px-2 py-1.5 rounded bg-[#0c0e12] border border-[#222834] text-white focus:outline-none"
                  required
                >
                  <option value="">Select Replacement Product...</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({api.formatKES(p.price ?? p.selling_price)})
                    </option>
                  ))}
                </select>
                <div className="flex items-center gap-2">
                  <span className="text-slate-400">Qty Taken:</span>
                  <input
                    type="number"
                    min="1"
                    value={exchangePurchaseQty}
                    onChange={(e) => setExchangePurchaseQty(e.target.value)}
                    className="w-20 px-2 py-1 rounded bg-[#0c0e12] border border-[#222834] text-white font-bold"
                  />
                </div>
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="submit"
                  disabled={exchangeSubmitting}
                  className="flex-1 py-2.5 rounded bg-blue-600 hover:bg-blue-500 text-white font-bold transition-colors cursor-pointer disabled:opacity-40"
                >
                  {exchangeSubmitting ? 'PROCESSING...' : 'PROCESS EXCHANGE'}
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
