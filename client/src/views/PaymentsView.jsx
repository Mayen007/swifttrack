import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { api } from '../services/api.js';
import { sound } from '../services/sound.js';

import {
  PAYMENT_STATUS_STEPS,
  ALTERNATIVE_PAYMENT_STATES
} from '../components/payments/constants.jsx';
import { PaymentsConsoleHeader } from '../components/payments/PaymentsConsoleHeader.jsx';
import { PaymentsTable } from '../components/payments/PaymentsTable.jsx';
import { InitiatePaymentModal } from '../components/payments/InitiatePaymentModal.jsx';
import { PaymentDetailModal } from '../components/payments/PaymentDetailModal.jsx';
import { PaymentReconciliationModal } from '../components/payments/PaymentReconciliationModal.jsx';
import { PaymentRefundModal } from '../components/payments/PaymentRefundModal.jsx';

export { PAYMENT_STATUS_STEPS, ALTERNATIVE_PAYMENT_STATES };

export function PaymentsView() {
  const { user, selectedBranch } = useAuth();
  const [intents, setIntents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [methodFilter, setMethodFilter] = useState('ALL');

  const [selectedIntent, setSelectedIntent] = useState(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [detailTab, setDetailTab] = useState('details');

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

  const [reconciliationModalOpen, setReconciliationModalOpen] = useState(false);
  const [reconciliationResults, setReconciliationResults] = useState(null);
  const [reconciling, setReconciling] = useState(false);

  const [refundModalOpen, setRefundModalOpen] = useState(false);
  const [refundPaymentRecord, setRefundPaymentRecord] = useState(null);
  const [refundAmount, setRefundAmount] = useState('');
  const [refundReason, setRefundReason] = useState('');
  const [refunding, setRefunding] = useState(false);

  const [customersList, setCustomersList] = useState([]);
  const searchInputRef = useRef(null);

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
    api.get('/api/customers').then((res) => setCustomersList(res.data || [])).catch(() => {});
  }, [selectedBranch]);

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

  const handleExportCsv = () => {
    const branchParam = selectedBranch ? `branch_id=${selectedBranch.id}&` : '';
    const statusParam = statusFilter !== 'ALL' ? `status=${statusFilter}&` : '';
    const methodParam = methodFilter !== 'ALL' ? `payment_method=${methodFilter}&` : '';
    const searchParam = searchQuery ? `search=${encodeURIComponent(searchQuery)}&` : '';
    window.open(`/api/payments/export?${branchParam}${statusParam}${methodParam}${searchParam}`, '_blank');
  };

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

  const totalVolume = intents.reduce((sum, it) => sum + (it.status === 'SUCCESS' ? Number(it.amount) : 0), 0);
  const successfulCount = intents.filter((it) => it.status === 'SUCCESS').length;
  const successRate = intents.length > 0 ? Math.round((successfulCount / intents.length) * 100) : 100;
  const activeCount = intents.filter((it) => ['PENDING', 'PROCESSING'].includes(it.status)).length;
  const mpesaVolume = intents.filter((it) => it.payment_method === 'MPESA' && it.status === 'SUCCESS').reduce((sum, it) => sum + Number(it.amount), 0);

  return (
    <div className="space-y-4">
      <PaymentsConsoleHeader
        selectedBranch={selectedBranch}
        lastSyncTime={lastSyncTime}
        loading={loading}
        onRefresh={fetchIntents}
        onOpenInitiate={() => setInitiateModalOpen(true)}
        onOpenReconciliation={() => setReconciliationModalOpen(true)}
        onExportCsv={handleExportCsv}
        totalVolume={totalVolume}
        successRate={successRate}
        activeCount={activeCount}
        mpesaVolume={mpesaVolume}
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
        methodFilter={methodFilter}
        setMethodFilter={setMethodFilter}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        searchInputRef={searchInputRef}
      />

      <PaymentsTable
        filteredIntents={filteredIntents}
        onViewIntent={handleViewIntent}
        onQueryStatus={handleQueryStatus}
        onCancelIntent={handleCancelIntent}
        onOpenRefund={openRefundModal}
      />

      <InitiatePaymentModal
        isOpen={initiateModalOpen}
        onClose={() => setInitiateModalOpen(false)}
        onSubmit={handleInitiatePayment}
        formMethod={formMethod}
        setFormMethod={setFormMethod}
        formAmount={formAmount}
        setFormAmount={setFormAmount}
        formCustomerId={formCustomerId}
        setFormCustomerId={setFormCustomerId}
        formPhone={formPhone}
        setFormPhone={setFormPhone}
        formCardRef={formCardRef}
        setFormCardRef={setFormCardRef}
        formLast4={formLast4}
        setFormLast4={setFormLast4}
        formCashTendered={formCashTendered}
        setFormCashTendered={setFormCashTendered}
        formBankName={formBankName}
        setFormBankName={setFormBankName}
        formBankVoucher={formBankVoucher}
        setFormBankVoucher={setFormBankVoucher}
        formSubmitting={formSubmitting}
        customersList={customersList}
      />

      <PaymentDetailModal
        isOpen={detailModalOpen}
        selectedIntent={selectedIntent}
        detailTab={detailTab}
        setDetailTab={setDetailTab}
        onClose={() => setDetailModalOpen(false)}
        onQueryStatus={handleQueryStatus}
        onCancelIntent={handleCancelIntent}
        onOpenRefund={openRefundModal}
      />

      <PaymentReconciliationModal
        isOpen={reconciliationModalOpen}
        onClose={() => setReconciliationModalOpen(false)}
        onRunReconciliation={handleRunReconciliation}
        reconciling={reconciling}
        reconciliationResults={reconciliationResults}
      />

      <PaymentRefundModal
        isOpen={refundModalOpen}
        refundPaymentRecord={refundPaymentRecord}
        refundAmount={refundAmount}
        setRefundAmount={setRefundAmount}
        refundReason={refundReason}
        setRefundReason={setRefundReason}
        refunding={refunding}
        onClose={() => setRefundModalOpen(false)}
        onSubmit={handleExecuteRefund}
      />
    </div>
  );
}
