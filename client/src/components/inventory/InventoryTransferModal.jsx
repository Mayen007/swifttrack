// client/src/components/inventory/InventoryTransferModal.jsx
import React, { useState, useEffect } from 'react';
import { X, ArrowRightLeft, CheckCircle2, AlertCircle } from 'lucide-react';
import { api } from '../../services/api.js';
import { sound } from '../../services/sound.js';

export function InventoryTransferModal({
  isOpen,
  onClose,
  item = null,
  warehouses = [],
  branches = [],
  onSuccess,
}) {
  const [sourceWarehouseId, setSourceWarehouseId] = useState('');
  const [targetBranchId, setTargetBranchId] = useState('');
  const [targetWarehouseId, setTargetWarehouseId] = useState('');
  const [transferQty, setTransferQty] = useState('5');
  const [notes, setNotes] = useState('Scheduled transit to regional hub');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (item) {
      setSourceWarehouseId(String(item.warehouse_id || ''));
      const otherBranch = branches.find((b) => b.id !== item.branch_id);
      if (otherBranch) setTargetBranchId(String(otherBranch.id));
    }
  }, [item, branches, isOpen]);

  useEffect(() => {
    if (targetBranchId) {
      const branchWhs = warehouses.filter((w) => String(w.branch_id) === String(targetBranchId));
      if (branchWhs.length > 0) {
        setTargetWarehouseId(String(branchWhs[0].id));
      } else {
        setTargetWarehouseId('');
      }
    }
  }, [targetBranchId, warehouses]);

  if (!isOpen) return null;

  const targetWarehouses = warehouses.filter(
    (w) => String(w.branch_id) === String(targetBranchId) && String(w.id) !== String(sourceWarehouseId)
  );

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const qty = parseInt(transferQty, 10);
    if (!qty || qty <= 0) {
      setError('Please specify a positive transfer quantity.');
      return;
    }
    if (!sourceWarehouseId || !targetBranchId || !targetWarehouseId) {
      setError('Please select both source and target warehouse destinations.');
      return;
    }
    if (sourceWarehouseId === targetWarehouseId) {
      setError('Source and target warehouse must be distinct.');
      return;
    }

    try {
      setSubmitting(true);
      sound.playScan();

      const srcWh = warehouses.find((w) => String(w.id) === String(sourceWarehouseId));
      const sourceBranchId = srcWh ? srcWh.branch_id : item?.branch_id;

      await api.post('/api/v1/inventory/transfers', {
        source_branch_id: sourceBranchId,
        source_warehouse_id: parseInt(sourceWarehouseId, 10),
        target_branch_id: parseInt(targetBranchId, 10),
        target_warehouse_id: parseInt(targetWarehouseId, 10),
        items: [{ product_id: item.product_id, quantity: qty }],
        notes: notes.trim() || undefined,
      });

      sound.playSuccess();
      api.toast('Stock transfer request initiated successfully', 'success');
      onSuccess();
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to initiate transfer');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150 font-mono text-xs">
      <div className="bg-[#12161f] border border-[#2b3548] rounded w-full max-w-lg shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-[#222834] flex items-center justify-between bg-[#151a24]">
          <div>
            <span className="text-[10px] text-blue-400 font-bold uppercase">Transit Logistics</span>
            <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2 mt-0.5">
              <ArrowRightLeft className="w-4 h-4 text-blue-400" />
              Inter-Branch Stock Transfer
            </h2>
          </div>
          <button onClick={onClose} className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-4 space-y-3">
          {error && (
            <div className="p-2.5 rounded bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {item && (
            <div className="p-2.5 bg-[#181d28] rounded border border-[#222834] flex items-center justify-between">
              <div>
                <span className="font-bold text-white">{item.product_name}</span>
                <span className="text-[10px] text-slate-400 block">{item.sku}</span>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-slate-500 block">AVAILABLE</span>
                <span className="text-emerald-400 font-bold">{item.quantity_available} Units</span>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] text-slate-400 mb-1">Target Regional Branch *</label>
              <select
                required
                value={targetBranchId}
                onChange={(e) => setTargetBranchId(e.target.value)}
                className="w-full bg-[#181d28] border border-[#2b3548] rounded px-2.5 py-1.5 text-xs text-white focus:border-blue-500 focus:outline-none"
              >
                <option value="">Select Target Branch...</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[10px] text-slate-400 mb-1">Target Warehouse *</label>
              <select
                required
                value={targetWarehouseId}
                onChange={(e) => setTargetWarehouseId(e.target.value)}
                className="w-full bg-[#181d28] border border-[#2b3548] rounded px-2.5 py-1.5 text-xs text-white focus:border-blue-500 focus:outline-none"
              >
                <option value="">Select Warehouse...</option>
                {targetWarehouses.map((w) => (
                  <option key={w.id} value={w.id}>{w.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-[10px] text-slate-400 mb-1">Transfer Quantity (Units) *</label>
            <input
              type="number"
              min="1"
              required
              value={transferQty}
              onChange={(e) => setTransferQty(e.target.value)}
              className="w-full bg-[#181d28] border border-[#2b3548] rounded px-2.5 py-1.5 text-xs text-white font-bold focus:border-blue-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-[10px] text-slate-400 mb-1">Transit Routing Notes</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full bg-[#181d28] border border-[#2b3548] rounded px-2.5 py-1.5 text-xs text-white focus:border-blue-500 focus:outline-none"
            />
          </div>

          <div className="pt-2 border-t border-[#222834] flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded border border-[#2b3548] bg-[#181d28] hover:bg-[#202736] text-xs text-slate-300"
            >
              CANCEL
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-1.5 rounded bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>{submitting ? 'INITIATING...' : 'DISPATCH TRANSFER'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
