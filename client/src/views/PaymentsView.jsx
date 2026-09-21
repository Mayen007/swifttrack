// client/src/views/PaymentsView.jsx
// SwiftTrack Kenya: Phase 7 Payments Engine & Multi-Channel Gateway Switchboard
import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { api } from '../services/api.js';
import { sound } from '../services/sound.js';
import {
  CreditCard,
  Smartphone,
  Banknote,
  Building2,
  Search,
  RotateCcw,
  Download,
  Filter,
  Eye,
  CheckCircle2,
  Clock,
  AlertTriangle,
  XCircle,
  Plus,
  RefreshCw,
  ShieldCheck,
  Check,
  ChevronRight,
  User,
  ShoppingBag,
  Receipt,
  FileText,
  AlertCircle,
  Undo2,
  ArrowUpRight,
  Hash,
  X
} from 'lucide-react';

export const PAYMENT_STATUS_STEPS = [
  { key: 'PENDING', label: 'Pending' },
  { key: 'PROCESSING', label: 'Processing' },
  { key: 'SUCCESS', label: 'Success' },
];

export const ALTERNATIVE_PAYMENT_STATES = [
  'FAILED',
  'TIMEOUT',
  'CANCELLED',
  'REFUNDED'
];

export function PaymentsView() {
  const { user, selectedBranch } = useAuth();
  const [intents, setIntents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [methodFilter, setMethodFilter] = useState('ALL');

  // Modals
  const [selectedIntent, setSelectedIntent] = useState(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [detailTab, setDetailTab] = useState('details'); // details, callbacks, timeline, ledger

  // Initiate Payment Modal
  const [initiateModalOpen, setInitiateModalOpen] = useState(false);
  const [formMethod, setFormMethod] = useState('MPESA');
  const [formAmount, setFormAmount] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formOrderId, setFormOrderId] = useState('');
  const [formCustomerId, setFormCustomerId] = useState('');
  const [formCardRef, setFormCardRef] = useState('');
  const [formLast4, setFormLast4] = useState('');
  const [formCashTendered, setFormCashTendered] = useState('');
  const [formBankName, setFormBankName] = useState('Equity Bank');
  const [formBankVoucher, setFormBankVoucher] = useState('');
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [stkPollingIntentId, setStkPollingIntentId] = useState(null);

  // Reconciliation Modal
  const [reconciliationModalOpen, setReconciliationModalOpen] = useState(false);
  const [reconciliationResults, setReconciliationResults] = useState(null);
  const [reconciling, setReconciling] = useState(false);

  // Refund Modal
  const [refundModalOpen, setRefundModalOpen] = useState(false);
  const [refundPaymentRecord, setRefundPaymentRecord] = useState(null);
  const [refundAmount, setRefundAmount] = useState('');
  const [refundReason, setRefundReason] = useState('');
  const [refunding, setRefunding] = useState(false);

  // Customers and Orders lookup
  const [customersList, setCustomersList] = useState([]);
  const searchInputRef = useRef(null);

  // Fetch payment intents
  const fetchIntents = async () => {
    try {
      setLoading(true);
      const branchParam = selectedBranch ? `?branch_id=${selectedBranch.id}` : '';
      const res = await api.get(`/api/payments/intents${branchParam}`);
      setIntents(res.data || []);
      setLastSyncTime(new Date().toLocaleTimeString('en-KE', { hour12: false }));
    } catch (err) {
      api.toast(`Failed to load payments: ${err.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchIntents();
    // Load customers for picker
    api.get('/api/customers').then((res) => setCustomersList(res.data || [])).catch(() => {});
  }, [selectedBranch]);

  // Keyboard shortcut F2 to focus search
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'F2') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Polling loop for active M-Pesa STK push
  useEffect(() => {
    if (!stkPollingIntentId) return;
    const interval = setInterval(async () => {
      try {
        const full = await api.get(`/api/payments/intents/${stkPollingIntentId}`);
        if (full?.intent && full.intent.status !== 'PROCESSING') {
          sound.playSuccess();
          api.toast(`Payment completed: ${full.intent.status}!`, 'success');
          setStkPollingIntentId(null);
          fetchIntents();
          if (detailModalOpen && selectedIntent?.id === stkPollingIntentId) {
            setSelectedIntent(full.intent);
          }
        }
      } catch (e) {
        // Polling error, ignore
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [stkPollingIntentId, detailModalOpen, selectedIntent]);

  // Open Intent Details Modal
  const handleViewIntent = async (intent) => {
    try {
      sound.playScan();
      const res = await api.get(`/api/payments/intents/${intent.id}`);
      setSelectedIntent(res.intent || intent);
      setDetailTab('details');
      setDetailModalOpen(true);
    } catch (e) {
      setSelectedIntent(intent);
      setDetailModalOpen(true);
    }
  };

  // Initiate Payment Intent
  const handleInitiatePayment = async (e) => {
    e?.preventDefault();
    const amt = Number(formAmount);
    if (!amt || amt <= 0) {
      api.toast('Please enter a valid payment amount', 'error');
      return;
    }

    try {
      setFormSubmitting(true);
      const idempotencyKey = `idemp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

      // 1. Create intent
      const createPayload = {
        branch_id: selectedBranch?.id || user?.branch_id || 1,
        payment_method: formMethod,
        amount: amt,
        order_id: formOrderId ? Number(formOrderId) : null,
        customer_id: formCustomerId ? Number(formCustomerId) : null,
        phone_number: formPhone || null,
        idempotency_key: idempotencyKey,
        metadata: {
          cash_tendered: formMethod === 'CASH' ? Number(formCashTendered) : null,
          card_ref: formCardRef,
          bank_name: formBankName,
          bank_voucher: formBankVoucher
        }
      };

      const res = await api.post('/api/payments/intents', createPayload);
      const intent = res.intent;

      // 2. Process intent
      const processPayload = {
        phone_number: formPhone,
        card_reference: formCardRef,
        last4: formLast4,
        bank_name: formBankName,
        bank_reference: formBankVoucher
      };

      const procRes = await api.post(`/api/payments/intents/${intent.id}/process`, processPayload);
      sound.playSuccess();

      if (formMethod === 'MPESA') {
        api.toast('STK Push dispatched to customer phone. Waiting for PIN entry...', 'info');
        setStkPollingIntentId(intent.id);
      } else {
        api.toast(`Payment settled via ${formMethod}!`, 'success');
      }

      setInitiateModalOpen(false);
      resetInitiateForm();
      fetchIntents();
      handleViewIntent(procRes.intent || intent);
    } catch (err) {
      sound.playError();
      api.toast(`Payment initiation error: ${err.message}`, 'error');
    } finally {
      setFormSubmitting(false);
    }
  };

  const resetInitiateForm = () => {
    setFormAmount('');
    setFormPhone('');
    setFormOrderId('');
    setFormCustomerId('');
    setFormCardRef('');
    setFormLast4('');
    setFormCashTendered('');
    setFormBankVoucher('');
  };

  // Re-query Provider Status (Daraja Status Inquiry / Timeout Recovery)
  const handleQueryStatus = async (intentId) => {
    try {
      sound.playScan();
      const res = await api.post(`/api/payments/intents/${intentId}/query-status`);
      sound.playSuccess();
      api.toast(`Status updated: ${res.intent.status}`, 'success');
      setSelectedIntent(res.intent);
      fetchIntents();
    } catch (err) {
      api.toast(`Status query failed: ${err.message}`, 'error');
    }
  };

  // Cancel Intent
  const handleCancelIntent = async (intentId) => {
    try {
      const reason = window.prompt('Reason for cancelling payment intent:', 'Cancelled by staff');
      if (!reason) return;
      const res = await api.post(`/api/payments/intents/${intentId}/cancel`, { reason });
      sound.playSuccess();
      api.toast('Payment intent cancelled', 'success');
      setSelectedIntent(res.intent);
      fetchIntents();
    } catch (err) {
      api.toast(`Failed to cancel intent: ${err.message}`, 'error');
    }
  };

  // Open Refund Modal
  const openRefundModal = (intent) => {
    const payment = intent.payments?.[0];
    if (!payment) {
      api.toast('No completed payment record found to refund', 'error');
      return;
    }
    setRefundPaymentRecord(payment);
    setRefundAmount(payment.amount);
    setRefundReason('Customer return / order cancellation');
    setRefundModalOpen(true);
  };

  // Execute Refund
  const handleExecuteRefund = async () => {
    if (!refundPaymentRecord) return;
    try {
      setRefunding(true);
      await api.post('/api/payments/refund', {
        payment_id: refundPaymentRecord.id,
        amount: Number(refundAmount),
        reason: refundReason
      });
      sound.playSuccess();
      api.toast('Payment refund processed successfully', 'success');
      setRefundModalOpen(false);
      fetchIntents();
      if (selectedIntent) {
        handleViewIntent(selectedIntent);
      }
    } catch (err) {
      sound.playError();
      api.toast(`Refund failed: ${err.message}`, 'error');
    } finally {
      setRefunding(false);
    }
  };

  // Run Automated Reconciliation
  const handleRunReconciliation = async () => {
    try {
      setReconciling(true);
      const res = await api.post('/api/payments/reconcile', {
        branch_id: selectedBranch?.id
      });
      sound.playSuccess();
      setReconciliationResults(res.reconciliation);
      api.toast('Payment reconciliation completed successfully', 'success');
      fetchIntents();
    } catch (err) {
      sound.playError();
      api.toast(`Reconciliation error: ${err.message}`, 'error');
    } finally {
      setReconciling(false);
    }
  };

  // Export to CSV
  const handleExportCsv = () => {
    const branchParam = selectedBranch ? `branch_id=${selectedBranch.id}&` : '';
    const statusParam = statusFilter !== 'ALL' ? `status=${statusFilter}&` : '';
    const methodParam = methodFilter !== 'ALL' ? `payment_method=${methodFilter}&` : '';
    const searchParam = searchQuery ? `search=${encodeURIComponent(searchQuery)}&` : '';
    window.open(`/api/payments/export?${branchParam}${statusParam}${methodParam}${searchParam}`, '_blank');
  };

  // Filtered list
  const filteredIntents = intents.filter((it) => {
    if (statusFilter !== 'ALL' && it.status !== statusFilter) return false;
    if (methodFilter !== 'ALL' && it.payment_method !== methodFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchIntent = it.intent_number?.toLowerCase().includes(q);
      const matchCustomer = it.customer_name?.toLowerCase().includes(q);
      const matchPhone = it.phone_number?.toLowerCase().includes(q);
      const matchProviderRef = it.provider_reference?.toLowerCase().includes(q);
      const matchReceipt = it.external_reference?.toLowerCase().includes(q);
      if (!matchIntent && !matchCustomer && !matchPhone && !matchProviderRef && !matchReceipt) return false;
    }
    return true;
  });

  // Telemetry KPIs
  const totalVolume = intents.reduce((sum, it) => sum + (it.status === 'SUCCESS' ? Number(it.amount) : 0), 0);
  const successfulCount = intents.filter((it) => it.status === 'SUCCESS').length;
  const successRate = intents.length > 0 ? Math.round((successfulCount / intents.length) * 100) : 100;
  const activeCount = intents.filter((it) => ['PENDING', 'PROCESSING'].includes(it.status)).length;
  const mpesaVolume = intents.filter((it) => it.payment_method === 'MPESA' && it.status === 'SUCCESS').reduce((sum, it) => sum + Number(it.amount), 0);

  // Status Badge Styling Helper
  const getStatusBadge = (status) => {
    switch (status) {
      case 'PENDING':
        return 'bg-slate-700/40 text-slate-300 border-slate-600/50';
      case 'PROCESSING':
        return 'bg-amber-500/20 text-amber-300 border-amber-500/40 animate-pulse';
      case 'SUCCESS':
        return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40';
      case 'FAILED':
        return 'bg-rose-500/20 text-rose-300 border-rose-500/40';
      case 'TIMEOUT':
        return 'bg-red-500/20 text-red-300 border-red-500/40';
      case 'CANCELLED':
        return 'bg-slate-600/20 text-slate-400 border-slate-600/40';
      case 'REFUNDED':
        return 'bg-purple-500/20 text-purple-300 border-purple-500/40';
      default:
        return 'bg-gray-800 text-gray-300 border-gray-700';
    }
  };

  // Method Icon Helper
  const renderMethodBadge = (method) => {
    switch (method) {
      case 'MPESA':
        return (
          <span className="px-2 py-0.5 rounded bg-emerald-950/60 border border-emerald-500/40 text-emerald-400 font-mono text-[10px] font-bold flex items-center gap-1">
            <Smartphone className="w-3 h-3" /> M-PESA
          </span>
        );
      case 'CARD':
        return (
          <span className="px-2 py-0.5 rounded bg-blue-950/60 border border-blue-500/40 text-blue-400 font-mono text-[10px] font-bold flex items-center gap-1">
            <CreditCard className="w-3 h-3" /> CARD
          </span>
        );
      case 'CASH':
        return (
          <span className="px-2 py-0.5 rounded bg-amber-950/60 border border-amber-500/40 text-amber-400 font-mono text-[10px] font-bold flex items-center gap-1">
            <Banknote className="w-3 h-3" /> CASH
          </span>
        );
      case 'BANK':
        return (
          <span className="px-2 py-0.5 rounded bg-indigo-950/60 border border-indigo-500/40 text-indigo-400 font-mono text-[10px] font-bold flex items-center gap-1">
            <Building2 className="w-3 h-3" /> BANK
          </span>
        );
      default:
        return <span className="text-slate-400">{method}</span>;
    }
  };

  return (
    <div className="space-y-4">
      {/* 1. TOP OPERATIONAL CONSOLE */}
      <div className="bg-[#12161f] border border-[#222834] rounded p-4 space-y-3.5 shadow-md">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded bg-[#181d28] border border-[#222834] flex items-center justify-center text-amber-400 shadow-sm">
              <CreditCard className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm font-bold text-slate-100 uppercase tracking-wider font-mono">
                  Payments Engine // Gateway
                </h1>
                <span className="px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/30 text-[10px] font-mono text-emerald-400 font-semibold">
                  DARAJA 2.0 & IDEMPOTENT
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5 font-mono">
                STATION: <span className="text-slate-200 font-semibold">{selectedBranch?.name || 'All Regional Stations'}</span>
                {lastSyncTime && <span className="ml-2 text-slate-500 font-mono">({lastSyncTime} EAT)</span>}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setInitiateModalOpen(true)}
              className="h-8 px-3.5 rounded bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-mono font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>+ INITIATE PAYMENT</span>
            </button>

            <button
              onClick={() => setReconciliationModalOpen(true)}
              className="h-8 px-3 rounded bg-[#161c28] hover:bg-[#202738] border border-[#222834] text-slate-300 hover:text-white text-xs font-mono flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Run payment reconciliation"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span className="hidden sm:inline">RECONCILIATION</span>
            </button>

            <button
              onClick={handleExportCsv}
              className="h-8 px-3 rounded bg-[#161c28] hover:bg-[#202738] border border-[#222834] text-slate-300 hover:text-white text-xs font-mono flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Export payments ledger to CSV"
            >
              <Download className="w-3.5 h-3.5 text-slate-400" />
              <span className="hidden sm:inline">EXPORT CSV</span>
            </button>

            <button
              onClick={() => {
                fetchIntents();
                sound.playScan();
              }}
              disabled={loading}
              className="h-8 px-3 rounded bg-[#0c0e12] hover:bg-[#181d28] border border-[#222834] text-slate-300 hover:text-white text-xs font-mono flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
              title="Refresh payments"
            >
              <RotateCcw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-amber-400' : 'text-slate-400'}`} />
              <span className="hidden sm:inline">SYNC</span>
            </button>
          </div>
        </div>

        {/* Telemetry KPI Matrix */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-[#222834] border border-[#222834] rounded overflow-hidden">
          <div className="bg-[#0c0e12] p-2.5 flex items-center justify-between">
            <div>
              <span className="text-[10px] text-slate-400 font-mono uppercase block">Total Settled</span>
              <span className="text-base font-mono font-bold text-emerald-400 tabular-nums">
                {api.formatKES(totalVolume)}
              </span>
            </div>
            <Banknote className="w-4 h-4 text-emerald-500" />
          </div>

          <div className="bg-[#0c0e12] p-2.5 flex items-center justify-between">
            <div>
              <span className="text-[10px] text-blue-400 font-mono uppercase block">Success Rate</span>
              <span className="text-base font-mono font-bold text-blue-400 tabular-nums">{successRate}%</span>
            </div>
            <CheckCircle2 className="w-4 h-4 text-blue-500" />
          </div>

          <div className="bg-[#0c0e12] p-2.5 flex items-center justify-between">
            <div>
              <span className="text-[10px] text-amber-400 font-mono uppercase block">In Progress</span>
              <span className="text-base font-mono font-bold text-amber-400 tabular-nums">{activeCount}</span>
            </div>
            <Clock className="w-4 h-4 text-amber-500" />
          </div>

          <div className="bg-[#0c0e12] p-2.5 flex items-center justify-between">
            <div>
              <span className="text-[10px] text-emerald-400 font-mono uppercase block">M-Pesa Volume</span>
              <span className="text-base font-mono font-bold text-emerald-300 tabular-nums">
                {api.formatKES(mpesaVolume)}
              </span>
            </div>
            <Smartphone className="w-4 h-4 text-emerald-500" />
          </div>
        </div>

        {/* State Machine Status Filter Bar */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-1 border-t border-[#1b212c]">
          <span className="text-[10px] font-mono text-slate-500 uppercase mr-1 flex items-center gap-1">
            <Filter className="w-3 h-3" /> STATUS:
          </span>
          {['ALL', 'PENDING', 'PROCESSING', 'SUCCESS', 'FAILED', 'TIMEOUT', 'CANCELLED', 'REFUNDED'].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-2.5 py-1 rounded text-[11px] font-mono whitespace-nowrap transition-colors cursor-pointer border ${
                statusFilter === st
                  ? 'bg-amber-400 text-slate-950 font-bold border-amber-400'
                  : 'bg-[#0c0e12] text-slate-400 border-[#222834] hover:text-white'
              }`}
            >
              {st}
            </button>
          ))}

          <div className="h-4 w-px bg-[#222834] mx-1" />

          {/* Payment Method Filter */}
          <span className="text-[10px] font-mono text-slate-500 uppercase mr-1">METHOD:</span>
          {['ALL', 'MPESA', 'CARD', 'CASH', 'BANK'].map((m) => (
            <button
              key={m}
              onClick={() => setMethodFilter(m)}
              className={`px-2 py-0.5 rounded text-[10px] font-mono whitespace-nowrap transition-colors cursor-pointer border ${
                methodFilter === m
                  ? 'bg-blue-600 text-white font-bold border-blue-500'
                  : 'bg-[#0c0e12] text-slate-400 border-[#222834] hover:text-white'
              }`}
            >
              {m === 'ALL' ? 'ALL METHODS' : m}
            </button>
          ))}
        </div>

        {/* Search Bar */}
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            ref={searchInputRef}
            type="text"
            placeholder="Search payments by Intent #, Customer, Phone, Checkout Request ID, or M-Pesa Receipt... (Press F2)"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-14 py-2 rounded bg-[#0c0e12] border border-[#222834] text-white placeholder-slate-500 text-xs font-sans focus:outline-none focus:border-amber-400"
          />
          <span className="absolute right-2.5 top-2 text-[10px] font-mono text-slate-400 border border-[#222834] px-1.5 py-0.5 rounded bg-[#141822]">
            F2
          </span>
        </div>
      </div>

      {/* 2. PAYMENTS DATA TABLE */}
      <div className="bg-[#12161f] border border-[#222834] rounded overflow-hidden shadow-md">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead>
              <tr className="bg-[#0c0e12] border-b border-[#222834] text-slate-400 uppercase text-[10px]">
                <th className="p-3">Intent Number</th>
                <th className="p-3">Date</th>
                <th className="p-3">Method</th>
                <th className="p-3">Customer</th>
                <th className="p-3">Linked Order</th>
                <th className="p-3 text-right">Amount</th>
                <th className="p-3 text-center">Status</th>
                <th className="p-3">Provider Ref / Receipt</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#222834]">
              {filteredIntents.length === 0 ? (
                <tr>
                  <td colSpan="9" className="p-12 text-center text-slate-500 font-mono text-xs">
                    No payment intents found matching filters.
                  </td>
                </tr>
              ) : (
                filteredIntents.map((it) => (
                  <tr key={it.id} className="hover:bg-[#161c28]/60 transition-colors">
                    <td className="p-3">
                      <span
                        onClick={() => handleViewIntent(it)}
                        className="font-bold text-white hover:text-amber-300 cursor-pointer block truncate"
                      >
                        {it.intent_number}
                      </span>
                      {it.idempotency_key && (
                        <span className="text-[9px] text-slate-500 block truncate font-mono">
                          IDEMP: {it.idempotency_key.substring(0, 16)}...
                        </span>
                      )}
                    </td>
                    <td className="p-3 text-slate-400 whitespace-nowrap text-[11px]">
                      {new Date(it.created_at).toLocaleDateString('en-KE', {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td className="p-3">{renderMethodBadge(it.payment_method)}</td>
                    <td className="p-3">
                      <span className="font-medium text-slate-200 block truncate max-w-[130px]">
                        {it.customer_name || 'Walk-in'}
                      </span>
                      <span className="text-[10px] text-slate-500 block truncate">{it.phone_number}</span>
                    </td>
                    <td className="p-3">
                      {it.order_number ? (
                        <span className="text-amber-300 font-semibold">{it.order_number}</span>
                      ) : it.sale_number ? (
                        <span className="text-blue-300">{it.sale_number}</span>
                      ) : (
                        <span className="text-slate-600">—</span>
                      )}
                    </td>
                    <td className="p-3 text-right font-bold text-emerald-400 tabular-nums">
                      {api.formatKES(it.amount)}
                    </td>
                    <td className="p-3 text-center">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold border whitespace-nowrap ${getStatusBadge(
                          it.status
                        )}`}
                      >
                        {it.status}
                      </span>
                    </td>
                    <td className="p-3 text-slate-300 text-[11px] truncate max-w-[160px]">
                      {it.external_reference ? (
                        <span className="text-emerald-400 font-bold block truncate">
                          RC: {it.external_reference}
                        </span>
                      ) : it.provider_reference ? (
                        <span className="text-slate-400 block truncate">
                          {it.provider_reference.substring(0, 18)}...
                        </span>
                      ) : (
                        <span className="text-slate-600">—</span>
                      )}
                    </td>
                    <td className="p-3 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleViewIntent(it)}
                          className="p-1 rounded bg-[#161c28] hover:bg-[#202738] text-slate-300 hover:text-white border border-[#222834] cursor-pointer"
                          title="View Intent & Audit Trail"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>

                        {it.status === 'PROCESSING' && (
                          <button
                            onClick={() => handleQueryStatus(it.id)}
                            className="p-1 rounded bg-[#161c28] hover:bg-[#202738] text-amber-400 hover:text-amber-300 border border-[#222834] cursor-pointer"
                            title="Query Provider Status"
                          >
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          </button>
                        )}

                        {['PENDING', 'PROCESSING'].includes(it.status) && (
                          <button
                            onClick={() => handleCancelIntent(it.id)}
                            className="p-1 rounded bg-[#161c28] hover:bg-[#202738] text-rose-400 hover:text-rose-300 border border-[#222834] cursor-pointer"
                            title="Cancel Intent"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}

                        {it.status === 'SUCCESS' && (
                          <button
                            onClick={() => openRefundModal(it)}
                            className="p-1 rounded bg-[#161c28] hover:bg-[#202738] text-purple-400 hover:text-purple-300 border border-[#222834] cursor-pointer"
                            title="Refund Payment"
                          >
                            <Undo2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* MODAL 1: INITIATE PAYMENT MODAL */}
      {/* ------------------------------------------------------------- */}
      {initiateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3 select-none overflow-y-auto">
          <div className="bg-[#12161f] border border-[#222834] rounded-lg max-w-md w-full shadow-2xl p-5 space-y-4 my-auto text-xs font-mono">
            <div className="flex items-center justify-between border-b border-[#222834] pb-3">
              <div className="flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-amber-400" />
                <h3 className="font-bold text-white text-sm">INITIATE PAYMENT // GATEWAY</h3>
              </div>
              <button
                onClick={() => setInitiateModalOpen(false)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleInitiatePayment} className="space-y-3">
              {/* Method Picker */}
              <div>
                <label className="text-slate-400 text-[10px] uppercase block mb-1">Payment Method</label>
                <div className="grid grid-cols-4 gap-1.5">
                  {['MPESA', 'CARD', 'CASH', 'BANK'].map((m) => (
                    <button
                      type="button"
                      key={m}
                      onClick={() => setFormMethod(m)}
                      className={`p-2 rounded text-center font-bold border transition-colors cursor-pointer ${
                        formMethod === m
                          ? 'bg-amber-400 text-slate-950 border-amber-400 shadow'
                          : 'bg-[#0c0e12] text-slate-400 border-[#222834] hover:text-white'
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>

              {/* Amount */}
              <div>
                <label className="text-slate-400 text-[10px] uppercase block mb-1">Amount (KES)</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  placeholder="e.g. 2500"
                  value={formAmount}
                  onChange={(e) => setFormAmount(e.target.value)}
                  className="w-full p-2 rounded bg-[#0c0e12] border border-[#222834] text-emerald-400 font-bold text-base focus:border-amber-400 focus:outline-none"
                />
              </div>

              {/* Customer Selector */}
              <div>
                <label className="text-slate-400 text-[10px] uppercase block mb-1">Customer (Optional)</label>
                <select
                  value={formCustomerId}
                  onChange={(e) => {
                    setFormCustomerId(e.target.value);
                    const found = customersList.find((c) => String(c.id) === e.target.value);
                    if (found && found.phone) setFormPhone(found.phone);
                  }}
                  className="w-full p-2 rounded bg-[#0c0e12] border border-[#222834] text-slate-200 focus:border-amber-400 focus:outline-none text-xs"
                >
                  <option value="">-- Walk-in Customer --</option>
                  {customersList.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.full_name} ({c.phone || 'No phone'})
                    </option>
                  ))}
                </select>
              </div>

              {/* Dynamic inputs based on method */}
              {formMethod === 'MPESA' && (
                <div>
                  <label className="text-slate-400 text-[10px] uppercase block mb-1">
                    Customer M-Pesa Phone (2547XXXXXXXX or 07XXXXXXXX)
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="0712345678"
                    value={formPhone}
                    onChange={(e) => setFormPhone(e.target.value)}
                    className="w-full p-2 rounded bg-[#0c0e12] border border-[#222834] text-white focus:border-amber-400 focus:outline-none"
                  />
                  <span className="text-[10px] text-emerald-400 mt-1 block">
                    ⚡ Lipa Na M-Pesa Online STK push will be triggered immediately.
                  </span>
                </div>
              )}

              {formMethod === 'CARD' && (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-slate-400 text-[10px] uppercase block mb-1">Card Auth Reference</label>
                    <input
                      type="text"
                      placeholder="AUTH-9912"
                      value={formCardRef}
                      onChange={(e) => setFormCardRef(e.target.value)}
                      className="w-full p-2 rounded bg-[#0c0e12] border border-[#222834] text-white focus:border-amber-400 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-slate-400 text-[10px] uppercase block mb-1">Last 4 Digits</label>
                    <input
                      type="text"
                      maxLength="4"
                      placeholder="4242"
                      value={formLast4}
                      onChange={(e) => setFormLast4(e.target.value)}
                      className="w-full p-2 rounded bg-[#0c0e12] border border-[#222834] text-white focus:border-amber-400 focus:outline-none"
                    />
                  </div>
                </div>
              )}

              {formMethod === 'CASH' && (
                <div>
                  <label className="text-slate-400 text-[10px] uppercase block mb-1">Cash Tendered (KES)</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="Amount handed by customer"
                    value={formCashTendered}
                    onChange={(e) => setFormCashTendered(e.target.value)}
                    className="w-full p-2 rounded bg-[#0c0e12] border border-[#222834] text-white focus:border-amber-400 focus:outline-none"
                  />
                  {Number(formCashTendered) > Number(formAmount) && (
                    <span className="text-[11px] text-amber-400 font-bold block mt-1">
                      Change Due: {api.formatKES(Number(formCashTendered) - Number(formAmount))}
                    </span>
                  )}
                </div>
              )}

              {formMethod === 'BANK' && (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-slate-400 text-[10px] uppercase block mb-1">Bank Name</label>
                    <input
                      type="text"
                      value={formBankName}
                      onChange={(e) => setFormBankName(e.target.value)}
                      className="w-full p-2 rounded bg-[#0c0e12] border border-[#222834] text-white focus:border-amber-400 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-slate-400 text-[10px] uppercase block mb-1">Deposit Slip / Voucher</label>
                    <input
                      type="text"
                      placeholder="VCH-12849"
                      value={formBankVoucher}
                      onChange={(e) => setFormBankVoucher(e.target.value)}
                      className="w-full p-2 rounded bg-[#0c0e12] border border-[#222834] text-white focus:border-amber-400 focus:outline-none"
                    />
                  </div>
                </div>
              )}

              <div className="pt-2 flex justify-end gap-2 border-t border-[#222834]">
                <button
                  type="button"
                  onClick={() => setInitiateModalOpen(false)}
                  className="px-3 py-1.5 rounded bg-[#161c28] hover:bg-[#202738] text-slate-300 font-bold cursor-pointer"
                >
                  CANCEL
                </button>
                <button
                  type="submit"
                  disabled={formSubmitting}
                  className="px-4 py-1.5 rounded bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                >
                  {formSubmitting && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>{formMethod === 'MPESA' ? 'DISPATCH STK PUSH' : 'CONFIRM & SETTLE'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODAL 2: INTENT DEEP DIVE & AUDIT TRAIL MODAL */}
      {/* ------------------------------------------------------------- */}
      {detailModalOpen && selectedIntent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-3 select-none overflow-y-auto">
          <div className="bg-[#12161f] border border-[#222834] rounded-lg max-w-3xl w-full shadow-2xl p-5 space-y-4 my-auto text-xs font-mono">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-[#222834] pb-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded bg-amber-400/10 border border-amber-400/30 text-amber-400 flex items-center justify-center font-bold">
                  <CreditCard className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="font-bold text-white text-sm">{selectedIntent.intent_number}</h2>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${getStatusBadge(selectedIntent.status)}`}>
                      {selectedIntent.status}
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-400 font-sans">
                    Channel: <span className="text-slate-200 font-bold">{selectedIntent.payment_method}</span> | Branch: {selectedIntent.branch_name}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setDetailModalOpen(false)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Stepper Progression */}
            <div className="p-3 bg-[#0c0e12] border border-[#222834] rounded flex items-center justify-between">
              <div className="flex items-center gap-2">
                {PAYMENT_STATUS_STEPS.map((st, idx) => {
                  const isCurrent = selectedIntent.status === st.key;
                  const isCompleted =
                    selectedIntent.status === 'SUCCESS' ||
                    (st.key === 'PENDING' && ['PROCESSING', 'SUCCESS'].includes(selectedIntent.status));
                  return (
                    <div key={st.key} className="flex items-center gap-1.5">
                      <div
                        className={`px-2.5 py-1 rounded text-[10px] font-bold flex items-center gap-1 border ${
                          isCurrent
                            ? 'bg-amber-400 text-slate-950 border-amber-400'
                            : isCompleted
                            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                            : 'bg-[#161c28] text-slate-500 border-[#222834]'
                        }`}
                      >
                        {isCompleted && <Check className="w-3 h-3 text-emerald-400" />}
                        <span>{st.label}</span>
                      </div>
                      {idx < PAYMENT_STATUS_STEPS.length - 1 && (
                        <ChevronRight className="w-3.5 h-3.5 text-slate-600" />
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Action Bar */}
              <div className="flex items-center gap-1.5">
                {selectedIntent.status === 'PROCESSING' && (
                  <button
                    onClick={() => handleQueryStatus(selectedIntent.id)}
                    className="px-2.5 py-1 rounded bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold cursor-pointer flex items-center gap-1"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>QUERY STATUS</span>
                  </button>
                )}
                {['PENDING', 'PROCESSING'].includes(selectedIntent.status) && (
                  <button
                    onClick={() => handleCancelIntent(selectedIntent.id)}
                    className="px-2.5 py-1 rounded bg-rose-950/40 hover:bg-rose-900/60 border border-rose-800/60 text-rose-300 font-bold cursor-pointer"
                  >
                    CANCEL
                  </button>
                )}
                {selectedIntent.status === 'SUCCESS' && (
                  <button
                    onClick={() => openRefundModal(selectedIntent)}
                    className="px-2.5 py-1 rounded bg-purple-950/40 hover:bg-purple-900/60 border border-purple-800/60 text-purple-300 font-bold cursor-pointer"
                  >
                    REFUND
                  </button>
                )}
              </div>
            </div>

            {/* Tab Selector */}
            <div className="flex border-b border-[#222834] gap-2 pt-1">
              {[
                { key: 'details', label: 'Settlement Details' },
                { key: 'callbacks', label: `Provider Callbacks (${selectedIntent.callbacks?.length || 0})` },
                { key: 'timeline', label: `Audit Trail (${selectedIntent.audit_trail?.length || 0})` },
                { key: 'ledger', label: `Payments Ledger (${selectedIntent.payments?.length || 0})` },
              ].map((t) => (
                <button
                  key={t.key}
                  onClick={() => setDetailTab(t.key)}
                  className={`px-3 py-1.5 text-xs font-mono font-bold border-b-2 transition-colors cursor-pointer ${
                    detailTab === t.key
                      ? 'border-amber-400 text-amber-400'
                      : 'border-transparent text-slate-400 hover:text-white'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* TAB CONTENT 1: DETAILS */}
            {detailTab === 'details' && (
              <div className="grid grid-cols-2 gap-3 bg-[#0c0e12] p-4 rounded border border-[#222834]">
                <div>
                  <span className="text-[10px] text-slate-500 block uppercase">Total Amount</span>
                  <span className="text-base font-bold text-emerald-400">{api.formatKES(selectedIntent.amount)}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 block uppercase">Idempotency Key</span>
                  <span className="text-slate-300 font-mono text-[11px] truncate block">
                    {selectedIntent.idempotency_key || 'None assigned'}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 block uppercase">Provider Reference</span>
                  <span className="text-slate-200 font-mono text-[11px] truncate block">
                    {selectedIntent.provider_reference || '—'}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 block uppercase">External Receipt / Voucher</span>
                  <span className="text-emerald-400 font-mono font-bold text-[11px] truncate block">
                    {selectedIntent.external_reference || '—'}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 block uppercase">Customer</span>
                  <span className="text-slate-200 block truncate">
                    {selectedIntent.customer_name || 'Walk-in'} ({selectedIntent.phone_number || 'N/A'})
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 block uppercase">Created At</span>
                  <span className="text-slate-400 font-mono text-[11px]">
                    {new Date(selectedIntent.created_at).toLocaleString('en-KE')}
                  </span>
                </div>
                {selectedIntent.failure_reason && (
                  <div className="col-span-2 p-2 rounded bg-rose-950/30 border border-rose-800/40 text-rose-300">
                    <span className="font-bold block">Failure / Exception Reason:</span>
                    <span>{selectedIntent.failure_reason}</span>
                  </div>
                )}
              </div>
            )}

            {/* TAB CONTENT 2: CALLBACKS */}
            {detailTab === 'callbacks' && (
              <div className="space-y-2 max-h-72 overflow-y-auto">
                {(!selectedIntent.callbacks || selectedIntent.callbacks.length === 0) ? (
                  <div className="p-8 text-center text-slate-500 font-mono">No provider webhook callbacks recorded yet.</div>
                ) : (
                  selectedIntent.callbacks.map((cb) => (
                    <div key={cb.id} className="bg-[#0c0e12] border border-[#222834] rounded p-3 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-amber-400 font-bold">{cb.provider} Webhook Callback</span>
                        <span className="text-[10px] text-slate-500">
                          {new Date(cb.created_at).toLocaleTimeString('en-KE')}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-300 font-sans">
                        Result: <span className="font-bold text-white">{cb.result_description || 'Accepted'}</span> (Code: {cb.result_code})
                      </div>
                      <pre className="p-2 rounded bg-[#161c28] text-[10px] font-mono text-emerald-300 overflow-x-auto max-h-32">
                        {cb.raw_payload}
                      </pre>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* TAB CONTENT 3: TIMELINE */}
            {detailTab === 'timeline' && (
              <div className="space-y-2 max-h-72 overflow-y-auto">
                {(!selectedIntent.audit_trail || selectedIntent.audit_trail.length === 0) ? (
                  <div className="p-8 text-center text-slate-500 font-mono">No audit trail entries recorded.</div>
                ) : (
                  selectedIntent.audit_trail.map((item) => (
                    <div key={item.id} className="bg-[#0c0e12] border border-[#222834] rounded p-2.5 flex items-start gap-3">
                      <div className="w-6 h-6 rounded bg-[#161c28] flex items-center justify-center text-amber-400 shrink-0 mt-0.5">
                        <ShieldCheck className="w-3.5 h-3.5" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-200">
                            {item.from_status ? `${item.from_status} → ${item.to_status}` : item.to_status}
                          </span>
                          <span className="text-[10px] text-slate-500">
                            {new Date(item.created_at).toLocaleTimeString('en-KE')}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 font-sans mt-0.5">{item.details}</p>
                        <span className="text-[9px] text-slate-500 block mt-1 font-mono">
                          ACTOR: {item.actor_type} ({item.actor_id})
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* TAB CONTENT 4: LEDGER */}
            {detailTab === 'ledger' && (
              <div className="space-y-2 max-h-72 overflow-y-auto">
                {(!selectedIntent.payments || selectedIntent.payments.length === 0) ? (
                  <div className="p-8 text-center text-slate-500 font-mono">No completed ledger payments tied to this intent yet.</div>
                ) : (
                  selectedIntent.payments.map((p) => (
                    <div key={p.id} className="bg-[#0c0e12] border border-[#222834] rounded p-3 flex items-center justify-between">
                      <div>
                        <span className="font-bold text-white block">{p.payment_number}</span>
                        <span className="text-[11px] text-slate-400 font-sans">
                          Method: {p.payment_method} | Cashier: {p.cashier_name || 'System'}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="font-bold text-emerald-400 block">{api.formatKES(p.amount)}</span>
                        <span className={`px-2 py-0.5 rounded text-[9px] font-bold border ${getStatusBadge(p.status)}`}>
                          {p.status}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODAL 3: RECONCILIATION MODAL */}
      {/* ------------------------------------------------------------- */}
      {reconciliationModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3 select-none overflow-y-auto">
          <div className="bg-[#12161f] border border-[#222834] rounded-lg max-w-lg w-full shadow-2xl p-5 space-y-4 my-auto text-xs font-mono">
            <div className="flex items-center justify-between border-b border-[#222834] pb-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-400" />
                <h3 className="font-bold text-white text-sm">PAYMENT RECONCILIATION ENGINE</h3>
              </div>
              <button
                onClick={() => setReconciliationModalOpen(false)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-slate-400 text-[11px] font-sans">
              Evaluates payments ledger against recorded intents and provider verification references.
            </p>

            <button
              onClick={handleRunReconciliation}
              disabled={reconciling}
              className="w-full py-2 rounded bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {reconciling && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
              <span>RUN AUTOMATED RECONCILIATION</span>
            </button>

            {reconciliationResults && (
              <div className="space-y-3 pt-2 border-t border-[#222834]">
                <div className="grid grid-cols-3 gap-2 bg-[#0c0e12] p-3 rounded border border-[#222834]">
                  <div>
                    <span className="text-[10px] text-slate-500 block uppercase">Evaluated</span>
                    <span className="text-base font-bold text-white">{reconciliationResults.total_evaluated}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-emerald-500 block uppercase">Matched</span>
                    <span className="text-base font-bold text-emerald-400">{reconciliationResults.matched_count}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-amber-500 block uppercase">Discrepancies</span>
                    <span className="text-base font-bold text-amber-400">{reconciliationResults.discrepancies_count}</span>
                  </div>
                </div>

                <div>
                  <span className="text-[10px] text-slate-400 block uppercase mb-1">Reconciled Volume</span>
                  <span className="text-base font-bold text-emerald-300 font-mono">
                    {api.formatKES(reconciliationResults.reconciled_volume)}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODAL 4: REFUND MODAL */}
      {/* ------------------------------------------------------------- */}
      {refundModalOpen && refundPaymentRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3 select-none overflow-y-auto">
          <div className="bg-[#12161f] border border-[#222834] rounded-lg max-w-sm w-full shadow-2xl p-5 space-y-4 my-auto text-xs font-mono">
            <div className="flex items-center justify-between border-b border-[#222834] pb-3">
              <div className="flex items-center gap-2">
                <Undo2 className="w-5 h-5 text-purple-400" />
                <h3 className="font-bold text-white text-sm">PROCESS REFUND</h3>
              </div>
              <button
                onClick={() => setRefundModalOpen(false)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2">
              <div className="bg-[#0c0e12] p-2.5 rounded border border-[#222834]">
                <span className="text-[10px] text-slate-500 block uppercase">Original Payment</span>
                <span className="font-bold text-white">{refundPaymentRecord.payment_number}</span>
                <span className="text-emerald-400 font-bold block">{api.formatKES(refundPaymentRecord.amount)}</span>
              </div>

              <div>
                <label className="text-slate-400 text-[10px] uppercase block mb-1">Refund Amount (KES)</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  max={refundPaymentRecord.amount}
                  value={refundAmount}
                  onChange={(e) => setRefundAmount(e.target.value)}
                  className="w-full p-2 rounded bg-[#0c0e12] border border-[#222834] text-purple-300 font-bold focus:border-amber-400 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-slate-400 text-[10px] uppercase block mb-1">Reason for Refund</label>
                <textarea
                  rows="2"
                  required
                  value={refundReason}
                  onChange={(e) => setRefundReason(e.target.value)}
                  className="w-full p-2 rounded bg-[#0c0e12] border border-[#222834] text-white focus:border-amber-400 focus:outline-none text-xs"
                />
              </div>
            </div>

            <div className="pt-2 flex justify-end gap-2 border-t border-[#222834]">
              <button
                type="button"
                onClick={() => setRefundModalOpen(false)}
                className="px-3 py-1.5 rounded bg-[#161c28] hover:bg-[#202738] text-slate-300 font-bold cursor-pointer"
              >
                CANCEL
              </button>
              <button
                type="button"
                onClick={handleExecuteRefund}
                disabled={refunding}
                className="px-4 py-1.5 rounded bg-purple-600 hover:bg-purple-500 text-white font-bold cursor-pointer disabled:opacity-50"
              >
                {refunding ? 'PROCESSING...' : 'CONFIRM REFUND'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
