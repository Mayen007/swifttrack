// client/src/components/inventory/InventoryAdjustmentModal.jsx
import React, { useState } from 'react';
import { X, Sliders, CheckCircle2 } from 'lucide-react';
import { api } from '../../services/api.js';
import { sound } from '../../services/sound.js';

export function InventoryAdjustmentModal({ isOpen, onClose, item, onSuccess }) {
  const [adjustmentType, setAdjustmentType] = useState('ADD'); // 'ADD', 'DEDUCT'
  const [quantity, setQuantity] = useState(1);
  const [reason, setReason] = useState('CYCLE_COUNT_VARIANCE');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen || !item) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (quantity <= 0) {
      api.toast('Quantity must be greater than 0', 'warning');
      return;
    }

    try {
      setLoading(true);
      await api.post('/api/v1/inventory/adjust', {
        warehouse_id: item.warehouse_id,
        product_id: item.product_id,
        adjustment_type: adjustmentType,
        quantity: Number(quantity),
        reason: `${reason}: ${notes || 'Manual stock adjustment'}`
      });

      sound.playSuccess();
      api.toast(`Inventory adjusted (${adjustmentType} ${quantity} units)`, 'success');
      onSuccess?.();
      onClose();
    } catch (err) {
      sound.playError();
      api.toast('Adjustment failed: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="bg-[#12161f] border border-[#222834] rounded-lg shadow-2xl max-w-md w-full font-mono text-xs overflow-hidden">
        <div className="p-3.5 border-b border-[#222834] bg-[#181d28] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded bg-amber-500/10 border border-amber-500/30 text-amber-400">
              <Sliders className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white uppercase tracking-wider">Manual Stock Adjustment</h2>
              <p className="text-[10px] text-slate-400">Recount variance, found stock, or correction</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1 rounded hover:bg-[#202736]">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-3">
          <div className="p-2.5 rounded bg-[#0c0e12] border border-[#222834]">
            <div className="font-bold text-white">{item.product_name}</div>
            <div className="text-[10px] text-slate-400 flex items-center gap-2 mt-0.5">
              <span>SKU: {item.sku}</span>
              <span>•</span>
              <span>{item.warehouse_name}</span>
            </div>
            <div className="mt-1 text-[11px] font-bold text-emerald-400">
              Current Available: {item.quantity_available ?? 0} {item.unit}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[10px] text-slate-400 uppercase mb-1">Adjustment Action *</label>
              <select
                value={adjustmentType}
                onChange={(e) => setAdjustmentType(e.target.value)}
                className="w-full bg-[#181d28] border border-[#222834] rounded px-2 py-1.5 text-xs text-white font-bold"
              >
                <option value="ADD">+ Increase Stock (Add)</option>
                <option value="DEDUCT">- Decrease Stock (Deduct)</option>
              </select>
            </div>

            <div>
              <label className="block text-[10px] text-slate-400 uppercase mb-1">Quantity *</label>
              <input
                type="number"
                min="1"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="w-full bg-[#181d28] border border-[#222834] rounded px-2 py-1.5 text-xs text-white text-right font-bold"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-[10px] text-slate-400 uppercase mb-1">Standardized Reason Code</label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full bg-[#181d28] border border-[#222834] rounded px-2 py-1.5 text-xs text-white"
            >
              <option value="CYCLE_COUNT_VARIANCE">Cycle Count Recount Variance</option>
              <option value="FOUND_STOCK">Found Stock / Misplaced Pallet</option>
              <option value="DATA_ENTRY_CORRECTION">Data Entry / Typo Correction</option>
              <option value="DAMAGED_IN_FACILITY">Handling Damage in Facility</option>
              <option value="LOST_STOCK">Unaccounted Discrepancy</option>
            </select>
          </div>

          <div>
            <label className="block text-[10px] text-slate-400 uppercase mb-1">Audit Notes / Explanation</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Supervisor initials, recount date..."
              className="w-full bg-[#181d28] border border-[#222834] rounded px-2 py-1.5 text-xs text-white"
            />
          </div>

          <div className="pt-3 border-t border-[#222834] flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded border border-[#222834] bg-[#181d28] text-slate-300 hover:bg-[#202736]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-1.5 rounded bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>{loading ? 'Submitting...' : 'Apply Stock Adjustment'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
