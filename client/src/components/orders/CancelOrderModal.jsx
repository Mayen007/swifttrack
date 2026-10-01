import React from 'react';
import { AlertTriangle } from 'lucide-react';

export function CancelOrderModal({
  isOpen,
  onClose,
  order,
  cancelReason,
  setCancelReason,
  cancelling,
  onConfirmCancel,
}) {
  if (!isOpen || !order) return null;

  return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 select-none">
          <div className="bg-[#12161f] border border-[#222834] rounded-lg p-5 max-w-sm w-full shadow-2xl relative animate-in fade-in duration-150 text-xs font-mono">
            <h3 className="text-sm font-bold text-white uppercase flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-400" />
              <span>CANCEL ORDER #{order.order_number}</span>
            </h3>
            <p className="text-[11px] text-slate-400 mt-2">
              Cancelling will release any reserved inventory back into available stock.
            </p>

            <div className="mt-4 space-y-2">
              <label className="text-[10px] uppercase text-slate-400 block font-bold">Cancellation Reason</label>
              <textarea
                rows="3"
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Reason for cancellation..."
                className="w-full p-2.5 rounded bg-[#0c0e12] border border-[#222834] text-white focus:outline-none focus:border-rose-400 text-xs font-sans"
              />
            </div>

            <div className="mt-4 flex gap-2">
              <button
                type="button"
                disabled={cancelling}
                onClick={onConfirmCancel}
                className="flex-1 py-2 rounded bg-rose-600 hover:bg-rose-500 text-white font-bold cursor-pointer disabled:opacity-50"
              >
                {cancelling ? 'CANCELLING...' : 'CONFIRM CANCEL'}
              </button>
              <button
                type="button"
                onClick={() => onClose()}
                className="px-4 py-2 rounded bg-[#161c28] hover:bg-[#202738] text-slate-300 cursor-pointer"
              >
                BACK
              </button>
            </div>
          </div>
        </div>
  );
}
