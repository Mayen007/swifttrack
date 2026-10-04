import React from 'react';
import { X } from 'lucide-react';
import { api } from '../../services/api.js';

export function OrderReceiptModal({
  isOpen,
  onClose,
  order,
}) {
  if (!isOpen || !order) return null;

  return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 select-none">
          <div className="bg-[#12161f] border border-[#222834] rounded-lg p-5 max-w-sm w-full shadow-2xl relative animate-in fade-in duration-150 text-xs font-mono">
            <button onClick={() => onClose()} className="absolute top-3 right-3 text-slate-400 hover:text-white">
              <X className="w-4 h-4" />
            </button>

            <div className="bg-white text-black p-4 rounded font-mono text-[11px] space-y-2 shadow">
              <div className="text-center border-b pb-2">
                <h4 className="font-bold text-xs uppercase">SWIFTTRACK KENYA</h4>
                <p className="text-[10px]">{order.branch_name || 'Operating Branch'}</p>
                <p className="text-[9px] text-neutral-600">ETR KRA PIN: P051234567Z</p>
                <p className="text-[9px]">{order.order_number}</p>
              </div>

              <div className="space-y-1 border-b pb-2 text-[10px]">
                {(order.items || []).map((it) => (
                  <div key={it.id} className="flex justify-between">
                    <span className="truncate max-w-[150px]">{it.quantity}x {it.product_name}</span>
                    <span className="font-bold tabular-nums">{api.formatKES(it.total_price)}</span>
                  </div>
                ))}
              </div>

              <div className="space-y-0.5 text-[10px] border-b pb-2">
                <div className="flex justify-between">
                  <span>SUBTOTAL:</span>
                  <span className="tabular-nums">{api.formatKES(order.subtotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span>VAT (16%):</span>
                  <span className="tabular-nums">{api.formatKES(order.tax_amount)}</span>
                </div>
                {order.delivery_fee > 0 && (
                  <div className="flex justify-between">
                    <span>DELIVERY FEE:</span>
                    <span className="tabular-nums">{api.formatKES(order.delivery_fee)}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold pt-1 border-t border-dashed">
                  <span>TOTAL:</span>
                  <span className="tabular-nums">{api.formatKES(order.total_amount)}</span>
                </div>
              </div>

              <p className="text-center text-[9px] text-neutral-600">ASANTE KWA KUNUNUA NASI</p>
            </div>

            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => window.print()}
                className="flex-1 py-2 rounded bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold cursor-pointer"
              >
                PRINT RECEIPT
              </button>
              <button
                type="button"
                onClick={() => onClose()}
                className="px-4 py-2 rounded bg-[#161c28] hover:bg-[#202738] text-slate-300 cursor-pointer"
              >
                CLOSE
              </button>
            </div>
          </div>
        </div>
  );
}
