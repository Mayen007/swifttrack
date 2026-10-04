import React, { useState } from 'react';
import {
  Building2,
  X,
  Phone
} from 'lucide-react';
import { api } from '../../services/api.js';

export function CreateSupplierModal({ onClose, onSuccess }) {
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    contact_person: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    country: 'Kenya',
    lead_time_days: 3,
    payment_terms: 'NET30',
    tax_pin: '',
    bank_name: '',
    bank_account_no: '',
    mpesa_paybill: '',
    notes: ''
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.code || !formData.name || !formData.phone) {
      setError('Supplier Code, Name, and Phone are required');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      await api.post('/api/v1/suppliers', formData);
      onSuccess();
    } catch (err) {
      setError(err.message || 'Failed to create supplier');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#12161f] border border-slate-800 rounded-2xl w-full max-w-xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150">
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <h3 className="font-semibold text-white text-sm flex items-center gap-2">
            <Building2 className="w-4 h-4 text-amber-400" />
            Add Supplier to Directory
          </h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-800 text-slate-400">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-3">
          {error && <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs rounded-lg">{error}</div>}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-mono text-slate-400 mb-1">Supplier Code *</label>
              <input
                type="text"
                placeholder="e.g. BAMBURI-01"
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white uppercase font-mono"
              />
            </div>
            <div>
              <label className="block text-[11px] font-mono text-slate-400 mb-1">Company Name *</label>
              <input
                type="text"
                placeholder="e.g. Bamburi Cement PLC"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-mono text-slate-400 mb-1">KRA PIN</label>
              <input
                type="text"
                placeholder="e.g. P051234567Z"
                value={formData.tax_pin}
                onChange={(e) => setFormData({ ...formData, tax_pin: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white uppercase font-mono"
              />
            </div>
            <div>
              <label className="block text-[11px] font-mono text-slate-400 mb-1">Payment Terms</label>
              <select
                value={formData.payment_terms}
                onChange={(e) => setFormData({ ...formData, payment_terms: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white"
              >
                <option value="NET30">NET 30</option>
                <option value="NET15">NET 15</option>
                <option value="NET60">NET 60</option>
                <option value="COD">Cash On Delivery</option>
                <option value="ADVANCE">Advance</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-mono text-slate-400 mb-1">Contact Person</label>
              <input
                type="text"
                placeholder="Account Rep"
                value={formData.contact_person}
                onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white"
              />
            </div>
            <div>
              <label className="block text-[11px] font-mono text-slate-400 mb-1">Phone *</label>
              <input
                type="text"
                placeholder="+254..."
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white font-mono"
              />
            </div>
            <div>
              <label className="block text-[11px] font-mono text-slate-400 mb-1">Email</label>
              <input
                type="email"
                placeholder="sales@..."
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-mono text-slate-400 mb-1">Bank Name</label>
              <input
                type="text"
                placeholder="e.g. KCB Bank"
                value={formData.bank_name}
                onChange={(e) => setFormData({ ...formData, bank_name: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white"
              />
            </div>
            <div>
              <label className="block text-[11px] font-mono text-slate-400 mb-1">Bank Account / Paybill</label>
              <input
                type="text"
                placeholder="Account number"
                value={formData.bank_account_no}
                onChange={(e) => setFormData({ ...formData, bank_account_no: e.target.value })}
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
              className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-950 font-semibold text-xs transition-colors"
            >
              {submitting ? 'Saving...' : 'Add Supplier'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

