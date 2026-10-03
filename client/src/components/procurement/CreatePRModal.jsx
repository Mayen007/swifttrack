import React, { useState } from 'react';
import {
  FileText,
  Plus,
  X
} from 'lucide-react';
import { api } from '../../services/api.js';

export function CreatePRModal({ onClose, onSuccess, productsList, user, selectedBranch }) {
  const [urgency, setUrgency] = useState('MEDIUM');
  const [neededByDate, setNeededByDate] = useState('');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState([
    { product_id: productsList[0]?.id || '', quantity: 10, unit_cost: productsList[0]?.cost_price || 0 }
  ]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleAddItem = () => {
    setItems([...items, { product_id: productsList[0]?.id || '', quantity: 10, unit_cost: productsList[0]?.cost_price || 0 }]);
  };

  const handleItemChange = (index, field, value) => {
    const updated = [...items];
    updated[index][field] = value;
    if (field === 'product_id') {
      const p = productsList.find(x => x.id === Number(value));
      if (p) updated[index].unit_cost = p.cost_price || 0;
    }
    setItems(updated);
  };

  const handleRemoveItem = (index) => {
    if (items.length <= 1) return;
    setItems(items.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const effectiveBranchId = user?.branch_id || selectedBranch?.id || (typeof selectedBranch === 'number' ? selectedBranch : 1);
      await api.post('/api/v1/procurement/requisitions', {
        branch_id: effectiveBranchId,
        urgency,
        needed_by_date: neededByDate || null,
        notes,
        items: items.map(it => ({
          product_id: Number(it.product_id),
          quantity: Number(it.quantity),
          unit_cost: Number(it.unit_cost)
        }))
      });
      onSuccess();
    } catch (err) {
      setError(err.message || 'Failed to submit requisition');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#12161f] border border-slate-800 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150">
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <h3 className="font-semibold text-white text-sm flex items-center gap-2">
            <FileText className="w-4 h-4 text-amber-400" />
            Raise Purchase Requisition (PR)
          </h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-800 text-slate-400">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs rounded-lg">{error}</div>}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-mono text-slate-400 mb-1">Urgency Level</label>
              <select
                value={urgency}
                onChange={(e) => setUrgency(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white"
              >
                <option value="LOW">Low Urgency</option>
                <option value="MEDIUM">Medium Urgency</option>
                <option value="HIGH">High Urgency</option>
                <option value="CRITICAL">Critical Restock</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-mono text-slate-400 mb-1">Needed By Date</label>
              <input
                type="date"
                value={neededByDate}
                onChange={(e) => setNeededByDate(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-[11px] font-mono text-slate-400">Requested Items</label>
              <button
                type="button"
                onClick={handleAddItem}
                className="text-xs text-amber-400 hover:text-amber-300 font-medium flex items-center gap-1"
              >
                <Plus className="w-3 h-3" /> Add Item
              </button>
            </div>

            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {items.map((it, idx) => (
                <div key={idx} className="flex items-center gap-2 bg-slate-900/60 p-2 rounded-lg border border-slate-800">
                  <select
                    value={it.product_id}
                    onChange={(e) => handleItemChange(idx, 'product_id', e.target.value)}
                    className="flex-1 px-2.5 py-1.5 rounded bg-slate-900 border border-slate-700 text-xs text-white"
                  >
                    {productsList.map(p => (
                      <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min="1"
                    value={it.quantity}
                    onChange={(e) => handleItemChange(idx, 'quantity', e.target.value)}
                    placeholder="Qty"
                    className="w-20 px-2 py-1.5 rounded bg-slate-900 border border-slate-700 text-xs text-white font-mono"
                  />
                  <input
                    type="number"
                    step="0.01"
                    value={it.unit_cost}
                    onChange={(e) => handleItemChange(idx, 'unit_cost', e.target.value)}
                    placeholder="Cost"
                    className="w-28 px-2 py-1.5 rounded bg-slate-900 border border-slate-700 text-xs text-white font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => handleRemoveItem(idx)}
                    className="p-1 text-slate-500 hover:text-rose-400"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-mono text-slate-400 mb-1">Reason / Internal Notes</label>
            <textarea
              rows="2"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Why are these goods needed..."
              className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white"
            />
          </div>

          <div className="pt-3 border-t border-slate-800 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-slate-800 text-slate-300 text-xs font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-950 font-semibold text-xs transition-colors"
            >
              {submitting ? 'Creating...' : 'Submit Requisition'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

