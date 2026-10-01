import React, { useState } from 'react';
import {
  PackageCheck,
  Receipt,
  Check,
  X
} from 'lucide-react';
import { api } from '../../services/api.js';

export function ReceiveGoodsModal({ po, onClose, onSuccess }) {
  const [supplierInvoiceNo, setSupplierInvoiceNo] = useState('');
  const [deliveryNoteNo, setDeliveryNoteNo] = useState('');
  const [notes, setNotes] = useState('');
  const [receiptLines, setReceiptLines] = useState(
    (po.items || []).map(it => ({
      po_item_id: it.id,
      product_name: it.product_name,
      ordered_quantity: it.ordered_quantity,
      received_so_far: it.received_quantity,
      pending: it.ordered_quantity - it.received_quantity,
      quantity_receiving: Math.max(0, it.ordered_quantity - it.received_quantity),
      condition: 'GOOD',
      batch_number: '',
      expiry_date: ''
    }))
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleLineChange = (index, field, value) => {
    const updated = [...receiptLines];
    updated[index][field] = value;
    setReceiptLines(updated);
  };

  const handleReceive = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');

    const linesToSubmit = receiptLines
      .filter(l => Number(l.quantity_receiving) > 0)
      .map(l => ({
        po_item_id: l.po_item_id,
        quantity: Number(l.quantity_receiving),
        condition: l.condition,
        batch_number: l.batch_number || null,
        expiry_date: l.expiry_date || null
      }));

    if (linesToSubmit.length === 0) {
      setError('Please specify at least one item quantity to receive');
      setSubmitting(false);
      return;
    }

    try {
      await api.post(`/api/v1/procurement/orders/${po.id}/receive`, {
        supplier_invoice_no: supplierInvoiceNo,
        delivery_note_no: deliveryNoteNo,
        items: linesToSubmit,
        notes
      });
      onSuccess();
    } catch (err) {
      setError(err.message || 'Failed to process receiving');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#12161f] border border-slate-800 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150">
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-white text-sm flex items-center gap-2">
              <PackageCheck className="w-4 h-4 text-emerald-400" />
              Inbound Stock Receiving (GRN) — {po.po_number}
            </h3>
            <div className="text-xs text-slate-400 font-sans mt-0.5">
              Receiving goods from {po.supplier_name} into {po.warehouse_name}
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-800 text-slate-400">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleReceive} className="p-6 space-y-4">
          {error && <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs rounded-lg">{error}</div>}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-mono text-slate-400 mb-1">Supplier Invoice #</label>
              <input
                type="text"
                placeholder="e.g. INV-10029"
                value={supplierInvoiceNo}
                onChange={(e) => setSupplierInvoiceNo(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white font-mono"
              />
            </div>
            <div>
              <label className="block text-[11px] font-mono text-slate-400 mb-1">Delivery Note #</label>
              <input
                type="text"
                placeholder="e.g. DN-9912"
                value={deliveryNoteNo}
                onChange={(e) => setDeliveryNoteNo(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-mono text-slate-400 mb-2">Item Inspection & Receiving Quantities</label>
            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {receiptLines.map((line, idx) => (
                <div key={idx} className="p-3 bg-slate-900/60 rounded-xl border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between text-xs font-semibold text-white">
                    <span>{line.product_name}</span>
                    <span className="font-mono text-slate-400">
                      Pending: <span className="text-amber-400">{line.pending}</span> / {line.ordered_quantity}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="block text-[10px] font-mono text-slate-500">Qty Receiving</label>
                      <input
                        type="number"
                        min="0"
                        max={line.pending}
                        value={line.quantity_receiving}
                        onChange={(e) => handleLineChange(idx, 'quantity_receiving', e.target.value)}
                        className="w-full px-2 py-1.5 rounded bg-slate-900 border border-slate-700 text-xs text-white font-mono font-bold"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-mono text-slate-500">Condition</label>
                      <select
                        value={line.condition}
                        onChange={(e) => handleLineChange(idx, 'condition', e.target.value)}
                        className="w-full px-2 py-1.5 rounded bg-slate-900 border border-slate-700 text-xs text-white"
                      >
                        <option value="GOOD">Good (Available Stock)</option>
                        <option value="DAMAGED">Damaged on Arrival</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-mono text-slate-500">Batch Number</label>
                      <input
                        type="text"
                        placeholder="Optional"
                        value={line.batch_number}
                        onChange={(e) => handleLineChange(idx, 'batch_number', e.target.value)}
                        className="w-full px-2 py-1.5 rounded bg-slate-900 border border-slate-700 text-xs text-white font-mono"
                      />
                    </div>
                  </div>
                </div>
              ))}
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
              className="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white font-semibold text-xs transition-colors flex items-center gap-1.5 shadow-md shadow-emerald-500/20"
            >
              <Check className="w-4 h-4" />
              {submitting ? 'Crediting Stock...' : 'Confirm Receipt & Allocate Stock'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

