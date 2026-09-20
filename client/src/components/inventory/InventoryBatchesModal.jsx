// client/src/components/inventory/InventoryBatchesModal.jsx
import React, { useState, useEffect } from 'react';
import { X, Calendar, AlertCircle, Plus, CheckCircle, Clock } from 'lucide-react';
import { api } from '../../services/api.js';

export function InventoryBatchesModal({ isOpen, onClose, item, onBatchUpdated }) {
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [evaluating, setEvaluating] = useState(false);

  const [newBatch, setNewBatch] = useState({
    batch_number: '',
    initial_quantity: '',
    unit_cost: '',
    manufacturing_date: '',
    expiry_date: '',
    notes: ''
  });

  useEffect(() => {
    if (isOpen && item) {
      loadBatches();
    }
  }, [isOpen, item]);

  async function loadBatches() {
    try {
      setLoading(true);
      const data = await api.get(`/api/v1/inventory/batches?product_id=${item.product_id}&warehouse_id=${item.warehouse_id}`);
      setBatches(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to load batches:', err);
      api.toast('Error loading batches: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateBatch(e) {
    e.preventDefault();
    if (!newBatch.batch_number || !newBatch.initial_quantity) {
      api.toast('Batch number and quantity are required', 'warning');
      return;
    }

    try {
      await api.post('/api/v1/inventory/batches', {
        product_id: item.product_id,
        warehouse_id: item.warehouse_id,
        branch_id: item.branch_id,
        batch_number: newBatch.batch_number.trim(),
        initial_quantity: Number(newBatch.initial_quantity),
        unit_cost: Number(newBatch.unit_cost) || 0,
        manufacturing_date: newBatch.manufacturing_date || null,
        expiry_date: newBatch.expiry_date || null,
        notes: newBatch.notes
      });
      api.toast('Batch lot created successfully', 'success');
      setShowAddForm(false);
      setNewBatch({
        batch_number: '',
        initial_quantity: '',
        unit_cost: '',
        manufacturing_date: '',
        expiry_date: '',
        notes: ''
      });
      loadBatches();
      if (onBatchUpdated) onBatchUpdated();
    } catch (err) {
      api.toast('Failed to create batch: ' + err.message, 'error');
    }
  }

  async function handleEvaluateExpiries() {
    try {
      setEvaluating(true);
      const res = await api.post('/api/v1/inventory/batches/evaluate-expiries', {
        warehouse_id: item.warehouse_id,
        branch_id: item.branch_id
      });
      api.toast(res.message || 'Expiries evaluated successfully', 'success');
      loadBatches();
      if (onBatchUpdated) onBatchUpdated();
    } catch (err) {
      api.toast('Evaluation failed: ' + err.message, 'error');
    } finally {
      setEvaluating(false);
    }
  }

  if (!isOpen || !item) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-[#12161f] border border-[#222834] rounded-lg w-full max-w-3xl shadow-2xl font-mono text-xs overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#222834] bg-[#0e121a]">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-500/20 text-purple-400 border border-purple-500/30">
                BATCH / LOT TRACKING
              </span>
              <h2 className="text-sm font-bold text-white uppercase">{item.product_name}</h2>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              SKU: <span className="text-emerald-400 font-semibold">{item.sku}</span> | Hub:{' '}
              <span className="text-slate-200">{item.warehouse_name}</span>
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded text-slate-400 hover:text-white hover:bg-[#1f2636] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Action Controls */}
        <div className="px-5 py-3 border-b border-[#222834] bg-[#151923] flex items-center justify-between gap-3">
          <div className="text-[11px] text-slate-400">
            Total Available: <span className="text-emerald-400 font-bold">{item.quantity_available ?? 0}</span> | Batches Active:{' '}
            <span className="text-white font-bold">{batches.filter(b => b.status === 'ACTIVE').length}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleEvaluateExpiries}
              disabled={evaluating}
              className="px-3 py-1.5 rounded bg-red-950/60 border border-red-500/40 text-red-300 hover:bg-red-900/60 font-semibold text-[11px] flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
            >
              <Clock className="w-3.5 h-3.5" />
              {evaluating ? 'Evaluating...' : 'Evaluate Expiries'}
            </button>
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className="px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold text-[11px] flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              {showAddForm ? 'Cancel' : 'New Batch'}
            </button>
          </div>
        </div>

        {/* New Batch Inline Form */}
        {showAddForm && (
          <form onSubmit={handleCreateBatch} className="p-4 bg-[#181d28] border-b border-[#222834] grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-[10px] text-slate-400 uppercase font-semibold mb-1">Batch / Lot # *</label>
              <input
                type="text"
                required
                value={newBatch.batch_number}
                onChange={e => setNewBatch({ ...newBatch, batch_number: e.target.value })}
                placeholder="e.g. LOT-2026-001"
                className="w-full bg-[#12161f] border border-[#2e3748] rounded px-2.5 py-1.5 text-xs text-white"
              />
            </div>
            <div>
              <label className="block text-[10px] text-slate-400 uppercase font-semibold mb-1">Initial Qty *</label>
              <input
                type="number"
                required
                min="1"
                value={newBatch.initial_quantity}
                onChange={e => setNewBatch({ ...newBatch, initial_quantity: e.target.value })}
                placeholder="Units"
                className="w-full bg-[#12161f] border border-[#2e3748] rounded px-2.5 py-1.5 text-xs text-white"
              />
            </div>
            <div>
              <label className="block text-[10px] text-slate-400 uppercase font-semibold mb-1">Unit Cost (KES)</label>
              <input
                type="number"
                step="0.01"
                value={newBatch.unit_cost}
                onChange={e => setNewBatch({ ...newBatch, unit_cost: e.target.value })}
                placeholder="KES cost"
                className="w-full bg-[#12161f] border border-[#2e3748] rounded px-2.5 py-1.5 text-xs text-white"
              />
            </div>
            <div>
              <label className="block text-[10px] text-slate-400 uppercase font-semibold mb-1">Mfg Date</label>
              <input
                type="date"
                value={newBatch.manufacturing_date}
                onChange={e => setNewBatch({ ...newBatch, manufacturing_date: e.target.value })}
                className="w-full bg-[#12161f] border border-[#2e3748] rounded px-2.5 py-1.5 text-xs text-white"
              />
            </div>
            <div>
              <label className="block text-[10px] text-slate-400 uppercase font-semibold mb-1">Expiry Date</label>
              <input
                type="date"
                value={newBatch.expiry_date}
                onChange={e => setNewBatch({ ...newBatch, expiry_date: e.target.value })}
                className="w-full bg-[#12161f] border border-[#2e3748] rounded px-2.5 py-1.5 text-xs text-white"
              />
            </div>
            <div className="flex items-end">
              <button
                type="submit"
                className="w-full py-1.5 rounded bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs transition-colors cursor-pointer"
              >
                Save Lot
              </button>
            </div>
          </form>
        )}

        {/* Batch List Table */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="py-12 text-center text-slate-400">Loading batch records...</div>
          ) : batches.length === 0 ? (
            <div className="py-12 text-center text-slate-500">
              <Calendar className="w-8 h-8 mx-auto mb-2 opacity-50" />
              No specific batch lots recorded for this product yet.
            </div>
          ) : (
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-[#222834] text-slate-400 text-[10px] uppercase">
                  <th className="pb-2">Batch #</th>
                  <th className="pb-2 text-right">Available</th>
                  <th className="pb-2 text-right">Initial</th>
                  <th className="pb-2 text-right">Unit Cost</th>
                  <th className="pb-2">Expiry Date</th>
                  <th className="pb-2 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1e2430]">
                {batches.map(b => {
                  const isExpired = b.status === 'EXPIRED' || (b.expiry_date && new Date(b.expiry_date) < new Date());
                  return (
                    <tr key={b.id} className="hover:bg-[#181d28]/60">
                      <td className="py-2.5 font-bold text-slate-200">{b.batch_number}</td>
                      <td className="py-2.5 text-right font-bold text-emerald-400">{b.quantity_available}</td>
                      <td className="py-2.5 text-right text-slate-400">{b.initial_quantity}</td>
                      <td className="py-2.5 text-right text-slate-300">KES {(b.unit_cost || 0).toFixed(2)}</td>
                      <td className="py-2.5">
                        {b.expiry_date ? (
                          <span className={`px-1.5 py-0.5 rounded text-[10px] ${isExpired ? 'bg-red-500/20 text-red-300' : 'text-slate-300'}`}>
                            {b.expiry_date}
                          </span>
                        ) : (
                          <span className="text-slate-600">No Expiry</span>
                        )}
                      </td>
                      <td className="py-2.5 text-center">
                        <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                          b.status === 'ACTIVE'
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                            : b.status === 'EXPIRED'
                            ? 'bg-red-500/20 text-red-300 border border-red-500/30'
                            : 'bg-slate-500/20 text-slate-400'
                        }`}>
                          {b.status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
