import React, { useState } from 'react';
import { X, ArrowRightLeft, ShieldCheck, UserCheck, AlertCircle } from 'lucide-react';
import { api } from '../../services/api.js';
import { sound } from '../../services/sound.js';

export function RecordHandoffModal({
  isOpen,
  onClose,
  onSuccess,
  currentHubId = 1,
  currentUser = null
}) {
  const [trackingNumber, setTrackingNumber] = useState('');
  const [handoffType, setHandoffType] = useState('HUB_TO_DRIVER');
  const [releasingActorType, setReleasingActorType] = useState('AGENT');
  const [releasingActorName, setReleasingActorName] = useState(currentUser?.full_name || currentUser?.username || 'Station Agent');
  const [receivingActorType, setReceivingActorType] = useState('DRIVER');
  const [receivingActorName, setReceivingActorName] = useState('');
  const [sealNumber, setSealNumber] = useState('');
  const [packageCondition, setPackageCondition] = useState('GOOD');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!trackingNumber.trim()) {
      setError('Tracking number or waybill is required');
      return;
    }
    if (!receivingActorName.trim()) {
      setError('Receiving actor name is required');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      const payload = {
        tracking_number: trackingNumber.trim().toUpperCase(),
        handoff_type: handoffType,
        hub_id: currentHubId,
        releasing_actor_type: releasingActorType,
        releasing_actor_name: releasingActorName.trim(),
        receiving_actor_type: receivingActorType,
        receiving_actor_name: receivingActorName.trim(),
        seal_number: sealNumber.trim() || undefined,
        package_condition: packageCondition,
        notes: notes.trim() || undefined
      };

      const res = await api.post('/api/custody/handoffs', payload);
      sound.playSuccess();
      api.toast(`Custody transfer #${res.handoff_number || res.id} recorded`, 'success');
      
      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      sound.playError();
      setError(err.message || 'Failed to record custody handoff');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#121622] border border-[#2a3447] rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#222834] flex items-center justify-between bg-[#161c28]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-blue-500/10 border border-blue-500/30 text-blue-400">
              <ArrowRightLeft className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-wide">Record Custody Handoff</h2>
              <p className="text-xs text-slate-400">Formal physical custody transfer between transport actors</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1">
          {error && (
            <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 flex items-center gap-2 text-rose-400 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Tracking Number */}
          <div>
            <label className="block text-xs font-mono uppercase tracking-wider text-slate-300 font-semibold mb-1.5">
              Shipment Waybill / Tracking # *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. SWT-2026-NBI-00124"
              value={trackingNumber}
              onChange={(e) => setTrackingNumber(e.target.value)}
              className="w-full bg-[#181d28] border border-[#2b3548] rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* Transfer Type */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-mono uppercase tracking-wider text-slate-300 font-semibold mb-1.5">
                Transfer Type
              </label>
              <select
                value={handoffType}
                onChange={(e) => setHandoffType(e.target.value)}
                className="w-full bg-[#181d28] border border-[#2b3548] rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
              >
                <option value="HUB_TO_DRIVER">Hub to Driver (Outbound)</option>
                <option value="DRIVER_TO_HUB">Driver to Hub (Inbound)</option>
                <option value="HUB_TRANSFER">Hub Internal Transfer</option>
                <option value="COURIER_HANDOFF">Courier Last-Mile Handoff</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-mono uppercase tracking-wider text-slate-300 font-semibold mb-1.5">
                Package Condition
              </label>
              <select
                value={packageCondition}
                onChange={(e) => setPackageCondition(e.target.value)}
                className="w-full bg-[#181d28] border border-[#2b3548] rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
              >
                <option value="GOOD">Good / Intact</option>
                <option value="DAMAGED">Damaged / Torn</option>
                <option value="OPENED">Opened / Inspected</option>
                <option value="TAMPERED">Tampered / Broken Seal</option>
              </select>
            </div>
          </div>

          {/* Releasing Party */}
          <div className="p-3 bg-[#161c28] border border-[#222834] rounded-xl space-y-2.5">
            <span className="text-[11px] font-mono uppercase font-bold text-slate-400 block">Releasing Party</span>
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block text-[10px] text-slate-400 mb-1">Actor Type</label>
                <select
                  value={releasingActorType}
                  onChange={(e) => setReleasingActorType(e.target.value)}
                  className="w-full bg-[#181d28] border border-[#2b3548] rounded px-2.5 py-1.5 text-xs text-slate-200"
                >
                  <option value="AGENT">Station Agent</option>
                  <option value="DRIVER">Fleet Driver</option>
                  <option value="COURIER">Motorcycle Courier</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] text-slate-400 mb-1">Actor Name</label>
                <input
                  type="text"
                  required
                  value={releasingActorName}
                  onChange={(e) => setReleasingActorName(e.target.value)}
                  className="w-full bg-[#181d28] border border-[#2b3548] rounded px-2.5 py-1.5 text-xs text-white"
                />
              </div>
            </div>
          </div>

          {/* Receiving Party */}
          <div className="p-3 bg-[#161c28] border border-[#222834] rounded-xl space-y-2.5">
            <span className="text-[11px] font-mono uppercase font-bold text-slate-400 block">Receiving Party</span>
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block text-[10px] text-slate-400 mb-1">Actor Type</label>
                <select
                  value={receivingActorType}
                  onChange={(e) => setReceivingActorType(e.target.value)}
                  className="w-full bg-[#181d28] border border-[#2b3548] rounded px-2.5 py-1.5 text-xs text-slate-200"
                >
                  <option value="DRIVER">Fleet Driver</option>
                  <option value="COURIER">Motorcycle Courier</option>
                  <option value="AGENT">Station Agent</option>
                  <option value="CUSTOMER">End Consignee</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] text-slate-400 mb-1">Actor Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Samuel Korir"
                  value={receivingActorName}
                  onChange={(e) => setReceivingActorName(e.target.value)}
                  className="w-full bg-[#181d28] border border-[#2b3548] rounded px-2.5 py-1.5 text-xs text-white"
                />
              </div>
            </div>
          </div>

          {/* Security Seal */}
          <div>
            <label className="block text-xs font-mono uppercase tracking-wider text-slate-300 font-semibold mb-1.5">
              Security Seal # (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g. SEAL-998822"
              value={sealNumber}
              onChange={(e) => setSealNumber(e.target.value)}
              className="w-full bg-[#181d28] border border-[#2b3548] rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-mono uppercase tracking-wider text-slate-300 font-semibold mb-1.5">
              Handoff Notes
            </label>
            <textarea
              rows={2}
              placeholder="Physical custody verified at dispatch gate..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full bg-[#181d28] border border-[#2b3548] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* Actions */}
          <div className="pt-2 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-md disabled:opacity-50"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>{submitting ? 'Recording...' : 'Confirm & Sign Handoff'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
