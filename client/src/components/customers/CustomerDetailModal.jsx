// client/src/components/customers/CustomerDetailModal.jsx
// SwiftTrack Kenya: Customer 360° Deep Dive Drawer & Relationship Management
import React, { useState, useEffect } from 'react';
import { api } from '../../services/api.js';
import { sound } from '../../services/sound.js';
import {
  X,
  User,
  Phone,
  Mail,
  MapPin,
  Building2,
  Calendar,
  FileText,
  ShoppingBag,
  CreditCard,
  RotateCcw,
  Plus,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ShieldCheck,
  Star,
  ExternalLink,
  Edit2,
  Tag
} from 'lucide-react';

export function CustomerDetailModal({ customerId, isOpen, onClose, onCustomerUpdated, onOpenEdit }) {
  const [customer, setCustomer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview'); // overview, addresses, notes, orders, financials
  const [statusChanging, setStatusChanging] = useState(false);

  // Address form state
  const [showAddAddress, setShowAddAddress] = useState(false);
  const [addressForm, setAddressForm] = useState({
    address_label: '',
    address_line: '',
    city: 'Nairobi',
    contact_name: '',
    contact_phone: '',
    is_default: false,
    delivery_notes: ''
  });
  const [addressSubmitting, setAddressSubmitting] = useState(false);

  // Note form state
  const [noteText, setNoteText] = useState('');
  const [noteType, setNoteType] = useState('GENERAL');
  const [noteSubmitting, setNoteSubmitting] = useState(false);

  // History states
  const [orders, setOrders] = useState([]);
  const [payments, setPayments] = useState([]);
  const [refunds, setRefunds] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const fetchCustomerDetails = async () => {
    if (!customerId) return;
    try {
      setLoading(true);
      const res = await api.get(`/api/customers/${customerId}`);
      setCustomer(res);
    } catch (err) {
      sound.playError();
      console.error('Failed to load customer details:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchTabHistory = async (tab) => {
    if (!customerId) return;
    setHistoryLoading(true);
    try {
      if (tab === 'orders') {
        const res = await api.get(`/api/customers/${customerId}/orders?limit=50`);
        setOrders(res.orders || []);
      } else if (tab === 'financials') {
        const [payRes, refRes] = await Promise.all([
          api.get(`/api/customers/${customerId}/payments?limit=50`),
          api.get(`/api/customers/${customerId}/refunds?limit=50`)
        ]);
        setPayments(payRes.payments || []);
        setRefunds(refRes.refunds || []);
      }
    } catch (err) {
      console.error('Failed to fetch history:', err);
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && customerId) {
      fetchCustomerDetails();
    }
  }, [isOpen, customerId]);

  useEffect(() => {
    if (isOpen && customerId && (activeTab === 'orders' || activeTab === 'financials')) {
      fetchTabHistory(activeTab);
    }
  }, [activeTab, isOpen, customerId]);

  if (!isOpen) return null;

  // Status transition handler
  const handleStatusChange = async (newStatus) => {
    if (!customer || customer.status === newStatus) return;
    let reason = '';
    if (newStatus === 'BLOCKED' || newStatus === 'SUSPENDED') {
      reason = window.prompt(`Please provide an operational reason for setting customer to ${newStatus}:`);
      if (reason === null) return; // User cancelled prompt
    }

    try {
      setStatusChanging(true);
      const updated = await api.patch(`/api/customers/${customer.id}/status`, {
        status: newStatus,
        reason: reason || 'Manual status change'
      });
      setCustomer((prev) => ({ ...prev, ...updated }));
      sound.playSuccess();
      if (onCustomerUpdated) onCustomerUpdated(updated);
    } catch (err) {
      sound.playError();
      alert(err.message || 'Failed to update customer status');
    } finally {
      setStatusChanging(false);
    }
  };

  // Add address handler
  const handleAddAddress = async (e) => {
    e.preventDefault();
    if (!addressForm.address_line.trim()) {
      alert('Address line is required');
      return;
    }

    try {
      setAddressSubmitting(true);
      await api.post(`/api/customers/${customer.id}/addresses`, addressForm);
      sound.playSuccess();
      setShowAddAddress(false);
      setAddressForm({
        address_label: '',
        address_line: '',
        city: 'Nairobi',
        contact_name: '',
        contact_phone: '',
        is_default: false,
        delivery_notes: ''
      });
      await fetchCustomerDetails();
    } catch (err) {
      sound.playError();
      alert(err.message || 'Failed to add delivery address');
    } finally {
      setAddressSubmitting(false);
    }
  };

  // Set default address
  const handleSetDefaultAddress = async (addressId) => {
    try {
      await api.post(`/api/customers/${customer.id}/addresses/${addressId}/default`, {});
      sound.playSuccess();
      await fetchCustomerDetails();
    } catch (err) {
      sound.playError();
      alert(err.message || 'Failed to set default address');
    }
  };

  // Delete address
  const handleDeleteAddress = async (addressId) => {
    if (!window.confirm('Delete this delivery address?')) return;
    try {
      await api.delete(`/api/customers/${customer.id}/addresses/${addressId}`);
      sound.playSuccess();
      await fetchCustomerDetails();
    } catch (err) {
      sound.playError();
      alert(err.message || 'Failed to delete address');
    }
  };

  // Add note handler
  const handleAddNote = async (e) => {
    e.preventDefault();
    if (!noteText.trim()) return;

    try {
      setNoteSubmitting(true);
      await api.post(`/api/customers/${customer.id}/notes`, {
        note_text: noteText.trim(),
        note_type: noteType
      });
      sound.playSuccess();
      setNoteText('');
      await fetchCustomerDetails();
    } catch (err) {
      sound.playError();
      alert(err.message || 'Failed to add note');
    } finally {
      setNoteSubmitting(false);
    }
  };

  // Delete note handler
  const handleDeleteNote = async (noteId) => {
    if (!window.confirm('Delete this note?')) return;
    try {
      await api.delete(`/api/customers/${customer.id}/notes/${noteId}`);
      sound.playSuccess();
      await fetchCustomerDetails();
    } catch (err) {
      sound.playError();
      alert(err.message || 'Failed to delete note');
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'ACTIVE':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
      case 'SUSPENDED':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/30';
      case 'BLOCKED':
        return 'bg-rose-500/10 text-rose-400 border-rose-500/30';
      case 'INACTIVE':
      default:
        return 'bg-gray-500/10 text-gray-400 border-gray-500/30';
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-black/70 backdrop-blur-sm flex justify-end animate-in fade-in duration-200">
      <div className="w-full max-w-4xl bg-gray-950 border-l border-gray-800 flex flex-col h-full shadow-2xl animate-in slide-in-from-right duration-300">
        {/* Drawer Header */}
        <div className="px-6 py-4 bg-gray-900/80 border-b border-gray-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 font-bold text-lg shadow-inner">
              {customer?.full_name ? customer.full_name.slice(0, 2).toUpperCase() : 'CU'}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-slate-100">{customer?.full_name || 'Customer Details'}</h2>
                <span className="font-mono text-xs px-2 py-0.5 rounded bg-gray-800 text-gray-300 border border-gray-700">
                  {customer?.customer_number}
                </span>
                <span className={`text-xs px-2.5 py-0.5 rounded-full font-semibold border ${getStatusBadge(customer?.status)}`}>
                  {customer?.status}
                </span>
              </div>
              <p className="text-xs text-gray-400 flex items-center gap-2 mt-0.5">
                <Building2 className="w-3.5 h-3.5 text-gray-500" />
                {customer?.branch_name || 'Hub'} ({customer?.branch_code || 'BR'})
                <span className="text-gray-600">•</span>
                <span>Created {customer?.created_at ? new Date(customer.created_at).toLocaleDateString() : '—'}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {customer && (
              <button
                onClick={() => {
                  onClose();
                  if (onOpenEdit) onOpenEdit(customer);
                }}
                className="px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-medium flex items-center gap-1.5 transition-colors"
              >
                <Edit2 className="w-3.5 h-3.5" />
                Edit Profile
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Loading Spinner */}
        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="w-10 h-10 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {/* Top KPI Metrics Banner */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 bg-gray-900/40 border-b border-gray-800/80 shrink-0">
              <div className="bg-gray-900/90 border border-gray-800 p-3 rounded-xl">
                <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Total Orders</span>
                <p className="text-lg font-bold text-white mt-0.5">{customer?.summary?.total_orders ?? 0}</p>
                <span className="text-[10px] text-emerald-400 font-medium">
                  {customer?.summary?.completed_orders ?? 0} Completed
                </span>
              </div>

              <div className="bg-gray-900/90 border border-gray-800 p-3 rounded-xl">
                <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Total Spent</span>
                <p className="text-lg font-bold text-amber-400 mt-0.5 font-mono">
                  KES {Number(customer?.summary?.total_spent || 0).toLocaleString()}
                </p>
                <span className="text-[10px] text-gray-400">Gross POS + Deliveries</span>
              </div>

              <div className="bg-gray-900/90 border border-gray-800 p-3 rounded-xl">
                <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Total Payments</span>
                <p className="text-lg font-bold text-emerald-400 mt-0.5 font-mono">
                  KES {Number(customer?.summary?.total_payments || 0).toLocaleString()}
                </p>
                <span className="text-[10px] text-gray-400">Cleared via Cash/M-Pesa</span>
              </div>

              <div className="bg-gray-900/90 border border-gray-800 p-3 rounded-xl">
                <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Refunds Settled</span>
                <p className="text-lg font-bold text-rose-400 mt-0.5 font-mono">
                  KES {Number(customer?.summary?.total_refunded || 0).toLocaleString()}
                </p>
                <span className="text-[10px] text-gray-400">Net: KES {Number(customer?.summary?.net_spent || 0).toLocaleString()}</span>
              </div>
            </div>

            {/* Navigation Tabs */}
            <div className="flex border-b border-gray-800 bg-gray-900/50 px-6 gap-1 shrink-0 overflow-x-auto">
              {[
                { id: 'overview', label: 'Overview & Profile', icon: User },
                { id: 'addresses', label: `Addresses (${customer?.addresses?.length || 0})`, icon: MapPin },
                { id: 'notes', label: `Notes (${customer?.notes?.length || 0})`, icon: FileText },
                { id: 'orders', label: 'Order History', icon: ShoppingBag },
                { id: 'financials', label: 'Payments & Refunds', icon: CreditCard }
              ].map((tab) => {
                const Icon = tab.icon;
                const active = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-2 py-3 px-3 text-xs font-semibold border-b-2 whitespace-nowrap transition-colors ${
                      active
                        ? 'border-blue-500 text-blue-400 bg-blue-500/5'
                        : 'border-transparent text-gray-400 hover:text-gray-200 hover:bg-gray-800/40'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {tab.label}
                  </button>
                );
              })}
            </div>

            {/* Tab Content Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* TAB 1: OVERVIEW */}
              {activeTab === 'overview' && (
                <div className="space-y-6 animate-in fade-in duration-150">
                  {/* Status Banner & Action */}
                  <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div>
                      <h4 className="text-xs font-bold text-gray-300 uppercase tracking-wider">Account Operational Status</h4>
                      <p className="text-xs text-gray-400 mt-0.5">
                        Controls whether this customer can place new delivery orders or checkout at POS terminals.
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <select
                        value={customer.status}
                        disabled={statusChanging || customer.id === 1}
                        onChange={(e) => handleStatusChange(e.target.value)}
                        className="bg-gray-950 border border-gray-700 text-xs font-medium text-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:border-blue-500"
                      >
                        <option value="ACTIVE">ACTIVE (Normal Checkout)</option>
                        <option value="INACTIVE">INACTIVE (Dormant)</option>
                        <option value="SUSPENDED">SUSPENDED (Pending Review)</option>
                        <option value="BLOCKED">BLOCKED (Transactions Forbidden)</option>
                      </select>
                    </div>
                  </div>

                  {/* Contact & Registration Information */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="bg-gray-900/70 border border-gray-800 rounded-xl p-4 space-y-3">
                      <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                        <Phone className="w-4 h-4 text-blue-400" />
                        Contact Credentials
                      </h4>

                      <div className="space-y-2 text-xs">
                        <div className="flex justify-between py-1 border-b border-gray-800/60">
                          <span className="text-gray-400">Phone Number:</span>
                          <span className="font-mono font-medium text-slate-200">{customer.phone}</span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-gray-800/60">
                          <span className="text-gray-400">Email Address:</span>
                          <span className="text-slate-200">{customer.email || '—'}</span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-gray-800/60">
                          <span className="text-gray-400">Kenya KRA PIN:</span>
                          <span className="font-mono font-semibold text-amber-400">{customer.kra_pin || 'Not Registered'}</span>
                        </div>
                        <div className="flex justify-between py-1">
                          <span className="text-gray-400">Operating City:</span>
                          <span className="text-slate-200">{customer.city || 'Nairobi'}</span>
                        </div>
                      </div>
                    </div>

                    <div className="bg-gray-900/70 border border-gray-800 rounded-xl p-4 space-y-3">
                      <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-emerald-400" />
                        Primary Registered Address
                      </h4>

                      <div className="space-y-2 text-xs">
                        <div className="py-1 border-b border-gray-800/60">
                          <span className="text-gray-400 block text-[11px]">Street / Physical Address:</span>
                          <span className="text-slate-200 font-medium">{customer.address || '—'}</span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-gray-800/60">
                          <span className="text-gray-400">Assigned Branch Hub:</span>
                          <span className="text-blue-400 font-medium">{customer.branch_name}</span>
                        </div>
                        <div className="flex justify-between py-1">
                          <span className="text-gray-400">Last Order Date:</span>
                          <span className="text-slate-300">
                            {customer.summary?.last_order_date
                              ? new Date(customer.summary.last_order_date).toLocaleString()
                              : 'No orders yet'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* General Account Notes */}
                  {customer.notes_text && (
                    <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-4">
                      <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Profile Description</h4>
                      <p className="text-xs text-gray-300 whitespace-pre-wrap">{customer.notes_text}</p>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 2: MULTIPLE DELIVERY ADDRESSES */}
              {activeTab === 'addresses' && (
                <div className="space-y-4 animate-in fade-in duration-150">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-slate-100">Saved Delivery Addresses</h3>
                      <p className="text-xs text-gray-400">Dispatch locations available for rapid courier fulfillment</p>
                    </div>
                    <button
                      onClick={() => setShowAddAddress(!showAddAddress)}
                      className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium flex items-center gap-1.5 transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                      Add Delivery Address
                    </button>
                  </div>

                  {/* Add Address Form Accordion */}
                  {showAddAddress && (
                    <form onSubmit={handleAddAddress} className="bg-gray-900 border border-blue-500/30 rounded-xl p-4 space-y-3">
                      <h4 className="text-xs font-bold text-blue-400 uppercase tracking-wider">New Delivery Destination</h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                        <div>
                          <label className="block text-gray-400 mb-1">Address Label (e.g. Headquarters, Warehouse C)</label>
                          <input
                            type="text"
                            placeholder="Site Label"
                            value={addressForm.address_label}
                            onChange={(e) => setAddressForm({ ...addressForm, address_label: e.target.value })}
                            className="w-full bg-gray-950 border border-gray-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                          />
                        </div>
                        <div>
                          <label className="block text-gray-400 mb-1">City / Region</label>
                          <input
                            type="text"
                            placeholder="Nairobi"
                            value={addressForm.city}
                            onChange={(e) => setAddressForm({ ...addressForm, city: e.target.value })}
                            className="w-full bg-gray-950 border border-gray-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                          />
                        </div>
                        <div className="sm:col-span-2">
                          <label className="block text-gray-400 mb-1">Address Line / Landmark *</label>
                          <input
                            type="text"
                            required
                            placeholder="Building name, street, room or godown number"
                            value={addressForm.address_line}
                            onChange={(e) => setAddressForm({ ...addressForm, address_line: e.target.value })}
                            className="w-full bg-gray-950 border border-gray-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                          />
                        </div>
                        <div>
                          <label className="block text-gray-400 mb-1">On-Site Contact Person</label>
                          <input
                            type="text"
                            placeholder="Receiving supervisor name"
                            value={addressForm.contact_name}
                            onChange={(e) => setAddressForm({ ...addressForm, contact_name: e.target.value })}
                            className="w-full bg-gray-950 border border-gray-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                          />
                        </div>
                        <div>
                          <label className="block text-gray-400 mb-1">Contact Phone</label>
                          <input
                            type="text"
                            placeholder="+254 700 000 000"
                            value={addressForm.contact_phone}
                            onChange={(e) => setAddressForm({ ...addressForm, contact_phone: e.target.value })}
                            className="w-full bg-gray-950 border border-gray-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                          />
                        </div>
                        <div className="sm:col-span-2">
                          <label className="block text-gray-400 mb-1">Delivery Instructions / Access Notes</label>
                          <input
                            type="text"
                            placeholder="Gate pass needed, use service elevator, call ahead"
                            value={addressForm.delivery_notes}
                            onChange={(e) => setAddressForm({ ...addressForm, delivery_notes: e.target.value })}
                            className="w-full bg-gray-950 border border-gray-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                          />
                        </div>
                        <div className="sm:col-span-2 flex items-center gap-2 pt-1">
                          <input
                            type="checkbox"
                            id="is_default_check"
                            checked={addressForm.is_default}
                            onChange={(e) => setAddressForm({ ...addressForm, is_default: e.target.checked })}
                            className="rounded bg-gray-950 border-gray-700 text-blue-600 focus:ring-0"
                          />
                          <label htmlFor="is_default_check" className="text-gray-300">Set as Primary Default Delivery Address</label>
                        </div>
                      </div>

                      <div className="flex justify-end gap-2 pt-2 border-t border-gray-800">
                        <button
                          type="button"
                          onClick={() => setShowAddAddress(false)}
                          className="px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-medium transition-colors"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={addressSubmitting}
                          className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition-colors disabled:opacity-50"
                        >
                          {addressSubmitting ? 'Saving...' : 'Save Address'}
                        </button>
                      </div>
                    </form>
                  )}

                  {/* Address List Cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {customer.addresses && customer.addresses.length > 0 ? (
                      customer.addresses.map((addr) => (
                        <div
                          key={addr.id}
                          className={`bg-gray-900/90 rounded-xl p-4 border transition-all ${
                            addr.is_default ? 'border-blue-500/50 shadow-md shadow-blue-500/5' : 'border-gray-800'
                          }`}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-xs text-white">{addr.address_label || 'Location'}</span>
                              {addr.is_default === 1 && (
                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 font-bold border border-blue-500/30 flex items-center gap-1">
                                  <Star className="w-2.5 h-2.5 fill-blue-400" />
                                  DEFAULT
                                </span>
                              )}
                            </div>

                            <button
                              onClick={() => handleDeleteAddress(addr.id)}
                              className="p-1 text-gray-500 hover:text-rose-400 transition-colors"
                              title="Delete Address"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          <p className="text-xs text-slate-200 mt-2 font-medium">{addr.address_line}</p>
                          <p className="text-xs text-gray-400">{addr.city}</p>

                          {(addr.contact_name || addr.contact_phone) && (
                            <div className="mt-3 pt-2 border-t border-gray-800/80 text-[11px] text-gray-400 space-y-0.5">
                              {addr.contact_name && <p>Contact: <span className="text-gray-200 font-medium">{addr.contact_name}</span></p>}
                              {addr.contact_phone && <p>Phone: <span className="font-mono text-gray-300">{addr.contact_phone}</span></p>}
                            </div>
                          )}

                          {addr.delivery_notes && (
                            <p className="mt-2 text-[11px] text-amber-300/80 bg-amber-500/5 border border-amber-500/20 rounded p-1.5 italic">
                              "{addr.delivery_notes}"
                            </p>
                          )}

                          {addr.is_default !== 1 && (
                            <div className="mt-3 pt-2 border-t border-gray-800 flex justify-end">
                              <button
                                onClick={() => handleSetDefaultAddress(addr.id)}
                                className="text-[11px] text-blue-400 hover:text-blue-300 font-medium transition-colors"
                              >
                                Set as Default
                              </button>
                            </div>
                          )}
                        </div>
                      ))
                    ) : (
                      <div className="sm:col-span-2 text-center py-8 bg-gray-900/40 rounded-xl border border-gray-800 text-gray-400 text-xs">
                        No delivery addresses registered yet. Click above to add one.
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 3: CUSTOMER NOTES */}
              {activeTab === 'notes' && (
                <div className="space-y-4 animate-in fade-in duration-150">
                  {/* Note Creation Composer */}
                  <form onSubmit={handleAddNote} className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold text-gray-300 uppercase tracking-wider">Log Customer Interaction</h4>
                      <select
                        value={noteType}
                        onChange={(e) => setNoteType(e.target.value)}
                        className="bg-gray-950 border border-gray-700 text-xs text-gray-300 rounded px-2.5 py-1 focus:outline-none focus:border-blue-500"
                      >
                        <option value="GENERAL">General Log</option>
                        <option value="PREFERENCE">Delivery Preference</option>
                        <option value="ISSUE">Reported Issue / Dispute</option>
                        <option value="CALL_LOG">Phone Call Record</option>
                        <option value="ACCOUNT">Account Note</option>
                      </select>
                    </div>

                    <textarea
                      required
                      rows={2}
                      placeholder="Type details of conversation, customer instruction, or special requirement..."
                      value={noteText}
                      onChange={(e) => setNoteText(e.target.value)}
                      className="w-full bg-gray-950 border border-gray-800 rounded-lg p-3 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                    />

                    <div className="flex justify-end">
                      <button
                        type="submit"
                        disabled={noteSubmitting || !noteText.trim()}
                        className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition-colors disabled:opacity-50 flex items-center gap-1.5"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        {noteSubmitting ? 'Posting...' : 'Post Note'}
                      </button>
                    </div>
                  </form>

                  {/* Notes Timeline Feed */}
                  <div className="space-y-3">
                    {customer.notes && customer.notes.length > 0 ? (
                      customer.notes.map((n) => (
                        <div key={n.id} className="bg-gray-900/70 border border-gray-800/90 rounded-xl p-4 space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] px-2 py-0.5 rounded font-bold uppercase tracking-wider bg-gray-800 text-blue-400 border border-gray-700">
                                {n.note_type}
                              </span>
                              <span className="text-xs text-gray-300 font-medium">{n.author_name || 'System'}</span>
                              {n.author_role && (
                                <span className="text-[10px] text-gray-500 font-mono">({n.author_role})</span>
                              )}
                            </div>

                            <div className="flex items-center gap-3">
                              <span className="text-[11px] text-gray-500 flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {new Date(n.created_at).toLocaleString()}
                              </span>
                              <button
                                onClick={() => handleDeleteNote(n.id)}
                                className="text-gray-500 hover:text-rose-400 transition-colors p-0.5"
                                title="Delete note"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>

                          <p className="text-xs text-slate-200 whitespace-pre-wrap leading-relaxed">{n.note_text}</p>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-8 bg-gray-900/40 rounded-xl border border-gray-800 text-gray-400 text-xs">
                        No activity notes logged for this customer.
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 4: ORDER HISTORY */}
              {activeTab === 'orders' && (
                <div className="space-y-4 animate-in fade-in duration-150">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-slate-100">Order & Fulfillment History</h3>
                      <p className="text-xs text-gray-400">All walk-in POS sales and delivery dispatches for this customer</p>
                    </div>
                  </div>

                  {historyLoading ? (
                    <div className="py-12 flex justify-center">
                      <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                    </div>
                  ) : orders.length > 0 ? (
                    <div className="border border-gray-800 rounded-xl overflow-hidden bg-gray-900/60">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-gray-900 text-gray-400 border-b border-gray-800">
                          <tr>
                            <th className="p-3">Order Number</th>
                            <th className="p-3">Date</th>
                            <th className="p-3">Type</th>
                            <th className="p-3">Items</th>
                            <th className="p-3">Total Amount</th>
                            <th className="p-3">Payment</th>
                            <th className="p-3">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-800/60">
                          {orders.map((ord) => (
                            <tr key={ord.id} className="hover:bg-gray-800/30">
                              <td className="p-3 font-mono font-medium text-blue-400">{ord.order_number}</td>
                              <td className="p-3 text-gray-400">{new Date(ord.created_at).toLocaleDateString()}</td>
                              <td className="p-3">
                                <span className={`text-[10px] px-2 py-0.5 rounded font-semibold ${
                                  ord.order_type === 'DELIVERY_ORDER' ? 'bg-purple-500/10 text-purple-400' : 'bg-blue-500/10 text-blue-400'
                                }`}>
                                  {ord.order_type}
                                </span>
                              </td>
                              <td className="p-3 text-slate-300">{ord.items_count} items</td>
                              <td className="p-3 font-mono font-semibold text-white">
                                KES {Number(ord.total_amount).toLocaleString()}
                              </td>
                              <td className="p-3">
                                <span className={`text-[10px] px-2 py-0.5 rounded font-semibold ${
                                  ord.payment_status === 'PAID' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'
                                }`}>
                                  {ord.payment_status}
                                </span>
                              </td>
                              <td className="p-3">
                                <span className="text-[10px] px-2 py-0.5 rounded bg-gray-800 text-gray-300 font-medium">
                                  {ord.status}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="text-center py-8 bg-gray-900/40 rounded-xl border border-gray-800 text-gray-400 text-xs">
                      No order transactions found for this customer.
                    </div>
                  )}
                </div>
              )}

              {/* TAB 5: FINANCIALS (PAYMENTS & REFUNDS) */}
              {activeTab === 'financials' && (
                <div className="space-y-6 animate-in fade-in duration-150">
                  {/* Payments Section */}
                  <div className="space-y-3">
                    <h4 className="text-xs font-bold text-gray-300 uppercase tracking-wider flex items-center gap-2">
                      <CreditCard className="w-4 h-4 text-emerald-400" />
                      Payments Received ({payments.length})
                    </h4>

                    {historyLoading ? (
                      <div className="py-8 flex justify-center">
                        <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                      </div>
                    ) : payments.length > 0 ? (
                      <div className="border border-gray-800 rounded-xl overflow-hidden bg-gray-900/60">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-gray-900 text-gray-400 border-b border-gray-800">
                            <tr>
                              <th className="p-3">Payment Ref</th>
                              <th className="p-3">Date</th>
                              <th className="p-3">Method</th>
                              <th className="p-3">Amount</th>
                              <th className="p-3">M-Pesa / Card Ref</th>
                              <th className="p-3">Cashier</th>
                              <th className="p-3">Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-800/60">
                            {payments.map((pay) => (
                              <tr key={pay.id} className="hover:bg-gray-800/30">
                                <td className="p-3 font-mono text-emerald-400 font-medium">{pay.payment_number}</td>
                                <td className="p-3 text-gray-400">{new Date(pay.created_at).toLocaleDateString()}</td>
                                <td className="p-3">
                                  <span className="font-semibold text-slate-200">{pay.payment_method}</span>
                                </td>
                                <td className="p-3 font-mono font-bold text-white">
                                  KES {Number(pay.amount).toLocaleString()}
                                </td>
                                <td className="p-3 font-mono text-gray-300">
                                  {pay.mpesa_receipt_number || pay.reference_code || '—'}
                                </td>
                                <td className="p-3 text-gray-400">{pay.cashier_name || '—'}</td>
                                <td className="p-3">
                                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 font-semibold border border-emerald-500/20">
                                    {pay.status}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="text-center py-6 bg-gray-900/40 rounded-xl border border-gray-800 text-gray-400 text-xs">
                        No payment records found.
                      </div>
                    )}
                  </div>

                  {/* Refunds Section */}
                  <div className="space-y-3">
                    <h4 className="text-xs font-bold text-gray-300 uppercase tracking-wider flex items-center gap-2">
                      <RotateCcw className="w-4 h-4 text-rose-400" />
                      Refund Requests & Returns ({refunds.length})
                    </h4>

                    {historyLoading ? (
                      <div className="py-8 flex justify-center">
                        <div className="w-6 h-6 border-2 border-rose-500 border-t-transparent rounded-full animate-spin" />
                      </div>
                    ) : refunds.length > 0 ? (
                      <div className="border border-gray-800 rounded-xl overflow-hidden bg-gray-900/60">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-gray-900 text-gray-400 border-b border-gray-800">
                            <tr>
                              <th className="p-3">Request #</th>
                              <th className="p-3">Date</th>
                              <th className="p-3">Sale #</th>
                              <th className="p-3">Amount</th>
                              <th className="p-3">Reason</th>
                              <th className="p-3">Status</th>
                              <th className="p-3">Approved By</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-800/60">
                            {refunds.map((ref) => (
                              <tr key={ref.id} className="hover:bg-gray-800/30">
                                <td className="p-3 font-mono text-rose-400 font-medium">{ref.refund_request_number}</td>
                                <td className="p-3 text-gray-400">{new Date(ref.created_at).toLocaleDateString()}</td>
                                <td className="p-3 font-mono text-gray-300">{ref.sale_number}</td>
                                <td className="p-3 font-mono font-bold text-rose-300">
                                  KES {Number(ref.amount).toLocaleString()}
                                </td>
                                <td className="p-3 text-gray-300 max-w-xs truncate" title={ref.reason}>
                                  {ref.reason}
                                </td>
                                <td className="p-3">
                                  <span className={`text-[10px] px-2 py-0.5 rounded font-semibold ${
                                    ref.status === 'APPROVED' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'
                                  }`}>
                                    {ref.status}
                                  </span>
                                </td>
                                <td className="p-3 text-gray-400">{ref.approved_by_name || 'Pending'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="text-center py-6 bg-gray-900/40 rounded-xl border border-gray-800 text-gray-400 text-xs">
                        No refund requests recorded for this customer.
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
