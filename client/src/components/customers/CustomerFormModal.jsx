// client/src/components/customers/CustomerFormModal.jsx
// SwiftTrack Kenya: Customer Profile Create & Edit Modal
import React, { useState, useEffect } from 'react';
import { api } from '../../services/api.js';
import { sound } from '../../services/sound.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { X, User, Phone, Mail, MapPin, Building2, FileText, CheckCircle2, Shield } from 'lucide-react';

export function CustomerFormModal({ isOpen, onClose, customerToEdit, onSaved }) {
  const { user, selectedBranch } = useAuth();
  const isEditing = Boolean(customerToEdit);

  const [formData, setFormData] = useState({
    full_name: '',
    phone: '',
    email: '',
    address: '',
    city: 'Nairobi',
    kra_pin: '',
    status: 'ACTIVE',
    branch_id: 1,
    initial_note: '',
    address_label: 'Main Office / Store'
  });

  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (user?.role === 'SUPER_ADMIN') {
      api.get('/api/branches')
        .then((res) => {
          if (Array.isArray(res)) setBranches(res);
        })
        .catch(() => {});
    }
  }, [user?.role]);

  useEffect(() => {
    if (customerToEdit) {
      setFormData({
        full_name: customerToEdit.full_name || '',
        phone: customerToEdit.phone || '',
        email: customerToEdit.email || '',
        address: customerToEdit.address || '',
        city: customerToEdit.city || 'Nairobi',
        kra_pin: customerToEdit.kra_pin || '',
        status: customerToEdit.status || 'ACTIVE',
        branch_id: customerToEdit.branch_id || (selectedBranch?.id || 1),
        initial_note: '',
        address_label: 'Main Office / Store'
      });
    } else {
      setFormData({
        full_name: '',
        phone: '',
        email: '',
        address: '',
        city: 'Nairobi',
        kra_pin: '',
        status: 'ACTIVE',
        branch_id: selectedBranch?.id || user?.branchId || 1,
        initial_note: '',
        address_label: 'Main Office / Store'
      });
    }
    setError(null);
  }, [customerToEdit, isOpen, selectedBranch, user]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!formData.full_name.trim()) {
      setError('Customer full name is required');
      return;
    }
    if (!formData.phone.trim()) {
      setError('Customer phone number is required');
      return;
    }

    try {
      setLoading(true);
      let result;
      if (isEditing) {
        result = await api.put(`/api/customers/${customerToEdit.id}`, {
          full_name: formData.full_name.trim(),
          phone: formData.phone.trim(),
          email: formData.email ? formData.email.trim() : null,
          address: formData.address ? formData.address.trim() : null,
          city: formData.city ? formData.city.trim() : 'Nairobi',
          kra_pin: formData.kra_pin ? formData.kra_pin.trim().toUpperCase() : null,
          branch_id: user?.role === 'SUPER_ADMIN' ? Number(formData.branch_id) : undefined
        });
      } else {
        result = await api.post('/api/customers', {
          full_name: formData.full_name.trim(),
          phone: formData.phone.trim(),
          email: formData.email ? formData.email.trim() : null,
          address: formData.address ? formData.address.trim() : null,
          city: formData.city ? formData.city.trim() : 'Nairobi',
          kra_pin: formData.kra_pin ? formData.kra_pin.trim().toUpperCase() : null,
          status: formData.status,
          branch_id: user?.role === 'SUPER_ADMIN' ? Number(formData.branch_id) : (selectedBranch?.id || user?.branchId || 1),
          initial_note: formData.initial_note ? formData.initial_note.trim() : null,
          address_label: formData.address_label || 'Primary Delivery Address'
        });
      }

      sound.playSuccess();
      if (onSaved) onSaved(result);
      onClose();
    } catch (err) {
      sound.playError();
      setError(err.message || 'An error occurred while saving customer profile');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-4 bg-gray-900/90 border-b border-gray-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
              <User className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">
                {isEditing ? `Edit Customer: ${customerToEdit.full_name}` : 'Register New Customer Profile'}
              </h3>
              <p className="text-xs text-gray-400">
                {isEditing ? 'Update primary profile and tax credentials' : 'Add a verified client to the national CRM directory'}
              </p>
            </div>
          </div>

          <button onClick={onClose} className="p-1 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mx-6 mt-4 p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-400 text-xs flex items-center gap-2">
            <span>{error}</span>
          </div>
        )}

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-gray-300 font-semibold mb-1">
                Full Name / Business Entity <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Apex Hardware Supplies or John Mwangi"
                value={formData.full_name}
                onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                className="w-full bg-gray-950 border border-gray-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-gray-300 font-semibold mb-1">
                Phone Number <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. +254 712 345 678"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full bg-gray-950 border border-gray-800 rounded-lg px-3 py-2 font-mono text-white focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-gray-300 font-semibold mb-1">Email Address</label>
              <input
                type="email"
                placeholder="orders@example.co.ke"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full bg-gray-950 border border-gray-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-gray-300 font-semibold mb-1">City / Region</label>
              <input
                type="text"
                placeholder="Nairobi"
                value={formData.city}
                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                className="w-full bg-gray-950 border border-gray-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-gray-300 font-semibold mb-1">KRA PIN (Kenya eTIMS)</label>
              <input
                type="text"
                placeholder="P051234567Z"
                value={formData.kra_pin}
                onChange={(e) => setFormData({ ...formData, kra_pin: e.target.value })}
                className="w-full bg-gray-950 border border-gray-800 rounded-lg px-3 py-2 font-mono uppercase text-amber-400 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-gray-300 font-semibold mb-1">Primary Physical / Delivery Address</label>
              <input
                type="text"
                placeholder="Street address, building name, room or godown number"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                className="w-full bg-gray-950 border border-gray-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
              />
            </div>

            {user?.role === 'SUPER_ADMIN' && branches.length > 0 && (
              <div className="sm:col-span-2">
                <label className="block text-gray-300 font-semibold mb-1">Assigned Branch Hub</label>
                <select
                  value={formData.branch_id}
                  onChange={(e) => setFormData({ ...formData, branch_id: e.target.value })}
                  className="w-full bg-gray-950 border border-gray-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                >
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} ({b.code}) — {b.city}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {!isEditing && (
              <div className="sm:col-span-2">
                <label className="block text-gray-300 font-semibold mb-1">Initial Interaction Note (Optional)</label>
                <textarea
                  rows={2}
                  placeholder="Preferences, special instructions, or how this customer was referred..."
                  value={formData.initial_note}
                  onChange={(e) => setFormData({ ...formData, initial_note: e.target.value })}
                  className="w-full bg-gray-950 border border-gray-800 rounded-lg p-3 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                />
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-300 font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold flex items-center gap-2 shadow-lg shadow-blue-500/20 transition-all disabled:opacity-50"
            >
              {loading ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  {isEditing ? 'Save Changes' : 'Create Profile'}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
