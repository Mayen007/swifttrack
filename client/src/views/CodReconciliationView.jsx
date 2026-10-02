// client/src/views/CodReconciliationView.jsx
// SwiftTrack Logistics: Stage 7 Cash on Delivery (COD) Settlements & Financial Reconciliation
import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { api } from '../services/api.js';
import { sound } from '../services/sound.js';
import {
  Banknote,
  Search,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ShieldCheck,
  FileText,
  DollarSign,
  ChevronRight,
  X,
  CreditCard,
  Building2,
  ArrowRight
} from 'lucide-react';

export function CodReconciliationView() {
  const { user, selectedBranch } = useAuth();

  const [settlements, setSettlements] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Modals
  const [selectedSettlement, setSelectedSettlement] = useState(null);
  const [remitModalOpen, setRemitModalOpen] = useState(false);
  const [reconcileModalOpen, setReconcileModalOpen] = useState(false);
  const [auditModalOpen, setAuditModalOpen] = useState(false);

  // Remittance Form
  const [remitAmount, setRemitAmount] = useState('');
  const [remitMethod, setRemitMethod] = useState('CASH');
  const [remitReference, setRemitReference] = useState('');

  // Reconciliation Form
  const [reconcileVarianceReason, setReconcileVarianceReason] = useState('');
  const [reconcileNotes, setReconcileNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchSettlements = async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/cod/settlements');
      const data = res?.settlements || res?.data || (Array.isArray(res) ? res : []);
      setSettlements(data);

      const sumRes = await api.get('/api/cod/summary');
      if (sumRes) {
        setSummary(sumRes);
      }
    } catch (err) {
      console.warn('Failed to load COD settlements:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettlements();
  }, [selectedBranch]);

  // Open Remittance Modal
  const handleOpenRemit = (s) => {
    setSelectedSettlement(s);
    setRemitAmount(String(s.collected_amount || s.expected_amount || ''));
    setRemitReference('');
    setRemitModalOpen(true);
    sound.playClick();
  };

  // Submit Remittance
  const handleExecuteRemit = async (e) => {
    e.preventDefault();
    if (!selectedSettlement) return;
    setSubmitting(true);
    try {
      await api.post(`/api/cod/settlements/${selectedSettlement.id}/remit`, {
        remitted_amount: Number(remitAmount),
        remittance_method: remitMethod,
        remittance_reference: remitReference
      });
      sound.playSuccess();
      api.toast(`Remittance of KES ${Number(remitAmount).toLocaleString()} recorded successfully`, 'success');
      setRemitModalOpen(false);
      fetchSettlements();
    } catch (err) {
      sound.playAlert();
      api.toast(`Remittance failed: ${err.message}`, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // Open Reconciliation Modal
  const handleOpenReconcile = (s) => {
    setSelectedSettlement(s);
    setReconcileVarianceReason('');
    setReconcileNotes('');
    setReconcileModalOpen(true);
    sound.playClick();
  };

  // Submit Reconciliation (Rule BR-010 Guard)
  const handleExecuteReconcile = async (e) => {
    e.preventDefault();
    if (!selectedSettlement) return;

    const variance = (selectedSettlement.collected_amount || 0) - (selectedSettlement.expected_amount || 0);
    if (variance !== 0 && !reconcileVarianceReason.trim()) {
      sound.playAlert();
      api.toast('Rule BR-010: You must provide a formal variance reason to reconcile this settlement.', 'error');
      return;
    }

    setSubmitting(true);
    try {
      await api.post(`/api/cod/settlements/${selectedSettlement.id}/reconcile`, {
        variance_reason: reconcileVarianceReason,
        notes: reconcileNotes
      });
      sound.playSuccess();
      api.toast(`Settlement #${selectedSettlement.settlement_number} successfully reconciled`, 'success');
      setReconcileModalOpen(false);
      fetchSettlements();
    } catch (err) {
      sound.playAlert();
      api.toast(`Reconciliation failed: ${err.message}`, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const filteredSettlements = useMemo(() => {
    return settlements.filter((s) => {
      const matchesSearch =
        !searchQuery ||
        s.settlement_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.tracking_number?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = statusFilter === 'ALL' || s.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [settlements, searchQuery, statusFilter]);

  const getStatusBadge = (status) => {
    switch (status) {
      case 'RECONCILED':
      case 'CLOSED':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
      case 'REMITTED':
        return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
      case 'COLLECTED':
        return 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20';
      case 'PENDING_COLLECTION':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
      case 'DISCREPANT':
        return 'bg-rose-500/10 text-rose-400 border-rose-500/20';
      default:
        return 'bg-slate-500/10 text-slate-400 border-slate-500/20';
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-[#12161f] border border-[#222834] p-3.5 sm:p-4 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Banknote className="w-5 h-5 text-amber-500" />
            <h1 className="text-xl font-bold text-white tracking-tight">COD Settlement & Financial Reconciliation</h1>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Cash-on-Delivery collections, driver depot remittance, variance accounting & Rule BR-010 reconciliation
          </p>
        </div>

        <button
          onClick={fetchSettlements}
          disabled={loading}
          className="px-3.5 py-2 rounded-xl bg-[#181d28] hover:bg-[#1f2534] border border-[#222834] text-xs font-semibold text-slate-300 flex items-center gap-2 transition"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <div className="bg-[#12161f] border border-[#222834] p-4 rounded-xl">
          <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Total Expected COD</p>
          <p className="text-xl font-bold text-white mt-1">
            KES {(summary?.total_expected || 0).toLocaleString()}
          </p>
        </div>
        <div className="bg-[#12161f] border border-[#222834] p-4 rounded-xl">
          <p className="text-[11px] font-medium text-cyan-400 uppercase tracking-wider">Collected In Field</p>
          <p className="text-xl font-bold text-cyan-400 mt-1">
            KES {(summary?.total_collected || 0).toLocaleString()}
          </p>
        </div>
        <div className="bg-[#12161f] border border-[#222834] p-4 rounded-xl">
          <p className="text-[11px] font-medium text-blue-400 uppercase tracking-wider">Remitted At Depot</p>
          <p className="text-xl font-bold text-blue-400 mt-1">
            KES {(summary?.total_remitted || 0).toLocaleString()}
          </p>
        </div>
        <div className="bg-[#12161f] border border-[#222834] p-4 rounded-xl">
          <p className="text-[11px] font-medium text-emerald-400 uppercase tracking-wider">Reconciled Batch</p>
          <p className="text-xl font-bold text-emerald-400 mt-1">
            {summary?.reconciled_count || 0} batches
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-[#12161f] border border-[#222834] p-4 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search settlement reference or tracking number..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-[#181d28] border border-[#222834] rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none"
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 bg-[#181d28] border border-[#222834] rounded-xl text-xs text-slate-300 focus:outline-none"
        >
          <option value="ALL">All Financial Statuses</option>
          <option value="PENDING_COLLECTION">PENDING COLLECTION</option>
          <option value="COLLECTED">COLLECTED</option>
          <option value="REMITTED">REMITTED</option>
          <option value="RECONCILED">RECONCILED</option>
          <option value="DISCREPANT">DISCREPANT</option>
        </select>
      </div>

      {/* Settlements Table */}
      <div className="bg-[#12161f] border border-[#222834] rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#181d28] text-slate-400 font-semibold border-b border-[#222834]">
              <tr>
                <th className="py-2 px-3">Settlement Reference</th>
                <th className="py-2 px-3">Linked Consignment</th>
                <th className="py-2 px-3">Expected COD</th>
                <th className="py-2 px-3">Collected</th>
                <th className="py-2 px-3">Remitted</th>
                <th className="py-2 px-3">Variance</th>
                <th className="py-2 px-3">Financial Status</th>
                <th className="py-2 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#222834] text-slate-300">
              {loading ? (
                <tr>
                  <td colSpan="8" className="py-12 text-center text-slate-500">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-amber-500" />
                    Loading COD settlements ledger...
                  </td>
                </tr>
              ) : filteredSettlements.length === 0 ? (
                <tr>
                  <td colSpan="8" className="py-12 text-center text-slate-500">
                    <Banknote className="w-8 h-8 mx-auto mb-2 text-slate-600 opacity-60" />
                    No COD settlements found.
                  </td>
                </tr>
              ) : (
                filteredSettlements.map((s) => (
                  <tr key={s.id} className="hover:bg-white/[0.02]">
                    <td className="py-2 px-3 font-mono font-bold text-white">
                      {s.settlement_number}
                    </td>

                    <td className="py-2 px-3 font-mono text-slate-400">
                      {s.tracking_number || `Shipment #${s.shipment_id}`}
                    </td>

                    <td className="py-2 px-3 font-bold text-white">
                      KES {(s.expected_amount || 0).toLocaleString()}
                    </td>

                    <td className="py-2 px-3 text-cyan-400 font-medium">
                      KES {(s.collected_amount || 0).toLocaleString()}
                    </td>

                    <td className="py-2 px-3 text-blue-400 font-medium">
                      KES {(s.remitted_amount || 0).toLocaleString()}
                    </td>

                    <td className="py-2 px-3 font-mono">
                      {Number(s.variance_amount) !== 0 ? (
                        <span className="text-rose-400 font-bold">
                          KES {Number(s.variance_amount).toLocaleString()}
                        </span>
                      ) : (
                        <span className="text-emerald-400">KES 0.00</span>
                      )}
                    </td>

                    <td className="py-2 px-3">
                      <span className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-bold border ${getStatusBadge(s.status)}`}>
                        {s.status}
                      </span>
                    </td>

                    <td className="py-2 px-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {s.status === 'COLLECTED' && (
                          <button
                            onClick={() => handleOpenRemit(s)}
                            className="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-[11px]"
                          >
                            Remit
                          </button>
                        )}

                        {s.status === 'REMITTED' && (
                          <button
                            onClick={() => handleOpenReconcile(s)}
                            className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px]"
                          >
                            Reconcile
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

      {/* Remit Modal */}
      {remitModalOpen && selectedSettlement && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-[#12161f] border border-[#222834] rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#222834] pb-3">
              <h3 className="font-bold text-white text-base">Record Cash Office Remittance</h3>
              <button onClick={() => setRemitModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleExecuteRemit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Settlement Number</label>
                <input
                  type="text"
                  disabled
                  value={selectedSettlement.settlement_number}
                  className="w-full px-3 py-2 bg-[#181d28] border border-[#222834] rounded-xl text-xs text-slate-400 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Remitted Amount (KES)</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={remitAmount}
                  onChange={(e) => setRemitAmount(e.target.value)}
                  className="w-full px-3 py-2 bg-[#181d28] border border-[#222834] rounded-xl text-xs text-white focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Remittance Method</label>
                <select
                  value={remitMethod}
                  onChange={(e) => setRemitMethod(e.target.value)}
                  className="w-full px-3 py-2 bg-[#181d28] border border-[#222834] rounded-xl text-xs text-white"
                >
                  <option value="CASH">Cash Office Depot</option>
                  <option value="MPESA">M-Pesa Business Till</option>
                  <option value="BANK_DEPOSIT">Bank Direct Deposit</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Deposit Slip / Transaction Ref</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. KCB-DEP-998822"
                  value={remitReference}
                  onChange={(e) => setRemitReference(e.target.value)}
                  className="w-full px-3 py-2 bg-[#181d28] border border-[#222834] rounded-xl text-xs text-white"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setRemitModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-[#181d28] text-xs font-semibold text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs font-bold text-white shadow"
                >
                  {submitting ? 'Recording...' : 'Confirm Remittance'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reconcile Modal (Rule BR-010) */}
      {reconcileModalOpen && selectedSettlement && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-[#12161f] border border-[#222834] rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#222834] pb-3">
              <h3 className="font-bold text-white text-base">Reconcile COD Settlement (Rule BR-010)</h3>
              <button onClick={() => setReconcileModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleExecuteReconcile} className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 bg-[#181d28] border border-[#222834] rounded-xl">
                  <p className="text-[10px] text-slate-500">Expected COD</p>
                  <p className="font-bold text-white mt-0.5">KES {selectedSettlement.expected_amount}</p>
                </div>
                <div className="p-3 bg-[#181d28] border border-[#222834] rounded-xl">
                  <p className="text-[10px] text-slate-500">Collected</p>
                  <p className="font-bold text-cyan-400 mt-0.5">KES {selectedSettlement.collected_amount}</p>
                </div>
              </div>

              {(selectedSettlement.collected_amount || 0) !== (selectedSettlement.expected_amount || 0) && (
                <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl space-y-1">
                  <p className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4" />
                    Rule BR-010: Variance Justification Required
                  </p>
                  <p className="text-[11px] text-slate-300">
                    A discrepancy of KES {Math.abs((selectedSettlement.collected_amount || 0) - (selectedSettlement.expected_amount || 0))} exists. You must provide a valid business explanation to reconcile.
                  </p>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Variance Justification {(selectedSettlement.collected_amount || 0) !== (selectedSettlement.expected_amount || 0) && <span className="text-rose-400">*</span>}
                </label>
                <textarea
                  rows="2"
                  placeholder="Explain any difference between expected and collected amount..."
                  value={reconcileVarianceReason}
                  onChange={(e) => setReconcileVarianceReason(e.target.value)}
                  className="w-full px-3 py-2 bg-[#181d28] border border-[#222834] rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Finance Approver Notes</label>
                <input
                  type="text"
                  placeholder="Reconciliation signoff notes..."
                  value={reconcileNotes}
                  onChange={(e) => setReconcileNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-[#181d28] border border-[#222834] rounded-xl text-xs text-white"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setReconcileModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-[#181d28] text-xs font-semibold text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-white shadow"
                >
                  {submitting ? 'Reconciling...' : 'Approve & Close'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
