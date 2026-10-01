import React from 'react';
import { Printer, X } from 'lucide-react';
import { api } from '../../services/api.js';

export function PosReceiptModal({
  isOpen,
  onClose,
  receiptData,
}) {
  if (!isOpen || !receiptData) return null;

  return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 select-none">
          <div className="bg-[#12161f] border border-[#222834] rounded p-5 max-w-sm w-full shadow-2xl relative animate-in fade-in duration-150">
            <button
              onClick={() => onClose()}
              aria-label="Close receipt"
              className="absolute top-3.5 right-3.5 text-slate-400 hover:text-white p-1 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div id="thermal-receipt-container" className="bg-white text-black p-4 rounded font-mono text-xs shadow-inner space-y-2.5">
              <div className="text-center border-b border-black pb-2">
                <h2 className="font-bold text-xs uppercase tracking-widest">SWIFTTRACK KENYA</h2>
                <p className="text-[10px]">{receiptData.branchName}</p>
                <p className="text-[9px] text-neutral-600">KRA PIN: P051234567Z • ETR VAT COMPLIANT</p>
                <p className="text-[9px] text-neutral-600">{receiptData.date}</p>
                <p className="text-[10px] font-bold mt-1">REC: {receiptData.orderNumber}</p>
              </div>

              <div className="space-y-1 border-b border-black pb-2 text-[10px]">
                {receiptData.items.map((it) => (
                  <div key={it.product.id} className="flex justify-between">
                    <span className="truncate max-w-[150px]">
                      {it.quantity}x {it.product.name}
                    </span>
                    <span className="tabular-nums font-bold">
                      {api.formatKES((it.product.price ?? it.product.selling_price ?? 0) * it.quantity)}
                    </span>
                  </div>
                ))}
              </div>

              <div className="space-y-0.5 text-[10px] border-b border-black pb-2">
                <div className="flex justify-between">
                  <span>SUBTOTAL:</span>
                  <span className="tabular-nums">{api.formatKES(receiptData.subtotal)}</span>
                </div>
                {receiptData.discount > 0 && (
                  <div className="flex justify-between text-neutral-800">
                    <span>DISCOUNT:</span>
                    <span className="tabular-nums">-{api.formatKES(receiptData.discount)}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span>VAT (16%):</span>
                  <span className="tabular-nums">{api.formatKES(receiptData.vat)}</span>
                </div>
                <div className="flex justify-between font-bold text-xs pt-1 border-t border-dashed border-black">
                  <span>TOTAL DUE:</span>
                  <span className="tabular-nums">{api.formatKES(receiptData.total)}</span>
                </div>
                {receiptData.change > 0 && (
                  <div className="flex justify-between text-neutral-700">
                    <span>CASH CHANGE:</span>
                    <span className="tabular-nums font-bold">{api.formatKES(receiptData.change)}</span>
                  </div>
                )}
              </div>

              <div className="text-[9px] text-center text-neutral-600 pt-0.5">
                <p>TENDER: {receiptData.paymentMethod} ({receiptData.paymentRef})</p>
                <p className="mt-0.5 font-bold">ASANTE KWA KUNUNUA NASI</p>
              </div>
            </div>

            <div className="mt-4 flex gap-2">
              <button
                onClick={() => window.print()}
                className="flex-1 py-2 rounded bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-mono font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>PRINT RECEIPT</span>
              </button>
              <button
                onClick={() => onClose()}
                className="py-2 px-3 rounded bg-[#161c28] hover:bg-[#202738] border border-[#222834] text-slate-300 text-xs font-mono transition-colors cursor-pointer"
              >
                CLOSE
              </button>
            </div>
          </div>
        </div>
  );
}
