import React, { useState } from 'react';
import {
  X,
  CreditCard
} from 'lucide-react';
import { api } from '../../services/api.js';

export function RecordPaymentModal({ invoice, onClose, onSuccess }) {
  const remaining = Number(invoice.total_amount) - Number(invoice.amount_paid);
  const [amount, setAmount] = useState(remaining);
  const [paymentMethod, setPaymentMethod] = useState('BANK');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!amount || !referenceNumber) {
      setError('Amount and Reference / Cheque number are required');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      await api.post(`/api/v1/procurement/invoices/${invoice.id}/pay`, {
        amount: Number(amount),
        payment_method: paymentMethod,
        reference_number: referenceNumber,
        payment_date: paymentDate,
        notes
      });
      onSuccess();
    } catch (err) {
      setError(err.message || 'Payment failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#12161f] border border-slate-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150">
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <h3 className="font-semibold text-white text-sm flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-emerald-400" />
            Disburse Supplier Payment
          </h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-800 text-slate-400">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs rounded-lg">{error}</div>}

          <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800 space-y-1 text-xs font-mono">
            <div className="text-slate-400">Bill: <span className="text-white font-bold">{invoice.supplier_invoice_no}</span></div>
            <div className="text-slate-400">Supplier: <span className="text-white font-bold">{invoice.supplier_name}</span></div>
            <div className="text-slate-400">Outstanding Balance: <span className="text-amber-400 font-bold">KES {remaining.toLocaleString()}</span></div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-mono text-slate-400 mb-1">Disbursement Amount (KES) *</label>
              <input
                type="number"
                step="0.01"
                max={remaining}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white font-mono font-bold"
              />
            </div>
            <div>
              <label className="block text-[11px] font-mono text-slate-400 mb-1">Payment Method</label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white"
              >
                <option value="BANK">Bank Transfer (EFT/RTGS)</option>
                <option value="MPESA">M-Pesa B2B / Paybill</option>
                <option value="CASH">Petty Cash</option>
                <option value="CARD">Corporate Card</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-mono text-slate-400 mb-1">Reference / Cheque / Transaction ID *</label>
            <input
              type="text"
              placeholder="e.g. EFT-994821 or QKD88124KL"
              value={referenceNumber}
              onChange={(e) => setReferenceNumber(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white font-mono uppercase"
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
              className="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white font-semibold text-xs transition-colors shadow-md shadow-emerald-500/20"
            >
              {submitting ? 'Processing...' : 'Disburse Payment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

