// client/src/components/inventory/InventoryReceivingModal.jsx
import React, { useState } from 'react';
import { X, Truck, Plus, Trash2, CheckCircle2, AlertTriangle } from 'lucide-react';
import { api } from '../../services/api.js';
import { sound } from '../../services/sound.js';

export function InventoryReceivingModal({ isOpen, onClose, warehouses = [], products = [], onSuccess }) {
  const [warehouseId, setWarehouseId] = useState(warehouses[0]?.id || '');
  const [supplierInvoiceNo, setSupplierInvoiceNo] = useState('');
  const [deliveryNoteNo, setDeliveryNoteNo] = useState('');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState([
    { product_id: products[0]?.product_id || products[0]?.id || '', quantity: 10, unit_cost: 0, condition: 'GOOD', batch_number: '' }
  ]);
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleAddItem = () => {
    setItems([...items, { product_id: products[0]?.product_id || products[0]?.id || '', quantity: 1, unit_cost: 0, condition: 'GOOD', batch_number: '' }]);
  };

  const handleRemoveItem = (index) => {
    if (items.length <= 1) return;
    setItems(items.filter((_, i) => i !== index));
  };

  const handleItemChange = (index, field, value) => {
    const updated = [...items];
    updated[index][field] = value;
    setItems(updated);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!warehouseId || !items.length) {
      api.toast('Warehouse and item line required', 'warning');
      return;
    }

    try {
      setLoading(true);
      await api.post('/api/v1/inventory/receiving', {
        warehouse_id: Number(warehouseId),
        supplier_invoice_no: supplierInvoiceNo,
        delivery_note_no: deliveryNoteNo,
        notes,
        items: items.map(it => ({
          product_id: Number(it.product_id),
          quantity: Number(it.quantity),
          unit_cost: Number(it.unit_cost) || 0,
          condition: it.condition,
          batch_number: it.batch_number || null
        }))
      });

      sound.playCheckout();
      api.toast('Stock received successfully (GRN logged)', 'success');
      onSuccess?.();
      onClose();
    } catch (err) {
      sound.playError();
      api.toast('Failed to receive stock: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="bg-[#12161f] border border-[#222834] rounded-lg shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col font-mono text-xs overflow-hidden">
        {/* Header */}
        <div className="p-3.5 border-b border-[#222834] bg-[#181d28] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
              <Truck className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white uppercase tracking-wider">Inbound Stock Receiving (GRN)</h2>
              <p className="text-[10px] text-slate-400">Receive supplier delivery and update inventory buckets</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1 rounded hover:bg-[#202736]">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 space-y-3 overflow-y-auto flex-1">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
            <div>
              <label className="block text-[10px] text-slate-400 uppercase mb-1">Target Warehouse *</label>
              <select
                value={warehouseId}
                onChange={(e) => setWarehouseId(e.target.value)}
                className="w-full bg-[#181d28] border border-[#222834] rounded px-2 py-1.5 text-xs text-white"
                required
              >
                {warehouses.map(w => (
                  <option key={w.id} value={w.id}>{w.branch_name ? `${w.branch_name} - ${w.name}` : w.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[10px] text-slate-400 uppercase mb-1">Invoice / Delivery #</label>
              <input
                type="text"
                value={supplierInvoiceNo}
                onChange={(e) => setSupplierInvoiceNo(e.target.value)}
                placeholder="INV-2026-..."
                className="w-full bg-[#181d28] border border-[#222834] rounded px-2 py-1.5 text-xs text-white"
              />
            </div>

            <div>
              <label className="block text-[10px] text-slate-400 uppercase mb-1">Waybill / DN Ref</label>
              <input
                type="text"
                value={deliveryNoteNo}
                onChange={(e) => setDeliveryNoteNo(e.target.value)}
                placeholder="DN-..."
                className="w-full bg-[#181d28] border border-[#222834] rounded px-2 py-1.5 text-xs text-white"
              />
            </div>
          </div>

          {/* Item Lines */}
          <div className="space-y-2 pt-2 border-t border-[#1e2430]">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-slate-300 uppercase tracking-wider">Received Items List</span>
              <button
                type="button"
                onClick={handleAddItem}
                className="px-2 py-1 rounded bg-[#181d28] hover:bg-[#202736] border border-[#222834] text-[10px] text-emerald-400 flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3 h-3" /> Add Item Line
              </button>
            </div>

            {items.map((it, idx) => (
              <div key={idx} className="p-2 rounded bg-[#0c0e12] border border-[#222834] grid grid-cols-12 gap-2 items-center">
                <div className="col-span-5">
                  <select
                    value={it.product_id}
                    onChange={(e) => handleItemChange(idx, 'product_id', e.target.value)}
                    className="w-full bg-[#181d28] border border-[#222834] rounded px-1.5 py-1 text-[11px] text-white"
                  >
                    {products.map(p => (
                      <option key={p.product_id || p.id} value={p.product_id || p.id}>
                        {p.sku} - {p.product_name || p.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="col-span-2">
                  <input
                    type="number"
                    min="1"
                    value={it.quantity}
                    onChange={(e) => handleItemChange(idx, 'quantity', e.target.value)}
                    placeholder="Qty"
                    className="w-full bg-[#181d28] border border-[#222834] rounded px-1.5 py-1 text-[11px] text-white text-right"
                    required
                  />
                </div>

                <div className="col-span-2">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={it.unit_cost}
                    onChange={(e) => handleItemChange(idx, 'unit_cost', e.target.value)}
                    placeholder="Cost (KES)"
                    className="w-full bg-[#181d28] border border-[#222834] rounded px-1.5 py-1 text-[11px] text-white text-right"
                  />
                </div>

                <div className="col-span-2">
                  <select
                    value={it.condition}
                    onChange={(e) => handleItemChange(idx, 'condition', e.target.value)}
                    className="w-full bg-[#181d28] border border-[#222834] rounded px-1.5 py-1 text-[10px] text-white font-bold"
                  >
                    <option value="GOOD">Good</option>
                    <option value="DAMAGED">Damaged</option>
                  </select>
                </div>

                <div className="col-span-1 text-right">
                  <button
                    type="button"
                    onClick={() => handleRemoveItem(idx)}
                    disabled={items.length <= 1}
                    className="text-slate-500 hover:text-rose-400 disabled:opacity-30 p-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div>
            <label className="block text-[10px] text-slate-400 uppercase mb-1">Receiving Notes / Memo</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Delivered by linehaul freight, seals verified intact..."
              className="w-full bg-[#181d28] border border-[#222834] rounded px-2 py-1.5 text-xs text-white"
            />
          </div>

          {/* Footer */}
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
              className="px-4 py-1.5 rounded bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>{loading ? 'Processing...' : 'Confirm Goods Receipt'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
