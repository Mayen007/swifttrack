// client/src/components/inventory/InventoryTransfersTable.jsx
import React, { useState } from 'react';
import {
  ArrowRightLeft,
  ArrowRight,
  CheckCircle2,
  Truck,
  Check,
  X,
  AlertTriangle,
  PackageCheck,
  ShieldAlert
} from 'lucide-react';
import { api } from '../../services/api.js';
import { sound } from '../../services/sound.js';

export function InventoryTransfersTable({
  loading,
  transfers = [],
  onRefresh,
}) {
  const [receivingTransfer, setReceivingTransfer] = useState(null);
  const [receivingItems, setReceivingItems] = useState([]);
  const [submittingReceive, setSubmittingReceive] = useState(false);

  if (loading) {
    return (
      <div className="bg-[#12161f] border border-[#222834] rounded p-8 flex flex-col items-center justify-center space-y-3 font-mono">
        <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        <span className="text-xs text-slate-400">Loading transfers...</span>
      </div>
    );
  }

  if (transfers.length === 0) {
    return (
      <div className="bg-[#12161f] border border-[#222834] rounded p-12 text-center font-mono">
        <ArrowRightLeft className="w-10 h-10 text-slate-600 mx-auto mb-3" />
        <h3 className="text-sm font-bold text-slate-200 uppercase">No Transfers Found</h3>
        <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1">
          No inter-branch transfers exist for this branch or filter.
        </p>
      </div>
    );
  }

  const handleAction = async (transferId, action) => {
    try {
      sound.playScan();
      await api.post(`/api/v1/inventory/transfers/${transferId}/status`, { action });
      sound.playSuccess();
      api.toast(`Transfer status updated (${action})`, 'success');
      onRefresh();
    } catch (err) {
      sound.playAlert();
      api.toast(err.message || 'Action failed', 'error');
    }
  };

  const handleOpenReceiveModal = (transfer) => {
    setReceivingTransfer(transfer);
    const initialItems = (transfer.items || []).map((it) => {
      const sent = it.quantity_sent || it.quantity_requested || 0;
      return {
        item_id: it.id,
        product_name: it.product_name || `Product #${it.product_id}`,
        sku: it.sku || 'N/A',
        unit: it.unit || 'pcs',
        quantity_sent: sent,
        quantity_received: sent,
        discrepancy_reason: ''
      };
    });
    setReceivingItems(initialItems);
    sound.playClick();
  };

  const handleItemQtyChange = (itemId, val) => {
    const num = Math.max(0, parseInt(val, 10) || 0);
    setReceivingItems((prev) =>
      prev.map((item) =>
        item.item_id === itemId ? { ...item, quantity_received: num } : item
      )
    );
  };

  const handleItemReasonChange = (itemId, reason) => {
    setReceivingItems((prev) =>
      prev.map((item) =>
        item.item_id === itemId ? { ...item, discrepancy_reason: reason } : item
      )
    );
  };

  const totalSent = receivingItems.reduce((acc, it) => acc + it.quantity_sent, 0);
  const totalReceived = receivingItems.reduce((acc, it) => acc + it.quantity_received, 0);
  const totalShortage = Math.max(0, totalSent - totalReceived);
  const hasShortage = totalShortage > 0;

  const handleConfirmReceive = async (e) => {
    e.preventDefault();
    if (!receivingTransfer) return;
    setSubmittingReceive(true);
    try {
      sound.playScan();
      const payload = {
        action: 'RECEIVE',
        received_items: receivingItems.map((it) => ({
          item_id: it.item_id,
          quantity_received: it.quantity_received,
          discrepancy_reason: it.quantity_received < it.quantity_sent ? (it.discrepancy_reason || 'Transit shortage') : undefined
        }))
      };
      await api.post(`/api/v1/inventory/transfers/${receivingTransfer.id}/status`, payload);
      sound.playSuccess();
      api.toast(
        `Transfer #${receivingTransfer.transfer_number} verified & accepted into warehouse inventory${hasShortage ? ` (Shortage of ${totalShortage} units recorded)` : ''}`,
        'success'
      );
      setReceivingTransfer(null);
      onRefresh();
    } catch (err) {
      sound.playAlert();
      api.toast(err.message || 'Receive verification failed', 'error');
    } finally {
      setSubmittingReceive(false);
    }
  };

  const getStatusStyle = (st) => {
    switch (st) {
      case 'RECEIVED':
      case 'COMPLETED':
        return 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300';
      case 'IN_TRANSIT':
        return 'bg-blue-500/15 border-blue-500/30 text-blue-300 animate-pulse';
      case 'APPROVED':
        return 'bg-amber-500/15 border-amber-500/30 text-amber-300';
      case 'PENDING_APPROVAL':
        return 'bg-yellow-500/15 border-yellow-500/30 text-yellow-300';
      default:
        return 'bg-slate-800 border-slate-700 text-slate-300';
    }
  };

  return (
    <div className="bg-[#12161f] border border-[#222834] rounded overflow-hidden font-mono">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[850px] text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-[#222834] bg-[#0e121a] text-slate-400 text-[10px] uppercase tracking-wider">
              <th className="py-2.5 px-3 whitespace-nowrap">Transfer #</th>
              <th className="py-2.5 px-3 min-w-[160px]">Source Route</th>
              <th className="py-2.5 px-3 min-w-[160px]">Target Route</th>
              <th className="py-2.5 px-3 min-w-[200px]">Items Manifest</th>
              <th className="py-2.5 px-3 text-center whitespace-nowrap">Status</th>
              <th className="py-2.5 px-3 text-right whitespace-nowrap">Workflow Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#1e2430]">
            {transfers.map((t) => (
              <tr key={t.id} className="hover:bg-[#181d28]/70 transition-colors">
                <td className="py-2.5 px-3 whitespace-nowrap">
                  <div className="font-bold text-blue-400">{t.transfer_number}</div>
                  <div className="text-[10px] text-slate-500">{t.created_at?.slice(0, 10)}</div>
                </td>
                <td className="py-2.5 px-3 max-w-[180px]">
                  <div className="font-semibold text-white truncate" title={t.source_branch_name}>{t.source_branch_name}</div>
                  <div className="text-[10px] text-slate-400 truncate" title={t.source_warehouse_name}>{t.source_warehouse_name}</div>
                </td>
                <td className="py-2.5 px-3 max-w-[180px]">
                  <div className="font-semibold text-white truncate" title={t.target_branch_name}>{t.target_branch_name}</div>
                  <div className="text-[10px] text-slate-400 truncate" title={t.target_warehouse_name}>{t.target_warehouse_name}</div>
                </td>
                <td className="py-2.5 px-3 max-w-[260px]">
                  <div className="text-slate-300 truncate" title={t.items?.map((it) => `${it.product_name} (${it.quantity_requested || it.quantity} ${it.unit || 'pcs'})`).join(', ')}>
                    {t.items?.map((it) => `${it.product_name} (${it.quantity_requested || it.quantity} ${it.unit || 'pcs'})`).join(', ') || 'Items'}
                  </div>
                  {t.notes && <div className="text-[10px] text-slate-500 truncate max-w-xs">{t.notes}</div>}
                </td>
                <td className="py-2.5 px-3 text-center whitespace-nowrap">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${getStatusStyle(t.status)}`}>
                    {t.status}
                  </span>
                </td>
                <td className="py-2.5 px-3 text-right whitespace-nowrap">
                  <div className="inline-flex items-center gap-1.5">
                    {t.status === 'PENDING_APPROVAL' && (
                      <button
                        onClick={() => handleAction(t.id, 'APPROVE')}
                        className="px-2 py-1 rounded bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-[10px] flex items-center gap-1 cursor-pointer"
                      >
                        <Check className="w-3 h-3 stroke-[3]" />
                        APPROVE
                      </button>
                    )}

                    {(t.status === 'APPROVED' || t.status === 'PENDING_APPROVAL') && (
                      <button
                        onClick={() => handleAction(t.id, 'DISPATCH')}
                        className="px-2 py-1 rounded bg-blue-600 hover:bg-blue-500 text-white font-bold text-[10px] flex items-center gap-1 cursor-pointer"
                      >
                        <Truck className="w-3 h-3" />
                        DISPATCH (TRANSIT)
                      </button>
                    )}

                    {t.status === 'IN_TRANSIT' && (
                      <button
                        onClick={() => handleOpenReceiveModal(t)}
                        className="px-2.5 py-1 rounded bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-[10px] flex items-center gap-1.5 shadow cursor-pointer"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5 stroke-[2.5]" />
                        RECEIVE STOCK
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Stock Transfer Receiving Verification Modal */}
      {receivingTransfer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 font-mono">
          <div className="w-full max-w-2xl bg-[#12161f] border border-[#222834] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="p-4 sm:p-5 border-b border-[#222834] flex items-center justify-between bg-[#161c28]">
              <div>
                <div className="flex items-center gap-2">
                  <PackageCheck className="w-5 h-5 text-emerald-400" />
                  <h3 className="font-bold text-white text-sm uppercase tracking-wider">
                    Verify Inter-Hub Stock Receipt
                  </h3>
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  Transfer <span className="text-blue-400 font-bold">{receivingTransfer.transfer_number}</span> • Inbound to{' '}
                  <span className="text-white font-semibold">{receivingTransfer.target_warehouse_name}</span>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setReceivingTransfer(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/5 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Route Summary */}
            <div className="px-5 py-3 bg-[#0d1017] border-b border-[#222834] grid grid-cols-2 gap-4 text-xs">
              <div>
                <span className="text-[10px] text-slate-500 uppercase font-bold">Source Route</span>
                <div className="text-slate-200 font-semibold truncate">{receivingTransfer.source_branch_name}</div>
                <div className="text-[10px] text-slate-400 truncate">{receivingTransfer.source_warehouse_name}</div>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 uppercase font-bold">Receiving Destination</span>
                <div className="text-emerald-300 font-semibold truncate">{receivingTransfer.target_branch_name}</div>
                <div className="text-[10px] text-slate-400 truncate">{receivingTransfer.target_warehouse_name}</div>
              </div>
            </div>

            {/* Itemized Verification Form */}
            <form onSubmit={handleConfirmReceive} className="flex-1 overflow-y-auto p-5 space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-400 font-bold uppercase tracking-wider">
                  <span>Manifested Items ({receivingItems.length})</span>
                  <span>Physical Count</span>
                </div>

                <div className="space-y-3">
                  {receivingItems.map((item) => {
                    const isShort = item.quantity_received < item.quantity_sent;
                    return (
                      <div
                        key={item.item_id}
                        className={`p-3.5 rounded-xl border transition-colors ${
                          isShort
                            ? 'bg-amber-500/5 border-amber-500/30'
                            : 'bg-[#181d28] border-[#222834]'
                        }`}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div className="space-y-0.5">
                            <div className="font-bold text-white text-xs">{item.product_name}</div>
                            <div className="text-[10px] text-slate-400">
                              SKU: <span className="font-mono text-slate-300">{item.sku}</span> • Manifested:{' '}
                              <span className="text-white font-bold">{item.quantity_sent} {item.unit}</span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <label className="text-[10px] text-slate-400 uppercase font-semibold">Qty Received:</label>
                            <input
                              type="number"
                              min="0"
                              max={item.quantity_sent}
                              value={item.quantity_received}
                              onChange={(e) => handleItemQtyChange(item.item_id, e.target.value)}
                              className={`w-20 px-2.5 py-1.5 rounded-lg text-center font-bold text-xs bg-[#0b0e14] border focus:outline-none ${
                                isShort
                                  ? 'border-amber-500 text-amber-400 focus:border-amber-400'
                                  : 'border-[#222834] text-emerald-400 focus:border-emerald-500'
                              }`}
                            />
                            <span className="text-[11px] text-slate-400">{item.unit}</span>
                          </div>
                        </div>

                        {/* Shortage / Discrepancy Note Input */}
                        {isShort && (
                          <div className="mt-3 pt-2.5 border-t border-amber-500/20 space-y-1.5">
                            <div className="flex items-center gap-1.5 text-[10px] text-amber-400 font-bold uppercase">
                              <ShieldAlert className="w-3.5 h-3.5" />
                              Shortage Variance: {item.quantity_sent - item.quantity_received} {item.unit} Missing / Damaged
                            </div>
                            <input
                              type="text"
                              required={isShort}
                              placeholder="Reason for discrepancy (e.g. Broken in transit, carton missing)..."
                              value={item.discrepancy_reason}
                              onChange={(e) => handleItemReasonChange(item.item_id, e.target.value)}
                              className="w-full px-3 py-1.5 bg-[#0b0e14] border border-amber-500/40 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Aggregation Banner */}
              <div
                className={`p-3.5 rounded-xl border flex items-center justify-between text-xs ${
                  hasShortage
                    ? 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                    : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                }`}
              >
                <div className="flex items-center gap-2">
                  {hasShortage ? (
                    <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  )}
                  <span>
                    {hasShortage
                      ? `Discrepancy Detected: Receiving ${totalReceived} of ${totalSent} items (${totalShortage} shortage units logged to audit).`
                      : `Full Order Verified: 100% match (${totalReceived} of ${totalSent} items received intact).`}
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[#222834]">
                <button
                  type="button"
                  onClick={() => setReceivingTransfer(null)}
                  className="px-4 py-2 rounded-xl bg-[#181d28] hover:bg-[#202738] text-slate-300 text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingReceive}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold text-xs flex items-center gap-2 shadow-lg shadow-emerald-600/20 cursor-pointer disabled:opacity-50"
                >
                  {submittingReceive ? (
                    <span>Updating Inventory...</span>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4 stroke-[2.5]" />
                      <span>CONFIRM RECEIPT & UPDATE ON-HAND</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
