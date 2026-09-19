// client/src/views/ApprovalsView.jsx
import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { api } from '../services/api.js';
import { sound } from '../services/sound.js';
import { Search, X } from 'lucide-react';

import { ApprovalsHeader } from '../components/approvals/ApprovalsHeader.jsx';
import { ApprovalsKpis } from '../components/approvals/ApprovalsKpis.jsx';
import { RefundsQueueTable } from '../components/approvals/RefundsQueueTable.jsx';
import { TransfersQueueTable } from '../components/approvals/TransfersQueueTable.jsx';
import { ApprovalsHistoryTable } from '../components/approvals/ApprovalsHistoryTable.jsx';
import { ApprovalRejectModal } from '../components/approvals/ApprovalRejectModal.jsx';
import { ApprovalInspectModal } from '../components/approvals/ApprovalInspectModal.jsx';

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
      const resolvedRefunds = allRefunds
        .filter((r) => r.status !== 'PENDING_APPROVAL')
        .map((r) => ({
          ...r,
          record_type: 'REFUND',
        }));
      const resolvedTransfers = allTransfers
        .filter((t) => t.status !== 'PENDING_APPROVAL')
        .map((t) => ({
          ...t,
          record_type: 'TRANSFER',
        }));
      setHistoryLedger(
        [...resolvedRefunds, ...resolvedTransfers].sort((a, b) => (b.id || 0) - (a.id || 0))
      );

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
    setRejectionReason(
      type === 'REFUND'
        ? 'Outside return policy guidelines'
        : 'Insufficient source inventory / logistics capacity'
    );
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
      api.toast(
        `${rejectItemType === 'REFUND' ? 'Refund' : 'Transfer'} request rejected`,
        'info'
      );
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
  const approvedTotalCount = historyLedger.filter((h) =>
    ['APPROVED', 'COMPLETED', 'RECEIVED', 'DISPATCHED'].includes(h.status)
  ).length;

  return (
    <div className="space-y-4">
      {/* 1. TOP OPERATIONAL INSTRUMENT CONSOLE */}
      <div className="bg-[#12161f] border border-[#222834] rounded p-4 space-y-3.5">
        <ApprovalsHeader
          selectedBranch={selectedBranch}
          lastSyncTime={lastSyncTime}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          refundsCount={refundRequests.length}
          transfersCount={stockTransfers.length}
          loading={loading}
          onRefresh={() => {
            fetchApprovalsData();
            sound.playScan();
          }}
        />

        {/* 2. UNIFIED HARDWARE TELEMETRY STRIP */}
        <ApprovalsKpis
          pendingRefundsCount={refundRequests.length}
          pendingRefundsValue={pendingRefundsValue}
          pendingTransfersCount={pendingTransfersCount}
          approvedTotalCount={approvedTotalCount}
        />

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
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 cursor-pointer"
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
        <RefundsQueueTable
          refunds={filteredRefunds}
          onApproveRefund={handleApproveRefund}
          onOpenRejectModal={openRejectModal}
          onOpenInspectModal={openInspectModal}
        />
      )}

      {/* 5. TAB 2: INTER-BRANCH TRANSFER APPROVALS */}
      {activeTab === 'TRANSFERS' && (
        <TransfersQueueTable
          transfers={filteredTransfers}
          onApproveTransfer={handleApproveTransfer}
          onOpenRejectModal={openRejectModal}
          onOpenInspectModal={openInspectModal}
        />
      )}

      {/* 6. TAB 3: AUDITED DECISION LEDGER */}
      {activeTab === 'HISTORY' && (
        <ApprovalsHistoryTable
          history={filteredHistory}
          user={user}
        />
      )}

      {/* 7. STRUCTURED REJECTION MODAL */}
      <ApprovalRejectModal
        isOpen={rejectModalOpen}
        item={rejectItem}
        type={rejectItemType}
        reason={rejectionReason}
        setReason={setRejectionReason}
        notes={rejectionNotes}
        setNotes={setRejectionNotes}
        onClose={() => setRejectModalOpen(false)}
        onSubmit={handleSubmitRejection}
      />

      {/* 8. INSPECT MODAL */}
      <ApprovalInspectModal
        isOpen={inspectModalOpen}
        item={inspectItem}
        onClose={() => setInspectModalOpen(false)}
      />
    </div>
  );
}
