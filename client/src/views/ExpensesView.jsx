// client/src/views/ExpensesView.jsx
import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { api } from '../services/api.js';
import { sound } from '../services/sound.js';
import {
  Banknote,
  Plus,
  Fuel,
  Wrench,
  Package,
  Zap,
  FileText,
  X,
  CheckCircle2,
  RotateCcw,
  Search,
  Smartphone,
  CreditCard,
  Coffee,
  Clock,
  ShieldAlert,
  Eye,
  Printer,
  Building2,
  User,
  Tag,
  Check,
} from 'lucide-react';

export function ExpensesView() {
  const { user, selectedBranch } = useAuth();
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [selectedMethod, setSelectedMethod] = useState('ALL');
  const [selectedStatus, setSelectedStatus] = useState('ALL');

  // Record Expense Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [category, setCategory] = useState('Fuel');
  const [payee, setPayee] = useState('');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('CASH');

  // Voucher Inspector Modal
  const [inspectModalOpen, setInspectModalOpen] = useState(false);
  const [inspectExpense, setInspectExpense] = useState(null);

  const searchInputRef = useRef(null);

  const fetchExpenses = async () => {
    try {
      setLoading(true);
      const branchParam = selectedBranch ? `?branch_id=${selectedBranch.id}` : '';
      const data = await api.get(`/api/expenses${branchParam}`);
      setExpenses(Array.isArray(data) ? data : []);
      setLastSyncTime(new Date().toLocaleTimeString('en-KE', { hour12: false }));
    } catch (e) {
      console.error('Failed to load expenses:', e);
      api.toast('Failed to load operating expenses: ' + e.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExpenses();
  }, [selectedBranch]);

  // Keyboard shortcut listener
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'F2') {
        e.preventDefault();
        searchInputRef.current?.focus();
        sound.playScan();
      }
      if (e.key === 'Escape') {
        setModalOpen(false);
        setInspectModalOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Submit new expense voucher
  const handleCreateExpense = async () => {
    if (!amount || !description.trim() || !payee.trim()) {
      api.toast('Please provide merchant/payee, amount, and description', 'error');
      sound.playError();
      return;
    }

    try {
      const res = await api.post('/api/expenses', {
        branch_id: selectedBranch?.id || 1,
        category,
        payee: payee.trim(),
        amount: Number(amount),
        description: description.trim(),
        payment_method: paymentMethod,
      });

      sound.playSuccess();
      api.toast(res.message || 'Petty cash expense voucher recorded', 'success');
      setModalOpen(false);
      setAmount('');
      setPayee('');
      setDescription('');
      fetchExpenses();
    } catch (e) {
      sound.playError();
      api.toast(`Failed to record expense: ${e.message}`, 'error');
    }
  };

  // Approve pending expense
  const handleApproveExpense = async (expenseId) => {
    try {
      await api.post(`/api/expenses/${expenseId}/approve`, {});
      sound.playSuccess();
      api.toast('Expense voucher approved and cleared', 'success');
      fetchExpenses();
    } catch (e) {
      sound.playError();
      api.toast(`Approval failed: ${e.message}`, 'error');
    }
  };

  // Open Inspector
  const openInspectModal = (exp) => {
    setInspectExpense(exp);
    setInspectModalOpen(true);
    sound.playScan();
  };

  // Filtered expenses list
  const filteredExpenses = expenses.filter((e) => {
    if (selectedCategory !== 'ALL' && e.category !== selectedCategory) return false;
    if (selectedMethod !== 'ALL' && e.payment_method !== selectedMethod) return false;
    if (selectedStatus !== 'ALL' && e.status !== selectedStatus) return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchNum = e.expense_number?.toLowerCase().includes(q);
      const matchPayee = e.payee?.toLowerCase().includes(q);
      const matchDesc = e.description?.toLowerCase().includes(q);
      const matchCat = e.category?.toLowerCase().includes(q);
      const matchUser = e.created_by_name?.toLowerCase().includes(q);

      if (!matchNum && !matchPayee && !matchDesc && !matchCat && !matchUser) return false;
    }
    return true;
  });

  // Telemetry KPIs
  const totalSettled = expenses.filter((e) => e.status === 'APPROVED').reduce((sum, e) => sum + (e.amount || 0), 0);
  const fuelMaintenanceTotal = expenses
    .filter((e) => ['Fuel', 'Maintenance'].includes(e.category))
    .reduce((sum, e) => sum + (e.amount || 0), 0);
  const utilitiesTotal = expenses
    .filter((e) => ['Utilities', 'Packaging', 'Sundry'].includes(e.category))
    .reduce((sum, e) => sum + (e.amount || 0), 0);
  const pendingVouchers = expenses.filter((e) => e.status === 'PENDING_APPROVAL');
  const pendingValue = pendingVouchers.reduce((sum, e) => sum + (e.amount || 0), 0);

  // Category Icon Resolver
  const renderCategoryIcon = (cat) => {
    switch (cat) {
      case 'Fuel':
        return <Fuel className="w-3.5 h-3.5 text-amber-400" />;
      case 'Maintenance':
        return <Wrench className="w-3.5 h-3.5 text-blue-400" />;
      case 'Packaging':
        return <Package className="w-3.5 h-3.5 text-indigo-400" />;
      case 'Utilities':
        return <Zap className="w-3.5 h-3.5 text-yellow-400" />;
      default:
        return <Coffee className="w-3.5 h-3.5 text-emerald-400" />;
    }
  };

  return (
    <div className="space-y-4">
      {/* 1. TOP OPERATIONAL INSTRUMENT CONSOLE */}
      <div className="bg-[#12161f] border border-[#222834] rounded p-4 space-y-3.5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded bg-[#181d28] border border-[#222834] flex items-center justify-center text-emerald-400">
              <Banknote className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm font-bold text-slate-100 uppercase tracking-wider font-mono">
                  Branch Petty Cash & Operating Expenses
                </h1>
                <span className="px-2 py-0.5 rounded bg-[#181d28] border border-[#222834] text-[10px] font-mono text-slate-400">
                  OVERHEAD // DISBURSEMENTS
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5 font-mono">
                STATION: <span className="text-slate-200 font-semibold">{selectedBranch?.name || 'Central Hub'}</span>
                <span className="mx-2 text-[#222834]">|</span>
                FLOAT: <span className="text-emerald-400 font-bold">KSh 50,000.00 REPLENISHED</span>
                {lastSyncTime && <span className="ml-1 text-slate-500 font-mono">({lastSyncTime} EAT)</span>}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setModalOpen(true);
                sound.playScan();
              }}
              className="h-8 px-3.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-mono font-bold uppercase tracking-wider flex items-center gap-1.5 transition-colors cursor-pointer shadow-md shadow-emerald-950"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Record Expense Voucher</span>
            </button>

            <button
              onClick={() => {
                fetchExpenses();
                sound.playScan();
              }}
              disabled={loading}
              className="h-8 px-3 rounded bg-[#0c0e12] hover:bg-[#181d28] border border-[#222834] text-slate-300 hover:text-white text-xs font-mono font-medium flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
              title="Refresh expense vouchers"
            >
              <RotateCcw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-emerald-400' : 'text-slate-400'}`} />
              <span>SYNC</span>
            </button>
          </div>
        </div>

        {/* 2. UNIFIED HARDWARE TELEMETRY STRIP (Dieter Rams Matrix) */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-px bg-[#222834] border border-[#222834] rounded overflow-hidden">
          <div className="bg-[#0c0e12] p-2.5 flex items-center justify-between">
            <div>
              <span className="text-[10px] text-slate-500 font-mono uppercase tracking-wider block">Total Settled Overhead</span>
              <span className="text-lg font-mono font-bold text-rose-400 tabular-nums">
                {api.formatKES(totalSettled)}
              </span>
            </div>
            <Banknote className="w-4 h-4 text-rose-500" />
          </div>

          <div className="bg-[#0c0e12] p-2.5 flex items-center justify-between">
            <div>
              <span className="text-[10px] text-amber-400 font-mono uppercase tracking-wider block">Fuel & Fleet Maintenance</span>
              <span className="text-lg font-mono font-bold text-amber-400 tabular-nums">
                {api.formatKES(fuelMaintenanceTotal)}
              </span>
            </div>
            <Fuel className="w-4 h-4 text-amber-500" />
          </div>

          <div className="bg-[#0c0e12] p-2.5 flex items-center justify-between">
            <div>
              <span className="text-[10px] text-indigo-400 font-mono uppercase tracking-wider block">Utilities & Packaging</span>
              <span className="text-lg font-mono font-bold text-indigo-400 tabular-nums">
                {api.formatKES(utilitiesTotal)}
              </span>
            </div>
            <Zap className="w-4 h-4 text-indigo-500" />
          </div>

          <div className="bg-[#0c0e12] p-2.5 flex items-center justify-between">
            <div>
              <span className="text-[10px] text-slate-400 font-mono uppercase tracking-wider block">Active Vouchers</span>
              <span className="text-lg font-mono font-bold text-slate-100 tabular-nums">{expenses.length}</span>
            </div>
            <FileText className="w-4 h-4 text-slate-500" />
          </div>

          <div className="bg-[#0c0e12] p-2.5 flex items-center justify-between col-span-2 sm:col-span-1">
            <div>
              <span className="text-[10px] text-amber-400 font-mono uppercase tracking-wider block">Pending Approval</span>
              <span className="text-lg font-mono font-bold text-amber-300 tabular-nums">
                {pendingVouchers.length > 0 ? `${pendingVouchers.length} (${api.formatKES(pendingValue)})` : '0'}
              </span>
            </div>
            <Clock className={`w-4 h-4 ${pendingVouchers.length > 0 ? 'text-amber-400 animate-pulse' : 'text-slate-600'}`} />
          </div>
        </div>

        {/* 3. SWITCHBOARD CONTROLS & FILTER BAR */}
        <div className="pt-2 border-t border-[#222834] flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2.5">
          {/* Search Box */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search voucher #, merchant, description, staff... [F2]"
              className="w-full pl-8 pr-8 py-1.5 bg-[#0c0e12] border border-[#222834] focus:border-emerald-500/60 rounded text-xs text-slate-200 placeholder-slate-500 font-mono focus:outline-none transition-colors"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Segmented Filter Selectors */}
          <div className="flex items-center flex-wrap gap-2">
            {/* Category Filter */}
            <select
              value={selectedCategory}
              onChange={(e) => {
                setSelectedCategory(e.target.value);
                sound.playScan();
              }}
              className="px-2.5 py-1.5 bg-[#0c0e12] border border-[#222834] rounded text-[11px] font-mono text-slate-300 focus:outline-none focus:border-emerald-500 cursor-pointer"
            >
              <option value="ALL">ALL CATEGORIES</option>
              <option value="Fuel">FUEL</option>
              <option value="Maintenance">FLEET MAINTENANCE</option>
              <option value="Packaging">PACKAGING & BOXES</option>
              <option value="Utilities">UTILITIES & POWER</option>
              <option value="Sundry">SUNDRY & WELFARE</option>
            </select>

            {/* Payment Method Filter */}
            <select
              value={selectedMethod}
              onChange={(e) => {
                setSelectedMethod(e.target.value);
                sound.playScan();
              }}
              className="px-2.5 py-1.5 bg-[#0c0e12] border border-[#222834] rounded text-[11px] font-mono text-slate-300 focus:outline-none focus:border-emerald-500 cursor-pointer"
            >
              <option value="ALL">ALL TENDERS</option>
              <option value="CASH">PETTY CASH</option>
              <option value="MPESA">M-PESA PAYBILL</option>
              <option value="CARD">CORPORATE CARD</option>
            </select>

            {/* Status Filter */}
            <select
              value={selectedStatus}
              onChange={(e) => {
                setSelectedStatus(e.target.value);
                sound.playScan();
              }}
              className="px-2.5 py-1.5 bg-[#0c0e12] border border-[#222834] rounded text-[11px] font-mono text-slate-300 focus:outline-none focus:border-emerald-500 cursor-pointer"
            >
              <option value="ALL">ALL STATUSES</option>
              <option value="APPROVED">APPROVED / CLEARED</option>
              <option value="PENDING_APPROVAL">PENDING APPROVAL</option>
            </select>

            {(searchQuery || selectedCategory !== 'ALL' || selectedMethod !== 'ALL' || selectedStatus !== 'ALL') && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setSelectedCategory('ALL');
                  setSelectedMethod('ALL');
                  setSelectedStatus('ALL');
                  sound.playScan();
                }}
                className="px-2 py-1.5 rounded bg-[#181d28] hover:bg-rose-500/20 border border-[#222834] hover:border-rose-500/40 text-slate-400 hover:text-rose-300 text-[10px] font-mono cursor-pointer transition-colors"
              >
                RESET
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 4. EXPENSES MATRIX TABLE */}
      <div className="bg-[#12161f] border border-[#222834] rounded overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono border-collapse">
            <thead>
              <tr className="border-b border-[#222834] text-[10px] text-slate-400 uppercase tracking-wider bg-[#0c0e12]">
                <th className="p-3">Voucher #</th>
                <th className="p-3">Timestamp</th>
                <th className="p-3">Category</th>
                <th className="p-3">Merchant / Payee & Description</th>
                <th className="p-3">Method</th>
                <th className="p-3">Submitted By</th>
                <th className="p-3 text-right">Amount (KES)</th>
                <th className="p-3 text-center">Status</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#222834]">
              {filteredExpenses.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-12 text-center text-slate-500 font-mono">
                    <Banknote className="w-8 h-8 mx-auto mb-2 text-slate-600" />
                    <span>No expense vouchers found matching the filter parameters.</span>
                  </td>
                </tr>
              ) : (
                filteredExpenses.map((exp) => {
                  const isApproved = exp.status === 'APPROVED';
                  const isPending = exp.status === 'PENDING_APPROVAL';

                  return (
                    <tr key={exp.id} className="hover:bg-[#181d28]/40 transition-colors">
                      {/* Voucher # */}
                      <td className="p-3 font-bold text-emerald-400">
                        {exp.expense_number || `#EXP-${exp.id}`}
                      </td>

                      {/* Timestamp */}
                      <td className="p-3 text-slate-400 text-[10px] tabular-nums">
                        {new Date(exp.created_at).toLocaleString('en-KE')}
                      </td>

                      {/* Category */}
                      <td className="p-3">
                        <div className="flex items-center gap-1.5">
                          {renderCategoryIcon(exp.category)}
                          <span className="font-semibold text-slate-200">{exp.category}</span>
                        </div>
                      </td>

                      {/* Payee & Description */}
                      <td className="p-3 max-w-sm">
                        <div className="font-bold text-slate-100">{exp.payee || 'Direct Expense'}</div>
                        <div className="text-[11px] text-slate-400 truncate" title={exp.description}>
                          {exp.description}
                        </div>
                      </td>

                      {/* Method */}
                      <td className="p-3">
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase bg-[#0c0e12] border border-[#222834] text-slate-300">
                          {exp.payment_method || 'CASH'}
                        </span>
                      </td>

                      {/* Submitted By */}
                      <td className="p-3 text-slate-300 text-[11px]">
                        <span>{exp.created_by_name || 'Staff'}</span>
                        <span className="text-[10px] text-slate-500 block">{exp.branch_name || 'Main Hub'}</span>
                      </td>

                      {/* Amount */}
                      <td className="p-3 text-right font-bold font-mono text-rose-400 tabular-nums text-sm">
                        -{api.formatKES(exp.amount)}
                      </td>

                      {/* Status */}
                      <td className="p-3 text-center">
                        <span
                          className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase flex items-center justify-center gap-1 ${
                            isApproved
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                              : 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                          }`}
                        >
                          <span className={`w-1 h-1 rounded-full ${isApproved ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse'}`} />
                          {exp.status || 'APPROVED'}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => openInspectModal(exp)}
                            className="p-1.5 rounded bg-[#0c0e12] hover:bg-[#181d28] text-slate-400 hover:text-white border border-[#222834] transition-colors cursor-pointer"
                            title="Inspect Voucher"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>

                          {isPending && (user?.role === 'BRANCH_MANAGER' || user?.role === 'SUPER_ADMIN') && (
                            <button
                              onClick={() => handleApproveExpense(exp.id)}
                              className="px-2 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[10px] uppercase tracking-wider transition-colors cursor-pointer"
                              title="Authorize Expense"
                            >
                              Approve
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 5. RECORD EXPENSE MODAL */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-xs p-4">
          <div className="bg-[#12161f] border border-[#222834] rounded p-6 max-w-md w-full shadow-2xl relative space-y-4 animate-in fade-in zoom-in-95">
            <button
              onClick={() => setModalOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-1"
            >
              <X className="w-5 h-5" />
            </button>

            <div>
              <span className="text-[10px] font-mono text-emerald-400 uppercase tracking-wider font-bold">
                PETTY CASH // NEW DISBURSEMENT VOUCHER
              </span>
              <h3 className="text-base font-bold text-slate-100 font-mono mt-0.5 flex items-center gap-2">
                <Banknote className="w-4 h-4 text-emerald-400" />
                Record Operational Expense
              </h3>
            </div>

            <div className="space-y-3.5 text-xs font-mono">
              {/* Category */}
              <div>
                <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                  Expense Category *
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-3 py-2 rounded bg-[#0c0e12] border border-[#222834] text-slate-200 font-mono focus:outline-none focus:border-emerald-500 cursor-pointer"
                >
                  <option value="Fuel">Fuel (TotalEnergies / Shell / Rubis)</option>
                  <option value="Maintenance">Vehicle & Fleet Maintenance</option>
                  <option value="Packaging">Packaging Materials, Tape & Boxes</option>
                  <option value="Utilities">Utilities, Power & High-Speed Fiber</option>
                  <option value="Sundry">Staff Welfare & Station Sundries</option>
                </select>
              </div>

              {/* Merchant / Payee */}
              <div>
                <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                  Merchant / Payee Name *
                </label>
                <input
                  type="text"
                  value={payee}
                  onChange={(e) => setPayee(e.target.value)}
                  placeholder="e.g. TotalEnergies Westlands, KPLC, Crown Packaging"
                  className="w-full px-3 py-2 rounded bg-[#0c0e12] border border-[#222834] text-slate-100 font-mono focus:outline-none focus:border-emerald-500"
                />
              </div>

              {/* Amount with Fast Increment Pills */}
              <div>
                <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                  Disbursement Amount (KES) *
                </label>
                <input
                  type="number"
                  min="1"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="e.g. 3500"
                  className="w-full px-3 py-2 rounded bg-[#0c0e12] border border-[#222834] text-slate-100 font-mono font-bold text-sm focus:outline-none focus:border-emerald-500"
                />
                <div className="flex gap-1.5 mt-1.5">
                  {[500, 1500, 3500, 8000].map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => setAmount(String(amt))}
                      className="px-2 py-1 rounded bg-[#181d28] hover:bg-[#222834] border border-[#222834] text-slate-300 text-[10px] font-mono cursor-pointer"
                    >
                      KSh {amt}
                    </button>
                  ))}
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                  Justification / Fleet Registration *
                </label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="e.g. Fuel replenishment for delivery van KDA 482B"
                  className="w-full px-3 py-2 rounded bg-[#0c0e12] border border-[#222834] text-slate-100 font-mono focus:outline-none focus:border-emerald-500"
                />
              </div>

              {/* Payment Method */}
              <div>
                <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                  Disbursement Tender
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'CASH', label: 'Petty Cash' },
                    { id: 'MPESA', label: 'M-Pesa Till' },
                    { id: 'CARD', label: 'Card' },
                  ].map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setPaymentMethod(m.id)}
                      className={`py-1.5 rounded font-bold text-[10px] font-mono border transition-colors cursor-pointer ${
                        paymentMethod === m.id
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                          : 'bg-[#0c0e12] text-slate-400 border-[#222834]'
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Manager Threshold Notice */}
              {Number(amount) > 10000 && (
                <div className="p-2.5 rounded bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[10px] font-mono flex items-start gap-1.5">
                  <ShieldAlert className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                  <span>
                    Amounts exceeding KSh 10,000 require manager approval before fund release.
                  </span>
                </div>
              )}

              {/* Action Buttons */}
              <div className="pt-2 flex gap-2.5">
                <button
                  onClick={handleCreateExpense}
                  className="flex-1 py-2.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-bold font-mono text-xs uppercase tracking-wider shadow-lg shadow-emerald-950/40 transition-colors cursor-pointer"
                >
                  Save & Commit Voucher
                </button>
                <button
                  onClick={() => setModalOpen(false)}
                  className="py-2.5 px-4 rounded bg-[#181d28] hover:bg-slate-700 text-slate-300 font-semibold font-mono text-xs cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 6. VOUCHER INSPECTOR MODAL */}
      {inspectModalOpen && inspectExpense && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-xs p-4">
          <div className="bg-[#12161f] border border-[#222834] rounded p-6 max-w-sm w-full shadow-2xl relative space-y-4 animate-in fade-in zoom-in-95">
            <button
              onClick={() => setInspectModalOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-1"
            >
              <X className="w-5 h-5" />
            </button>

            <div>
              <span className="text-[10px] font-mono text-emerald-400 uppercase tracking-wider font-bold">
                AUDIT SLIP // PETTY CASH VOUCHER
              </span>
              <h3 className="text-base font-bold text-slate-100 font-mono mt-0.5">
                {inspectExpense.expense_number}
              </h3>
            </div>

            <div className="bg-[#0c0e12] border border-[#222834] rounded p-3 text-xs font-mono space-y-2">
              <div className="flex justify-between border-b border-[#222834] pb-1.5">
                <span className="text-slate-500">Category:</span>
                <span className="text-slate-200 font-bold">{inspectExpense.category}</span>
              </div>
              <div className="flex justify-between border-b border-[#222834] pb-1.5">
                <span className="text-slate-500">Merchant / Payee:</span>
                <span className="text-slate-200 font-semibold">{inspectExpense.payee || 'Direct Vendor'}</span>
              </div>
              <div className="flex justify-between border-b border-[#222834] pb-1.5">
                <span className="text-slate-500">Disbursed Amount:</span>
                <span className="text-rose-400 font-bold tabular-nums">
                  {api.formatKES(inspectExpense.amount)}
                </span>
              </div>
              <div className="flex justify-between border-b border-[#222834] pb-1.5">
                <span className="text-slate-500">Tender Method:</span>
                <span className="text-slate-200">{inspectExpense.payment_method}</span>
              </div>
              <div className="flex justify-between border-b border-[#222834] pb-1.5">
                <span className="text-slate-500">Submitted By:</span>
                <span className="text-slate-200">{inspectExpense.created_by_name || 'Staff'}</span>
              </div>
              <div className="flex justify-between border-b border-[#222834] pb-1.5">
                <span className="text-slate-500">Audit Status:</span>
                <span className="font-bold text-emerald-400">{inspectExpense.status}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px]">Justification:</span>
                <span className="text-slate-200 italic mt-0.5 block">{inspectExpense.description}</span>
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <button
                onClick={() => {
                  sound.playSuccess();
                  window.print();
                }}
                className="flex-1 py-2 rounded bg-blue-600 hover:bg-blue-500 text-white font-bold font-mono text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print Voucher</span>
              </button>
              <button
                onClick={() => setInspectModalOpen(false)}
                className="py-2 px-4 rounded bg-[#181d28] hover:bg-slate-700 text-slate-300 font-semibold font-mono text-xs cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
