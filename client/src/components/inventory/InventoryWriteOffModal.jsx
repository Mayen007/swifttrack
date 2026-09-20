// client/src/components/inventory/InventoryWriteOffModal.jsx
import React, { useState, useEffect } from 'react';
import { X, Trash2, ShieldAlert, DollarSign } from 'lucide-react';
import { api } from '../../services/api.js';
import { sound } from '../../services/sound.js';

export function InventoryWriteOffModal({ isOpen, onClose, item, warehouses = [], onSuccess }) {
  const [quantity, setQuantity] = useState(1);
  const [fromState, setFromState] = useState('DAMAGED');
  const [reasonCategory, setReasonCategory] = useState('DAMAGED');
  const [disposalMethod, setDisposalMethod] = useState('SCRAPPED');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (item) {
      if ((item.quantity_damaged ?? 0) > 0) {
        setFromState('DAMAGED');
        setReasonCategory('DAMAGED');
      } else if ((item.quantity_expired ?? 0) > 0) {
        setFromState('EXPIRED');
        setReasonCategory('EXPIRED');
      } else {
        setFromState('AVAILABLE');
        setReasonCategory('THEFT_LOST');
      }
    }
  }, [item]);

  if (!isOpen || !item) return null;

  const maxPool =
    fromState === 'DAMAGED' ? (item.quantity_damaged ?? 0) :
    fromState === 'EXPIRED' ? (item.quantity_expired ?? 0) :
    (item.quantity_available ?? 0);

  const cost = item.cost_price || 0;
  const estimatedLoss = quantity * cost;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (quantity <= 0 || quantity > maxPool) {
      api.toast(`Quantity must be between 1 and ${maxPool}`, 'warning');
      return;
    }

    try {
      setLoading(true);
      await api.post('/api/v1/inventory/write-offs', {
        warehouse_id: item.warehouse_id,
        product_id: item.product_id,
        from_state: fromState,
        quantity: Number(quantity),
        reason_category: reasonCategory,
        disposal_method: disposalMethod,
        notes
      });

      sound.playSuccess();
      api.toast(`Write-off executed for ${quantity} units (${reasonCategory})`, 'success');
      onSuccess?.();
      onClose();
    } catch (err) {
      sound.playError();
      api.toast('Write-off failed: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="bg-[#12161f] border border-[#222834] rounded-lg shadow-2xl max-w-md w-full font-mono text-xs overflow-hidden">
        <div className="p-3.5 border-b border-[#222834] bg-[#181d28] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded bg-rose-500/10 border border-rose-500/30 text-rose-400">
              <Trash2 className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white uppercase tracking-wider">Formal Stock Write-Off</h2>
              <p className="text-[10px] text-slate-400">Certified destruction, loss or scrap deduction</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1 rounded hover:bg-[#202736]">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-3">
          <div className="p-2.5 rounded bg-[#0c0e12] border border-[#222834]">
            <div className="font-bold text-white text-sm">{item.product_name}</div>
            <div className="text-[10px] text-slate-400 flex items-center gap-2 mt-0.5">
              <span>SKU: {item.sku}</span>
              <span>•</span>
              <span>{item.warehouse_name}</span>
            </div>
            <div className="mt-2 flex gap-2 text-[10px]">
              <span className="px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-400">Damaged: {item.quantity_damaged ?? 0}</span>
              <span className="px-1.5 py-0.5 rounded bg-red-500/10 text-red-400">Expired: {item.quantity_expired ?? 0}</span>
              <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400">Available: {item.quantity_available ?? 0}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[10px] text-slate-400 uppercase mb-1">Deduct From State *</label>
              <select
                value={fromState}
                onChange={(e) => setFromState(e.target.value)}
                className="w-full bg-[#181d28] border border-[#222834] rounded px-2 py-1.5 text-xs text-white font-bold"
              >
                <option value="DAMAGED">Damaged Bucket ({item.quantity_damaged ?? 0})</option>
                <option value="EXPIRED">Expired Bucket ({item.quantity_expired ?? 0})</option>
                <option value="AVAILABLE">Available Stock ({item.quantity_available ?? 0})</option>
              </select>
            </div>

            <div>
              <label className="block text-[10px] text-slate-400 uppercase mb-1">Write-Off Quantity *</label>
              <input
                type="number"
                min="1"
                max={maxPool}
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="w-full bg-[#181d28] border border-[#222834] rounded px-2 py-1.5 text-xs text-white text-right font-bold"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[10px] text-slate-400 uppercase mb-1">Reason Category</label>
              <select
                value={reasonCategory}
                onChange={(e) => setReasonCategory(e.target.value)}
                className="w-full bg-[#181d28] border border-[#222834] rounded px-2 py-1.5 text-xs text-white"
              >
                <option value="DAMAGED">Physical Damage / Breakage</option>
                <option value="EXPIRED">Expired Shelf-Life</option>
                <option value="THEFT_LOST">Theft / Unaccounted Shrinkage</option>
                <option value="OBSOLETE">Obsolete / Discontinued</option>
                <option value="CONTAMINATED">Contaminated / Spoiled</option>
              </select>
            </div>

            <div>
              <label className="block text-[10px] text-slate-400 uppercase mb-1">Disposal Method</label>
              <select
                value={disposalMethod}
                onChange={(e) => setDisposalMethod(e.target.value)}
                className="w-full bg-[#181d28] border border-[#222834] rounded px-2 py-1.5 text-xs text-white"
              >
                <option value="SCRAPPED">Certified Scrap / Dump</option>
                <option value="DESTROYED">Incinerated / Destroyed</option>
                <option value="RTV_SUPPLIER">Return to Vendor (RTV)</option>
                <option value="DONATED">Donated / Salvaged</option>
              </select>
            </div>
          </div>

          {/* Loss Preview */}
          <div className="p-2 rounded bg-rose-500/5 border border-rose-500/20 flex items-center justify-between">
            <span className="text-slate-400">Estimated Financial Loss:</span>
            <span className="font-bold text-rose-400">KES {Number(estimatedLoss).toLocaleString('en-KE', { minimumFractionDigits: 2 })}</span>
          </div>

          <div>
            <label className="block text-[10px] text-slate-400 uppercase mb-1">Authorization Notes</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Incident log, inspector initials, certificate..."
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
              disabled={loading || maxPool <= 0}
              className="px-4 py-1.5 rounded bg-rose-600 hover:bg-rose-500 text-white font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>{loading ? 'Deducting...' : 'Authorize Write-Off'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
