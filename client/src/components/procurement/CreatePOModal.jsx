import React, { useState } from 'react';
import {
  ShoppingBag,
  Plus,
  X
} from 'lucide-react';
import { api } from '../../services/api.js';

export function CreatePOModal({ onClose, onSuccess, suppliers, productsList, warehousesList, user }) {
  const [supplierId, setSupplierId] = useState(suppliers[0]?.id || '');
  const [warehouseId, setWarehouseId] = useState(warehousesList[0]?.id || '');
  const [paymentTerms, setPaymentTerms] = useState('NET30');
  const [expectedDate, setExpectedDate] = useState('');
  const [shippingFee, setShippingFee] = useState(0);
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState([
    { product_id: productsList[0]?.id || '', ordered_quantity: 50, unit_cost: productsList[0]?.cost_price || 0 }
  ]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleAddItem = () => {
    setItems([...items, { product_id: productsList[0]?.id || '', ordered_quantity: 50, unit_cost: productsList[0]?.cost_price || 0 }]);
  };

  const handleItemChange = (index, field, value) => {
    const updated = [...items];
    updated[index][field] = value;
    if (field === 'product_id') {
      const p = productsList.find(x => x.id === Number(value));
      if (p) updated[index].unit_cost = p.cost_price || 0;
    }
    setItems(updated);
  };

  const handleRemoveItem = (index) => {
    if (items.length <= 1) return;
    setItems(items.filter((_, i) => i !== index));
  };

  const subtotal = items.reduce((acc, it) => acc + (Number(it.ordered_quantity || 0) * Number(it.unit_cost || 0)), 0);
  const vat = subtotal * 0.16;
  const grandTotal = subtotal + vat + Number(shippingFee || 0);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!supplierId || !warehouseId) {
      setError('Supplier and Warehouse are required');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      await api.post('/api/v1/procurement/orders', {
        supplier_id: Number(supplierId),
        warehouse_id: Number(warehouseId),
        payment_terms: paymentTerms,
        expected_delivery_date: expectedDate || null,
        shipping_fee: Number(shippingFee) || 0,
        notes,
        items: items.map(it => ({
          product_id: Number(it.product_id),
          ordered_quantity: Number(it.ordered_quantity),
          unit_cost: Number(it.unit_cost),
          tax_rate: 16.0
        }))
      });
      onSuccess();
    } catch (err) {
      setError(err.message || 'Failed to create Purchase Order');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#12161f] border border-slate-800 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150">
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <h3 className="font-semibold text-white text-sm flex items-center gap-2">
            <ShoppingBag className="w-4 h-4 text-amber-400" />
            Issue Purchase Order (PO)
          </h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-800 text-slate-400">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs rounded-lg">{error}</div>}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-mono text-slate-400 mb-1">Target Supplier</label>
              <select
                value={supplierId}
                onChange={(e) => setSupplierId(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white"
              >
                {suppliers.map(s => (
                  <option key={s.id} value={s.id}>{s.name} ({s.code})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-mono text-slate-400 mb-1">Destination Warehouse</label>
              <select
                value={warehouseId}
                onChange={(e) => setWarehouseId(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white"
              >
                {warehousesList.map(w => (
                  <option key={w.id} value={w.id}>{w.name} ({w.code})</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-[11px] font-mono text-slate-400 mb-1">Payment Terms</label>
              <select
                value={paymentTerms}
                onChange={(e) => setPaymentTerms(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white"
              >
                <option value="NET30">NET 30 Days</option>
                <option value="NET15">NET 15 Days</option>
                <option value="NET60">NET 60 Days</option>
                <option value="COD">Cash on Delivery</option>
                <option value="ADVANCE">Advance 100%</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-mono text-slate-400 mb-1">Expected Delivery</label>
              <input
                type="date"
                value={expectedDate}
                onChange={(e) => setExpectedDate(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white"
              />
            </div>
            <div>
              <label className="block text-[11px] font-mono text-slate-400 mb-1">Shipping Fee (KES)</label>
              <input
                type="number"
                value={shippingFee}
                onChange={(e) => setShippingFee(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white font-mono"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-[11px] font-mono text-slate-400">Order Lines</label>
              <button
                type="button"
                onClick={handleAddItem}
                className="text-xs text-amber-400 hover:text-amber-300 font-medium flex items-center gap-1"
              >
                <Plus className="w-3 h-3" /> Add Item
              </button>
            </div>

            <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
              {items.map((it, idx) => (
                <div key={idx} className="flex items-center gap-2 bg-slate-900/60 p-2 rounded-lg border border-slate-800">
                  <select
                    value={it.product_id}
                    onChange={(e) => handleItemChange(idx, 'product_id', e.target.value)}
                    className="flex-1 px-2.5 py-1.5 rounded bg-slate-900 border border-slate-700 text-xs text-white"
                  >
                    {productsList.map(p => (
                      <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min="1"
                    value={it.ordered_quantity}
                    onChange={(e) => handleItemChange(idx, 'ordered_quantity', e.target.value)}
                    placeholder="Qty"
                    className="w-20 px-2 py-1.5 rounded bg-slate-900 border border-slate-700 text-xs text-white font-mono"
                  />
                  <input
                    type="number"
                    step="0.01"
                    value={it.unit_cost}
                    onChange={(e) => handleItemChange(idx, 'unit_cost', e.target.value)}
                    placeholder="Cost"
                    className="w-28 px-2 py-1.5 rounded bg-slate-900 border border-slate-700 text-xs text-white font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => handleRemoveItem(idx)}
                    className="p-1 text-slate-500 hover:text-rose-400"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Pricing summary */}
          <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800 text-xs font-mono space-y-1">
            <div className="flex justify-between text-slate-400">
              <span>Subtotal:</span>
              <span>KES {subtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>VAT (16% Standard):</span>
              <span>KES {vat.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="flex justify-between text-white font-bold pt-1 border-t border-slate-800">
              <span>Grand Total:</span>
              <span className="text-amber-400">KES {grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
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
              className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-950 font-semibold text-xs transition-colors"
            >
              {submitting ? 'Generating...' : 'Issue Purchase Order'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

