// client/src/components/inventory/InventoryStocktakeModal.jsx
import React, { useState } from 'react';
import { X, ClipboardCheck, Play } from 'lucide-react';
import { api } from '../../services/api.js';
import { sound } from '../../services/sound.js';

export function InventoryStocktakeModal({ isOpen, onClose, warehouses = [], categories = [], onSuccess }) {
  const [warehouseId, setWarehouseId] = useState(warehouses[0]?.id || '');
  const [title, setTitle] = useState('');
  const [countType, setCountType] = useState('CYCLE_COUNT');
  const [categoryId, setCategoryId] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!warehouseId || !title.trim()) {
      api.toast('Warehouse and session title are required', 'warning');
      return;
    }

    try {
      setLoading(true);
      await api.post('/api/v1/inventory/stocktakes', {
        warehouse_id: Number(warehouseId),
        title: title.trim(),
        count_type: countType,
        category_id: categoryId ? Number(categoryId) : null,
        notes: notes.trim()
      });

      sound.playSuccess();
      api.toast('Stocktake session initiated (snapshot frozen)', 'success');
      onSuccess?.();
      onClose();
    } catch (err) {
      sound.playError();
      api.toast('Failed to start stocktake: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="bg-[#12161f] border border-[#222834] rounded-lg shadow-2xl max-w-md w-full font-mono text-xs overflow-hidden">
        <div className="p-3.5 border-b border-[#222834] bg-[#181d28] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded bg-indigo-500/10 border border-indigo-500/30 text-indigo-400">
              <ClipboardCheck className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white uppercase tracking-wider">Start Stocktake Audit</h2>
              <p className="text-[10px] text-slate-400">Freeze system snapshot & begin cycle count</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1 rounded hover:bg-[#202736]">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-3">
          <div>
            <label className="block text-[10px] text-slate-400 uppercase mb-1">Session Title *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. End of Month Beverage Audit..."
              className="w-full bg-[#181d28] border border-[#222834] rounded px-2 py-1.5 text-xs text-white"
              required
            />
          </div>

          <div>
            <label className="block text-[10px] text-slate-400 uppercase mb-1">Target Warehouse *</label>
            <select
              value={warehouseId}
              onChange={(e) => setWarehouseId(e.target.value)}
              className="w-full bg-[#181d28] border border-[#222834] rounded px-2 py-1.5 text-xs text-white"
              required
            >
              {warehouses.map(w => (
                <option key={w.id} value={w.id}>{w.branch_name ? `${w.branch_name} - ${w.name}` : w.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[10px] text-slate-400 uppercase mb-1">Count Methodology</label>
            <select
              value={countType}
              onChange={(e) => setCountType(e.target.value)}
              className="w-full bg-[#181d28] border border-[#222834] rounded px-2 py-1.5 text-xs text-white"
            >
              <option value="CYCLE_COUNT">Cycle Count (Continuous Sample)</option>
              <option value="FULL">Full Wall-to-Wall Physical Audit</option>
              <option value="CATEGORY">Category Targeted Count</option>
            </select>
          </div>

          <div>
            <label className="block text-[10px] text-slate-400 uppercase mb-1">Audit Notes / Scope</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Assigned counters: John & Mary..."
              className="w-full bg-[#181d28] border border-[#222834] rounded px-2 py-1.5 text-xs text-white"
            />
          </div>

          <div className="pt-3 border-t border-[#222834] flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded border border-[#222834] bg-[#181d28] text-slate-300 hover:bg-[#202736]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-1.5 rounded bg-indigo-500 hover:bg-indigo-400 text-white font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <Play className="w-3.5 h-3.5" />
              <span>{loading ? 'Starting...' : 'Freeze Snapshot & Start'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
