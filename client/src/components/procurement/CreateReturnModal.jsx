import React, { useState } from 'react';
import {
  RotateCcw,
  X
} from 'lucide-react';
import { api } from '../../services/api.js';

export function CreateReturnModal({ suppliers, productsList, warehousesList, onClose, onSuccess }) {
  const [supplierId, setSupplierId] = useState(suppliers[0]?.id || '');
  const [warehouseId, setWarehouseId] = useState(warehousesList[0]?.id || '');
  const [reason, setReason] = useState('DAMAGED_ON_ARRIVAL');
  const [productId, setProductId] = useState(productsList[0]?.id || '');
  const [quantity, setQuantity] = useState(1);
  const [unitCost, setUnitCost] = useState(productsList[0]?.cost_price || 0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      await api.post('/api/v1/procurement/returns', {
        supplier_id: Number(supplierId),
        warehouse_id: Number(warehouseId),
        reason,
        items: [
          {
            product_id: Number(productId),
            quantity: Number(quantity),
            unit_cost: Number(unitCost),
            from_inventory_state: reason === 'DAMAGED_ON_ARRIVAL' ? 'DAMAGED' : 'AVAILABLE'
          }
        ]
      });
      onSuccess();
    } catch (err) {
      setError(err.message || 'Failed to create return note');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#12161f] border border-slate-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150">
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <h3 className="font-semibold text-white text-sm flex items-center gap-2">
            <RotateCcw className="w-4 h-4 text-rose-400" />
            Raise Supplier Return (Debit Note)
          </h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-800 text-slate-400">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs rounded-lg">{error}</div>}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-mono text-slate-400 mb-1">Target Supplier</label>
              <select
                value={supplierId}
                onChange={(e) => setSupplierId(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white"
              >
                {suppliers.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-mono text-slate-400 mb-1">Warehouse</label>
              <select
                value={warehouseId}
                onChange={(e) => setWarehouseId(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white"
              >
                {warehousesList.map(w => (
                  <option key={w.id} value={w.id}>{w.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-mono text-slate-400 mb-1">Reason for Return</label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white"
            >
              <option value="DAMAGED_ON_ARRIVAL">Damaged On Arrival</option>
              <option value="DEFECTIVE">Defective / Quality Failure</option>
              <option value="OVER_DELIVERY">Excess Over-Delivery</option>
              <option value="WRONG_ITEM">Incorrect SKU Delivered</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-mono text-slate-400 mb-1">Product</label>
            <select
              value={productId}
              onChange={(e) => {
                setProductId(e.target.value);
                const p = productsList.find(x => x.id === Number(e.target.value));
                if (p) setUnitCost(p.cost_price || 0);
              }}
              className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white"
            >
              {productsList.map(p => (
                <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-mono text-slate-400 mb-1">Return Quantity</label>
              <input
                type="number"
                min="1"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white font-mono"
              />
            </div>
            <div>
              <label className="block text-[11px] font-mono text-slate-400 mb-1">Unit Cost (KES)</label>
              <input
                type="number"
                step="0.01"
                value={unitCost}
                onChange={(e) => setUnitCost(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white font-mono"
              />
            </div>
          </div>

          <div className="pt-3 border-t border-slate-800 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-slate-800 text-slate-300 text-xs font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 rounded-lg bg-rose-500 hover:bg-rose-600 text-white font-semibold text-xs transition-colors"
            >
              {submitting ? 'Generating...' : 'Issue Debit Note'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

