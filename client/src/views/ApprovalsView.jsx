// client/src/views/ApprovalsView.jsx
import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { api } from '../services/api.js';
import { sound } from '../services/sound.js';
import {
  RotateCcw,
  CheckCircle2,
  XCircle,
  Clock,
  ShieldCheck,
  Building2,
  Receipt,
  Search,
  ArrowRightLeft,
  Eye,
  X,
  AlertTriangle,
  User,
  Package,
  Layers,
  FileCheck,
  ShieldAlert,
  ArrowRight,
} from 'lucide-react';

export function ApprovalsView() {
  const { user, selectedBranch } = useAuth();
  const [activeTab, setActiveTab] = useState('REFUNDS'); // 'REFUNDS', 'TRANSFERS', 'HISTORY'
  const [refundRequests, setRefundRequests] = useState([]);
  const [stockTransfers, setStockTransfers] = useState([]);
  const [historyLedger, setHistoryLedger] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [lastSyncTime, setLastSyncTime] = useState(null);

  // Reject Modal State
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectItem, setRejectItem] = useState(null);
  const [rejectItemType, setRejectItemType] = useState('REFUND'); // 'REFUND' or 'TRANSFER'
  const [rejectionReason, setRejectionReason] = useState('Outside return policy guidelines');
  const [rejectionNotes, setRejectionNotes] = useState('');

  // Inspect Modal State
  const [inspectModalOpen, setInspectModalOpen] = useState(false);
  const [inspectItem, setInspectItem] = useState(null);

  const searchInputRef = useRef(null);

  const fetchApprovalsData = async () => {
    try {
      setLoading(true);
      const branchParam = selectedBranch ? `?branch_id=${selectedBranch.id}` : '';
      const [refundsData, transfersData] = await Promise.all([
        api.get(`/api/refunds/queue${branchParam}`).catch(() => []),
        api.get(`/api/inventory/transfers${branchParam}`).catch(() => []),
      ]);

      const allRefunds = Array.isArray(refundsData) ? refundsData : [];
      const allTransfers = Array.isArray(transfersData) ? transfersData : [];

      setRefundRequests(allRefunds.filter((r) => r.status === 'PENDING_APPROVAL'));
      setStockTransfers(allTransfers.filter((t) => t.status === 'PENDING_APPROVAL'));

      // Combined decision history
      const resolvedRefunds = allRefunds.filter((r) => r.status !== 'PENDING_APPROVAL').map((r) => ({
        ...r,
        record_type: 'REFUND',
      }));
      const resolvedTransfers = allTransfers.filter((t) => t.status !== 'PENDING_APPROVAL').map((t) => ({
        ...t,
        record_type: 'TRANSFER',
      }));
      setHistoryLedger([...resolvedRefunds, ...resolvedTransfers].sort((a, b) => (b.id || 0) - (a.id || 0)));

      setLastSyncTime(new Date().toLocaleTimeString('en-KE', { hour12: false }));
    } catch (e) {
      console.error('Failed to load approvals queue:', e);
      api.toast('Failed to load authorization queue: ' + e.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchApprovalsData();
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
        setRejectModalOpen(false);
        setInspectModalOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Approve Refund
  const handleApproveRefund = async (reqId) => {
    try {
      await api.post(`/api/refunds/${reqId}/approve`, {});
      sound.playSuccess();
      api.toast('Refund approved! Stock returned to warehouse inventory', 'success');
      fetchApprovalsData();
    } catch (e) {
      sound.playError();
      api.toast(`Approval failed: ${e.message}`, 'error');
    }
  };

  // Approve Transfer
  const handleApproveTransfer = async (transferId) => {
    try {
      await api.post(`/api/inventory/transfers/${transferId}/status`, { action: 'APPROVE' });
      sound.playSuccess();
      api.toast('Inter-branch transfer authorized and ready for dispatch', 'success');
      fetchApprovalsData();
    } catch (e) {
      sound.playError();
      api.toast(`Transfer authorization failed: ${e.message}`, 'error');
    }
  };

  // Open Rejection Modal
  const openRejectModal = (item, type) => {
    setRejectItem(item);
    setRejectItemType(type);
    setRejectionReason(type === 'REFUND' ? 'Outside return policy guidelines' : 'Insufficient source inventory / logistics capacity');
    setRejectionNotes('');
    setRejectModalOpen(true);
    sound.playScan();
  };

  // Submit Rejection
  const handleSubmitRejection = async () => {
    if (!rejectItem) return;

    try {
      const fullReason = `${rejectionReason}${rejectionNotes ? ` - ${rejectionNotes}` : ''}`;
      if (rejectItemType === 'REFUND') {
        await api.post(`/api/refunds/${rejectItem.id}/reject`, {
          rejection_reason: fullReason,
        });
      } else {
        await api.post(`/api/inventory/transfers/${rejectItem.id}/status`, {
          action: 'REJECT',
          reason: fullReason,
        });
      }

      sound.playError();
      api.toast(`${rejectItemType === 'REFUND' ? 'Refund' : 'Transfer'} request rejected`, 'info');
      setRejectModalOpen(false);
      setRejectItem(null);
      fetchApprovalsData();
    } catch (e) {
      sound.playError();
      api.toast(`Rejection failed: ${e.message}`, 'error');
    }
  };

  // Open Inspect Modal
  const openInspectModal = (item, type) => {
    setInspectItem({ ...item, record_type: type });
    setInspectModalOpen(true);
    sound.playScan();
  };

  // Filtered lists
  const filteredRefunds = refundRequests.filter((r) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      r.refund_request_number?.toLowerCase().includes(q) ||
      r.sale_number?.toLowerCase().includes(q) ||
      r.customer_name?.toLowerCase().includes(q) ||
      r.requested_by_name?.toLowerCase().includes(q) ||
      r.reason?.toLowerCase().includes(q)
    );
  });

  const filteredTransfers = stockTransfers.filter((t) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      t.transfer_number?.toLowerCase().includes(q) ||
      t.source_branch_name?.toLowerCase().includes(q) ||
      t.target_branch_name?.toLowerCase().includes(q) ||
      t.requested_by_name?.toLowerCase().includes(q) ||
      t.notes?.toLowerCase().includes(q)
    );
  });

  const filteredHistory = historyLedger.filter((h) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      h.refund_request_number?.toLowerCase().includes(q) ||
      h.transfer_number?.toLowerCase().includes(q) ||
      h.sale_number?.toLowerCase().includes(q) ||
      h.requested_by_name?.toLowerCase().includes(q) ||
      h.status?.toLowerCase().includes(q)
    );
  });

  // Telemetry Calculations
  const pendingRefundsValue = refundRequests.reduce((sum, r) => sum + (r.amount || 0), 0);
  const pendingTransfersCount = stockTransfers.length;
  const approvedTotalCount = historyLedger.filter((h) => ['APPROVED', 'COMPLETED', 'RECEIVED', 'DISPATCHED'].includes(h.status)).length;
  const rejectedTotalCount = historyLedger.filter((h) => h.status === 'REJECTED').length;

  return (
    <div className="space-y-4">
      {/* 1. TOP OPERATIONAL INSTRUMENT CONSOLE */}
      <div className="bg-[#12161f] border border-[#222834] rounded p-4 space-y-3.5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded bg-[#181d28] border border-[#222834] flex items-center justify-center text-amber-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm font-bold text-slate-100 uppercase tracking-wider font-mono">
                  Manager Approvals & Authorization Console
                </h1>
                <span className="px-2 py-0.5 rounded bg-[#181d28] border border-[#222834] text-[10px] font-mono text-slate-400">
                  GOVERNANCE // INTERNAL CONTROLS
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5 font-mono">
                STATION: <span className="text-slate-200 font-semibold">{selectedBranch?.name || 'All Regional Branches'}</span>
                <span className="mx-2 text-[#222834]">|</span>
                POLICY: <span className="text-amber-400 font-bold">DUAL-CONTROL ENFORCED</span>
                {lastSyncTime && <span className="ml-1 text-slate-500 font-mono">({lastSyncTime} EAT)</span>}
              </p>
            </div>
          </div>

          {/* Action & View Switcher */}
          <div className="flex items-center flex-wrap gap-2">
            <div className="flex bg-[#0c0e12] p-0.5 rounded border border-[#222834] text-xs font-mono">
              <button
                onClick={() => {
                  setActiveTab('REFUNDS');
                  sound.playScan();
                }}
                className={`px-3 py-1.5 rounded text-[11px] font-bold transition-colors cursor-pointer flex items-center gap-1.5 ${activeTab === 'REFUNDS'
                    ? 'bg-[#181d28] text-white border border-[#222834]'
                    : 'text-slate-400 hover:text-slate-200'
                  }`}
              >
                <RotateCcw className="w-3.5 h-3.5 text-rose-400" />
                <span>CUSTOMER REFUNDS ({refundRequests.length})</span>
              </button>

              <button
                onClick={() => {
                  setActiveTab('TRANSFERS');
                  sound.playScan();
                }}
                className={`px-3 py-1.5 rounded text-[11px] font-bold transition-colors cursor-pointer flex items-center gap-1.5 ${activeTab === 'TRANSFERS'
                    ? 'bg-[#181d28] text-white border border-[#222834]'
                    : 'text-slate-400 hover:text-slate-200'
                  }`}
              >
                <ArrowRightLeft className="w-3.5 h-3.5 text-indigo-400" />
                <span>STOCK TRANSFERS ({stockTransfers.length})</span>
              </button>

              <button
                onClick={() => {
                  setActiveTab('HISTORY');
                  sound.playScan();
                }}
                className={`px-3 py-1.5 rounded text-[11px] font-bold transition-colors cursor-pointer flex items-center gap-1.5 ${activeTab === 'HISTORY'
                    ? 'bg-[#181d28] text-white border border-[#222834]'
                    : 'text-slate-400 hover:text-slate-200'
                  }`}
              >
                <FileCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>DECISION AUDIT</span>
              </button>
            </div>

            <button
              onClick={() => {
                fetchApprovalsData();
                sound.playScan();
              }}
              disabled={loading}
              className="h-8 px-3 rounded bg-[#0c0e12] hover:bg-[#181d28] border border-[#222834] text-slate-300 hover:text-white text-xs font-mono font-medium flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
              title="Refresh approvals queue"
            >
              <RotateCcw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-amber-400' : 'text-slate-400'}`} />
              <span>SYNC</span>
            </button>
          </div>
        </div>

        {/* 2. UNIFIED HARDWARE TELEMETRY STRIP (Dieter Rams Matrix) */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-[#222834] border border-[#222834] rounded overflow-hidden">
          <div className="bg-[#0c0e12] p-2.5 flex items-center justify-between">
            <div>
              <span className="text-[10px] text-amber-400 font-mono uppercase tracking-wider block">Pending Customer Refunds</span>
              <span className="text-lg font-mono font-bold text-amber-300 tabular-nums">{refundRequests.length}</span>
            </div>
            <Clock className="w-4 h-4 text-amber-400" />
          </div>

          <div className="bg-[#0c0e12] p-2.5 flex items-center justify-between">
            <div>
              <span className="text-[10px] text-rose-400 font-mono uppercase tracking-wider block">Awaiting Refund Capital</span>
              <span className="text-lg font-mono font-bold text-rose-400 tabular-nums">
                {api.formatKES(pendingRefundsValue)}
              </span>
            </div>
            <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
          </div>

          <div className="bg-[#0c0e12] p-2.5 flex items-center justify-between">
            <div>
              <span className="text-[10px] text-indigo-400 font-mono uppercase tracking-wider block">Pending Stock Transfers</span>
              <span className="text-lg font-mono font-bold text-indigo-300 tabular-nums">{pendingTransfersCount}</span>
            </div>
            <ArrowRightLeft className="w-4 h-4 text-indigo-400" />
          </div>

          <div className="bg-[#0c0e12] p-2.5 flex items-center justify-between">
            <div>
              <span className="text-[10px] text-emerald-400 font-mono uppercase tracking-wider block">Approved Decisions</span>
              <span className="text-lg font-mono font-bold text-emerald-400 tabular-nums">{approvedTotalCount}</span>
            </div>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
        </div>

        {/* 3. SWITCHBOARD SEARCH BAR */}
        <div className="pt-2 border-t border-[#222834] flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search request ref, order #, cashier, customer, reason... [F2]"
              className="w-full pl-8 pr-8 py-1.5 bg-[#0c0e12] border border-[#222834] focus:border-amber-500/60 rounded text-xs text-slate-200 placeholder-slate-500 font-mono focus:outline-none transition-colors"
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

          <span className="text-xs text-slate-500 font-mono self-center">
            {activeTab === 'REFUNDS'
              ? `${filteredRefunds.length} refunds awaiting action`
              : activeTab === 'TRANSFERS'
                ? `${filteredTransfers.length} transfers awaiting action`
                : `${filteredHistory.length} audited decisions`}
          </span>
        </div>
      </div>

      {/* 4. TAB 1: CUSTOMER REFUND REQUESTS QUEUE */}
      {activeTab === 'REFUNDS' && (
        <div className="bg-[#12161f] border border-[#222834] rounded overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono border-collapse">
              <thead>
                <tr className="border-b border-[#222834] text-[10px] text-slate-400 uppercase tracking-wider bg-[#0c0e12]">
                  <th className="p-3">Request Ref</th>
                  <th className="p-3">Original Order / Sale</th>
                  <th className="p-3">Requesting Cashier</th>
                  <th className="p-3">Customer</th>
                  <th className="p-3">Return Reason</th>
                  <th className="p-3 text-right">Original Sale</th>
                  <th className="p-3 text-right">Refund Capital</th>
                  <th className="p-3 text-right">Management Decision</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#222834]">
                {filteredRefunds.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-12 text-center text-slate-500 font-mono">
                      <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-emerald-400" />
                      <span className="font-bold text-slate-300 block">Queue Cleared</span>
                      <span className="text-[11px] text-slate-500 block mt-0.5">
                        No customer refund requests currently awaiting managerial authorization.
                      </span>
                    </td>
                  </tr>
                ) : (
                  filteredRefunds.map((req) => (
                    <tr key={req.id} className="hover:bg-[#181d28]/40 transition-colors">
                      {/* Request Ref */}
                      <td className="p-3">
                        <span className="font-bold text-rose-400">
                          {req.refund_request_number || `#REF-${req.id}`}
                        </span>
                      </td>

                      {/* Order / Sale Number */}
                      <td className="p-3">
                        <span className="text-slate-200 font-semibold">{req.sale_number || req.order_number || 'SALE'}</span>
                        <span className="text-slate-500 text-[10px] block">
                          {req.branch_name || 'Main Branch'}
                        </span>
                      </td>

                      {/* Cashier */}
                      <td className="p-3 text-slate-300">
                        <div className="flex items-center gap-1.5">
                          <User className="w-3 h-3 text-indigo-400 shrink-0" />
                          <span>{req.requested_by_name || 'Cashier'}</span>
                        </div>
                      </td>

                      {/* Customer */}
                      <td className="p-3 text-slate-300 font-medium">
                        {req.customer_name || 'Retail Walk-in'}
                      </td>

                      {/* Reason */}
                      <td className="p-3 text-slate-400 italic max-w-xs truncate" title={req.reason}>
                        {req.reason}
                      </td>

                      {/* Original Sale */}
                      <td className="p-3 text-right text-slate-400 tabular-nums">
                        {api.formatKES(req.sale_total || req.original_total || req.total_amount)}
                      </td>

                      {/* Refund Value */}
                      <td className="p-3 text-right font-bold text-rose-400 tabular-nums text-sm">
                        {api.formatKES(req.amount || req.refund_amount)}
                      </td>

                      {/* Action Decision Buttons */}
                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => openInspectModal(req, 'REFUND')}
                            className="p-1.5 rounded bg-[#0c0e12] hover:bg-[#181d28] text-slate-400 hover:text-white border border-[#222834] transition-colors cursor-pointer"
                            title="Inspect Details"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => handleApproveRefund(req.id)}
                            className="px-2.5 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[10px] uppercase tracking-wider flex items-center gap-1 transition-colors cursor-pointer shadow-sm shadow-emerald-950"
                          >
                            <CheckCircle2 className="w-3 h-3" />
                            <span>Approve</span>
                          </button>

                          <button
                            onClick={() => openRejectModal(req, 'REFUND')}
                            className="px-2.5 py-1.5 rounded bg-rose-600/20 hover:bg-rose-600 text-rose-300 hover:text-white border border-rose-500/40 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 transition-colors cursor-pointer"
                          >
                            <XCircle className="w-3 h-3" />
                            <span>Reject</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 5. TAB 2: INTER-BRANCH TRANSFER APPROVALS */}
      {activeTab === 'TRANSFERS' && (
        <div className="bg-[#12161f] border border-[#222834] rounded overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono border-collapse">
              <thead>
                <tr className="border-b border-[#222834] text-[10px] text-slate-400 uppercase tracking-wider bg-[#0c0e12]">
                  <th className="p-3">Transfer Ref</th>
                  <th className="p-3">Origin Hub</th>
                  <th className="p-3">Destination Depot</th>
                  <th className="p-3">Requested By</th>
                  <th className="p-3">Cargo Specification</th>
                  <th className="p-3">Transit Notes</th>
                  <th className="p-3 text-right">Management Decision</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#222834]">
                {filteredTransfers.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-12 text-center text-slate-500 font-mono">
                      <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-emerald-400" />
                      <span className="font-bold text-slate-300 block">All Transfers Authorized</span>
                      <span className="text-[11px] text-slate-500 block mt-0.5">
                        No stock transfer movements currently pending managerial sign-off.
                      </span>
                    </td>
                  </tr>
                ) : (
                  filteredTransfers.map((trf) => (
                    <tr key={trf.id} className="hover:bg-[#181d28]/40 transition-colors">
                      {/* Transfer Ref */}
                      <td className="p-3 font-bold text-indigo-400">
                        {trf.transfer_number}
                      </td>

                      {/* Source */}
                      <td className="p-3 text-slate-300">
                        <div className="font-semibold">{trf.source_warehouse_name || trf.source_branch_name}</div>
                        <span className="text-[10px] text-slate-500">{trf.source_branch_name}</span>
                      </td>

                      {/* Target */}
                      <td className="p-3 text-emerald-400">
                        <div className="font-semibold">{trf.target_warehouse_name || trf.target_branch_name}</div>
                        <span className="text-[10px] text-slate-500">{trf.target_branch_name}</span>
                      </td>

                      {/* Requesting Staff */}
                      <td className="p-3 text-slate-300">
                        {trf.requested_by_name || 'Station Dispatcher'}
                      </td>

                      {/* Cargo Specification */}
                      <td className="p-3 text-slate-300">
                        {trf.items && trf.items.length > 0 ? (
                          <span>{trf.items.length} product SKU lines ({trf.items.reduce((s, i) => s + (i.quantity_requested || 0), 0)} units)</span>
                        ) : (
                          <span className="text-slate-500 italic">Inventory move</span>
                        )}
                      </td>

                      {/* Notes */}
                      <td className="p-3 text-slate-400 italic max-w-xs truncate" title={trf.notes}>
                        {trf.notes || 'Inter-hub replenishment'}
                      </td>

                      {/* Actions */}
                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => openInspectModal(trf, 'TRANSFER')}
                            className="p-1.5 rounded bg-[#0c0e12] hover:bg-[#181d28] text-slate-400 hover:text-white border border-[#222834] transition-colors cursor-pointer"
                            title="Inspect Transfer Manifest"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => handleApproveTransfer(trf.id)}
                            className="px-2.5 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[10px] uppercase tracking-wider flex items-center gap-1 transition-colors cursor-pointer shadow-sm shadow-emerald-950"
                          >
                            <CheckCircle2 className="w-3 h-3" />
                            <span>Authorize</span>
                          </button>

                          <button
                            onClick={() => openRejectModal(trf, 'TRANSFER')}
                            className="px-2.5 py-1.5 rounded bg-rose-600/20 hover:bg-rose-600 text-rose-300 hover:text-white border border-rose-500/40 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 transition-colors cursor-pointer"
                          >
                            <XCircle className="w-3 h-3" />
                            <span>Reject</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 6. TAB 3: AUDITED DECISION LEDGER */}
      {activeTab === 'HISTORY' && (
        <div className="bg-[#12161f] border border-[#222834] rounded overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono border-collapse">
              <thead>
                <tr className="border-b border-[#222834] text-[10px] text-slate-400 uppercase tracking-wider bg-[#0c0e12]">
                  <th className="p-3">Reference #</th>
                  <th className="p-3">Authorization Category</th>
                  <th className="p-3">Request Details</th>
                  <th className="p-3">Requested By</th>
                  <th className="p-3">Sign-off Approver</th>
                  <th className="p-3 text-center">Status</th>
                  <th className="p-3 text-right">Settled Amount / Items</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#222834]">
                {filteredHistory.map((item, idx) => {
                  const isRefund = item.record_type === 'REFUND';
                  const isApproved = ['APPROVED', 'COMPLETED', 'RECEIVED', 'DISPATCHED'].includes(item.status);
                  const isRejected = item.status === 'REJECTED';

                  return (
                    <tr key={idx} className="hover:bg-[#181d28]/40 transition-colors">
                      <td className="p-3 font-bold text-slate-200">
                        {item.refund_request_number || item.transfer_number || `#${item.id}`}
                      </td>
                      <td className="p-3">
                        <span
                          className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${isRefund
                              ? 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                              : 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/30'
                            }`}
                        >
                          {isRefund ? 'CUSTOMER REFUND' : 'STOCK TRANSFER'}
                        </span>
                      </td>
                      <td className="p-3 text-slate-300 max-w-xs truncate">
                        {isRefund ? (
                          <span>Sale: {item.sale_number} ({item.customer_name})</span>
                        ) : (
                          <span>{item.source_warehouse_name} → {item.target_warehouse_name}</span>
                        )}
                      </td>
                      <td className="p-3 text-slate-400">
                        {item.requested_by_name || 'Staff'}
                      </td>
                      <td className="p-3 text-slate-300 font-semibold">
                        {item.approved_by_name || user?.full_name || 'Management'}
                      </td>
                      <td className="p-3 text-center">
                        <span
                          className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${isApproved
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                              : isRejected
                                ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
                                : 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                            }`}
                        >
                          {item.status}
                        </span>
                      </td>
                      <td className="p-3 text-right font-mono font-bold text-slate-200 tabular-nums">
                        {isRefund && item.amount ? api.formatKES(item.amount) : `${item.items?.length || 1} lines`}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 7. STRUCTURED REJECTION MODAL */}
      {rejectModalOpen && rejectItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-xs p-4">
          <div className="bg-[#12161f] border border-rose-500/40 rounded p-6 max-w-md w-full shadow-2xl relative space-y-4 animate-in fade-in zoom-in-95">
            <button
              onClick={() => setRejectModalOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-1"
            >
              <X className="w-5 h-5" />
            </button>

            <div>
              <span className="text-[10px] font-mono text-rose-400 uppercase tracking-wider font-bold">
                AUDIT REJECTION // MANAGEMENT DECISION
              </span>
              <h3 className="text-base font-bold text-white flex items-center gap-2 font-mono mt-0.5">
                <ShieldAlert className="w-4 h-4 text-rose-400" />
                Reject {rejectItemType === 'REFUND' ? 'Refund' : 'Transfer'} #{rejectItem.refund_request_number || rejectItem.transfer_number}
              </h3>
            </div>

            <div className="space-y-3 text-xs font-mono">
              <div>
                <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                  Standard Rejection Rationale *
                </label>
                <select
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  className="w-full px-3 py-2 rounded bg-[#0c0e12] border border-[#222834] text-slate-200 font-mono focus:outline-none focus:border-rose-500 cursor-pointer"
                >
                  {rejectItemType === 'REFUND' ? (
                    <>
                      <option value="Outside return policy guidelines">Outside return policy guidelines (7-day window exceeded)</option>
                      <option value="Product opened / damaged by customer">Product opened / seal broken / customer damage</option>
                      <option value="Original fiscal receipt or serial discrepancy">Original fiscal receipt or serial discrepancy</option>
                      <option value="Disputed by branch management">Disputed by branch management</option>
                      <option value="Administrative rejection">Administrative rejection</option>
                    </>
                  ) : (
                    <>
                      <option value="Insufficient source inventory">Insufficient source inventory</option>
                      <option value="Logistics trunk capacity limitation">Logistics trunk capacity limitation</option>
                      <option value="Destination warehouse capacity reached">Destination warehouse capacity reached</option>
                      <option value="Duplicate transfer request">Duplicate transfer request</option>
                    </>
                  )}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                  Auditor Notes & Specifics (Optional)
                </label>
                <textarea
                  value={rejectionNotes}
                  onChange={(e) => setRejectionNotes(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 rounded bg-[#0c0e12] border border-[#222834] text-slate-200 font-mono focus:outline-none focus:border-rose-500 resize-none"
                  placeholder="Additional justification recorded in permanent audit ledger..."
                />
              </div>

              <div className="pt-2 flex gap-2.5">
                <button
                  onClick={handleSubmitRejection}
                  className="flex-1 py-2.5 rounded bg-rose-600 hover:bg-rose-500 text-white font-bold font-mono text-xs uppercase tracking-wider shadow-lg shadow-rose-900/40 transition-colors cursor-pointer"
                >
                  Confirm Rejection
                </button>
                <button
                  onClick={() => setRejectModalOpen(false)}
                  className="py-2.5 px-4 rounded bg-[#181d28] hover:bg-slate-700 text-slate-300 font-semibold font-mono text-xs cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 8. INSPECT MODAL */}
      {inspectModalOpen && inspectItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-xs p-4">
          <div className="bg-[#12161f] border border-[#222834] rounded p-6 max-w-md w-full shadow-2xl relative space-y-4 animate-in fade-in zoom-in-95">
            <button
              onClick={() => setInspectModalOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-1"
            >
              <X className="w-5 h-5" />
            </button>

            <div>
              <span className="text-[10px] font-mono text-amber-400 uppercase tracking-wider font-bold">
                AUDIT VERIFICATION // DETAILS
              </span>
              <h3 className="text-base font-bold text-slate-100 font-mono mt-0.5">
                {inspectItem.refund_request_number || inspectItem.transfer_number}
              </h3>
            </div>

            <div className="bg-[#0c0e12] border border-[#222834] rounded p-3 text-xs font-mono space-y-2">
              <div className="flex justify-between border-b border-[#222834] pb-1.5">
                <span className="text-slate-500">Authorization Type:</span>
                <span className="font-bold text-amber-400">{inspectItem.record_type}</span>
              </div>
              <div className="flex justify-between border-b border-[#222834] pb-1.5">
                <span className="text-slate-500">Requested By:</span>
                <span className="text-slate-200">{inspectItem.requested_by_name || 'Staff'}</span>
              </div>
              <div className="flex justify-between border-b border-[#222834] pb-1.5">
                <span className="text-slate-500">Status:</span>
                <span className="font-bold text-slate-200">{inspectItem.status}</span>
              </div>
              {inspectItem.record_type === 'REFUND' ? (
                <>
                  <div className="flex justify-between border-b border-[#222834] pb-1.5">
                    <span className="text-slate-500">Sale Number:</span>
                    <span className="text-slate-200 font-semibold">{inspectItem.sale_number}</span>
                  </div>
                  <div className="flex justify-between border-b border-[#222834] pb-1.5">
                    <span className="text-slate-500">Customer:</span>
                    <span className="text-slate-200">{inspectItem.customer_name || 'Walk-in'}</span>
                  </div>
                  <div className="flex justify-between border-b border-[#222834] pb-1.5">
                    <span className="text-slate-500">Refund Amount:</span>
                    <span className="text-rose-400 font-bold tabular-nums">
                      {api.formatKES(inspectItem.amount)}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Cashier Reason:</span>
                    <span className="text-slate-200 italic mt-0.5 block">{inspectItem.reason}</span>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex justify-between border-b border-[#222834] pb-1.5">
                    <span className="text-slate-500">Source:</span>
                    <span className="text-slate-200">{inspectItem.source_warehouse_name}</span>
                  </div>
                  <div className="flex justify-between border-b border-[#222834] pb-1.5">
                    <span className="text-slate-500">Destination:</span>
                    <span className="text-emerald-400 font-semibold">{inspectItem.target_warehouse_name}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Transit Notes:</span>
                    <span className="text-slate-200 italic mt-0.5 block">{inspectItem.notes || 'None'}</span>
                  </div>
                </>
              )}
            </div>

            <button
              onClick={() => setInspectModalOpen(false)}
              className="w-full py-2 rounded bg-[#0c0e12] hover:bg-[#181d28] text-slate-400 hover:text-slate-200 border border-[#222834] text-xs font-mono"
            >
              Close Inspector
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
