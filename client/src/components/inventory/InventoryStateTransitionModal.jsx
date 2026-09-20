// client/src/components/inventory/InventoryStateTransitionModal.jsx
import React, { useState, useEffect } from 'react';
import { X, ShieldAlert, AlertTriangle, RotateCcw, Trash2, CheckCircle2, AlertCircle } from 'lucide-react';
import { api } from '../../services/api.js';
import { sound } from '../../services/sound.js';

export function InventoryStateTransitionModal({
  isOpen,
  onClose,
  item = null,
  initialMode = 'QUARANTINE', // 'QUARANTINE', 'EXPIRE', 'RESTORE', 'WRITEOFF'
  onSuccess,
}) {
  const [mode, setMode] = useState(initialMode);
  const [quantity, setQuantity] = useState('1');
  const [fromState, setFromState] = useState('DAMAGED');
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setMode(initialMode);
    setQuantity('1');
    setError('');
    if (initialMode === 'QUARANTINE') {
      setReason('Crushed outer carton during unloading');
    } else if (initialMode === 'EXPIRE') {
      setReason('Passed manufacturer expiration date');
    } else if (initialMode === 'WRITEOFF') {
      setReason('Certified disposal / written off to scrap');
    } else {
      setReason('Re-inspected and cleared for sale');
    }
  }, [initialMode, isOpen, item]);

  if (!isOpen || !item) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    const qty = parseInt(quantity, 10);
    if (!qty || qty <= 0) {
      setError('Please specify a positive unit quantity.');
      return;
    }

    try {
      setSubmitting(true);
      sound.playScan();

      let endpoint = '/api/v1/inventory/states/quarantine';
      let payload = {
        warehouse_id: item.warehouse_id,
        product_id: item.product_id,
        quantity: qty,
        reason: reason.trim() || undefined,
      };

      if (mode === 'EXPIRE') {
        endpoint = '/api/v1/inventory/states/expire';
      } else if (mode === 'RESTORE') {
        endpoint = '/api/v1/inventory/states/restore';
        payload.from_state = fromState;
      } else if (mode === 'WRITEOFF') {
        endpoint = '/api/v1/inventory/states/write-off';
        payload.from_state = fromState;
      }

      await api.post(endpoint, payload);
      sound.playSuccess();
      api.toast(`Inventory state updated successfully (${mode})`, 'success');
      onSuccess();
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to execute state transition');
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
            <div className="flex items-center gap-2 text-[10px]">
              <span className="text-emerald-400 font-bold uppercase">{item.sku}</span>
              <span className="text-slate-400">/</span>
              <span className="text-slate-300">{item.product_name}</span>
            </div>
            <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2 mt-0.5">
              <ShieldAlert className="w-4 h-4 text-rose-400" />
              Inventory State Machine Transition
            </h2>
          </div>
          <button onClick={onClose} className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Mode Selector Tabs */}
        <div className="grid grid-cols-4 border-b border-[#222834] bg-[#0c0e12] text-[10px] font-bold">
          <button
            type="button"
            onClick={() => setMode('QUARANTINE')}
            className={`py-2 px-1 text-center border-b-2 transition-colors cursor-pointer ${
              mode === 'QUARANTINE' ? 'border-rose-400 text-rose-300 bg-rose-950/20' : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            QUARANTINE
          </button>
          <button
            type="button"
            onClick={() => setMode('EXPIRE')}
            className={`py-2 px-1 text-center border-b-2 transition-colors cursor-pointer ${
              mode === 'EXPIRE' ? 'border-red-400 text-red-300 bg-red-950/20' : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            EXPIRE
          </button>
          <button
            type="button"
            onClick={() => setMode('RESTORE')}
            className={`py-2 px-1 text-center border-b-2 transition-colors cursor-pointer ${
              mode === 'RESTORE' ? 'border-emerald-400 text-emerald-300 bg-emerald-950/20' : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            RESTORE
          </button>
          <button
            type="button"
            onClick={() => setMode('WRITEOFF')}
            className={`py-2 px-1 text-center border-b-2 transition-colors cursor-pointer ${
              mode === 'WRITEOFF' ? 'border-amber-400 text-amber-300 bg-amber-950/20' : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            WRITE-OFF
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-4 space-y-3">
          {error && (
            <div className="p-2.5 rounded bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Current Balance Snapshot */}
          <div className="bg-[#181d28] p-2.5 rounded border border-[#222834] grid grid-cols-4 gap-2 text-[10px]">
            <div>
              <span className="text-slate-500 block">ON HAND</span>
              <span className="text-white font-bold">{item.quantity_on_hand}</span>
            </div>
            <div>
              <span className="text-slate-500 block">AVAILABLE</span>
              <span className="text-emerald-400 font-bold">{item.quantity_available}</span>
            </div>
            <div>
              <span className="text-slate-500 block">DAMAGED</span>
              <span className="text-rose-400 font-bold">{item.quantity_damaged}</span>
            </div>
            <div>
              <span className="text-slate-500 block">EXPIRED</span>
              <span className="text-red-400 font-bold">{item.quantity_expired}</span>
            </div>
          </div>

          {(mode === 'RESTORE' || mode === 'WRITEOFF') && (
            <div>
              <label className="block text-[10px] text-slate-400 mb-1">Source State</label>
              <select
                value={fromState}
                onChange={(e) => setFromState(e.target.value)}
                className="w-full bg-[#181d28] border border-[#2b3548] rounded px-2.5 py-1.5 text-xs text-white focus:border-emerald-500 focus:outline-none"
              >
                <option value="DAMAGED">From DAMAGED Quarantine (Pool: {item.quantity_damaged})</option>
                <option value="EXPIRED">From EXPIRED Segregation (Pool: {item.quantity_expired})</option>
              </select>
            </div>
          )}

          <div>
            <label className="block text-[10px] text-slate-400 mb-1">Quantity (Units) *</label>
            <input
              type="number"
              min="1"
              required
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className="w-full bg-[#181d28] border border-[#2b3548] rounded px-2.5 py-1.5 text-xs text-white font-bold focus:border-emerald-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-[10px] text-slate-400 mb-1">Reason / Inspection Finding *</label>
            <input
              type="text"
              required
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full bg-[#181d28] border border-[#2b3548] rounded px-2.5 py-1.5 text-xs text-white focus:border-emerald-500 focus:outline-none"
            />
          </div>

          {/* Footer Actions */}
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
              className="px-4 py-1.5 rounded bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>{submitting ? 'EXECUTING...' : 'CONFIRM TRANSITION'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
