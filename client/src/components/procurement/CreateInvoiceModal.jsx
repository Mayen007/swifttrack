import React, { useState } from 'react';
import {
  Receipt,
  X
} from 'lucide-react';
import { api } from '../../services/api.js';

export function CreateInvoiceModal({ suppliers, orders, onClose, onSuccess }) {
  const [supplierId, setSupplierId] = useState(suppliers[0]?.id || '');
  const [poId, setPoId] = useState('');
  const [supplierInvoiceNo, setSupplierInvoiceNo] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate] = useState('');
  const [subtotal, setSubtotal] = useState('');
  const [taxAmount, setTaxAmount] = useState('');
  const [totalAmount, setTotalAmount] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handlePOSelect = (selectedPoId) => {
    setPoId(selectedPoId);
    const order = orders.find(o => o.id === Number(selectedPoId));
    if (order) {
      setSupplierId(order.supplier_id);
      setSubtotal(order.subtotal);
      setTaxAmount(order.tax_amount);
      setTotalAmount(order.total_amount);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!supplierId || !supplierInvoiceNo || !totalAmount) {
      setError('Supplier, Vendor Invoice #, and Total Amount are required');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      await api.post('/api/v1/procurement/invoices', {
        supplier_id: Number(supplierId),
        purchase_order_id: poId ? Number(poId) : null,
        supplier_invoice_no: supplierInvoiceNo,
        invoice_date: invoiceDate,
        due_date: dueDate || invoiceDate,
        subtotal: Number(subtotal) || Number(totalAmount) * 0.84,
        tax_amount: Number(taxAmount) || Number(totalAmount) * 0.16,
        total_amount: Number(totalAmount)
      });
      onSuccess();
    } catch (err) {
      setError(err.message || 'Failed to record invoice');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#12161f] border border-slate-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150">
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <h3 className="font-semibold text-white text-sm flex items-center gap-2">
            <Receipt className="w-4 h-4 text-amber-400" />
            Log Supplier Bill / Invoice
          </h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-800 text-slate-400">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs rounded-lg">{error}</div>}

          <div>
            <label className="block text-[11px] font-mono text-slate-400 mb-1">Match Against Purchase Order (Optional)</label>
            <select
              value={poId}
              onChange={(e) => handlePOSelect(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white"
            >
              <option value="">No PO (Direct Bill)</option>
              {orders.map(o => (
                <option key={o.id} value={o.id}>{o.po_number} — {o.supplier_name} (KES {Number(o.total_amount).toLocaleString()})</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-mono text-slate-400 mb-1">Supplier</label>
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
              <label className="block text-[11px] font-mono text-slate-400 mb-1">Supplier's Invoice # *</label>
              <input
                type="text"
                placeholder="e.g. SINV-88421"
                value={supplierInvoiceNo}
                onChange={(e) => setSupplierInvoiceNo(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white font-mono uppercase"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-mono text-slate-400 mb-1">Invoice Date</label>
              <input
                type="date"
                value={invoiceDate}
                onChange={(e) => setInvoiceDate(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white"
              />
            </div>
            <div>
              <label className="block text-[11px] font-mono text-slate-400 mb-1">Due Date</label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-mono text-slate-400 mb-1">Total Bill Amount (KES) *</label>
            <input
              type="number"
              step="0.01"
              placeholder="0.00"
              value={totalAmount}
              onChange={(e) => setTotalAmount(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white font-mono font-bold text-lg"
            />
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
              {submitting ? 'Saving...' : 'Record Invoice'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

