import React from 'react';
import { ShieldCheck, X, Loader2, Send } from 'lucide-react';

export function CustomsActionModal({
  selectedLegForCustoms,
  customsModalAction,
  customsForm,
  setCustomsForm,
  customsSubmitting,
  onClose,
  onSubmit
}) {
  if (!selectedLegForCustoms || !customsModalAction) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-fade-in">
      <div className="w-full max-w-md bg-[#0e1219] border border-[#222834] rounded-2xl shadow-2xl p-5 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-[#222834]">
          <div>
            <h4 className="text-sm font-bold text-white flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-blue-400" />
              Customs Action: {customsModalAction}
            </h4>
            <p className="text-[11px] text-slate-400 font-mono mt-0.5">
              Border Post: {selectedLegForCustoms.border_post_name || 'Checkpoint'} (Leg #{selectedLegForCustoms.leg_sequence || selectedLegForCustoms.id})
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-[#181d28] text-slate-400 hover:text-white cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={onSubmit} className="space-y-3 text-xs">
          {customsModalAction === 'SUBMIT' && (
            <div>
              <label className="block text-[11px] font-medium text-slate-300 mb-1">
                Customs Declaration Number
              </label>
              <input
                type="text"
                value={customsForm.declaration_number}
                onChange={(e) => setCustomsForm({ ...customsForm, declaration_number: e.target.value })}
                required
                className="w-full px-3 py-2 rounded-xl bg-[#141822] border border-[#262c3c] text-white font-mono"
                placeholder="e.g. DEC-2026-88192"
              />
            </div>
          )}

          {customsModalAction === 'CLEAR' && (
            <div>
              <label className="block text-[11px] font-medium text-slate-300 mb-1">
                Customs Clearance Certificate #
              </label>
              <input
                type="text"
                value={customsForm.certificate_number}
                onChange={(e) => setCustomsForm({ ...customsForm, certificate_number: e.target.value })}
                required
                className="w-full px-3 py-2 rounded-xl bg-[#141822] border border-[#262c3c] text-white font-mono"
                placeholder="e.g. CC-2026-4491"
              />
            </div>
          )}

          {customsModalAction === 'HOLD' && (
            <div>
              <label className="block text-[11px] font-medium text-rose-300 mb-1">
                Customs Hold Reason (Spawns Operational Exception)
              </label>
              <select
                value={customsForm.hold_reason}
                onChange={(e) => setCustomsForm({ ...customsForm, hold_reason: e.target.value })}
                className="w-full px-3 py-2 rounded-xl bg-[#141822] border border-[#262c3c] text-white"
              >
                <option value="DOCUMENTATION_MISSING">DOCUMENTATION_MISSING — Invoice / Origin Missing</option>
                <option value="VALUATION_DISCREPANCY">VALUATION_DISCREPANCY — Tariff Code Audit Required</option>
                <option value="PHYSICAL_INSPECTION_FAILED">PHYSICAL_INSPECTION_FAILED — Seal Broken / Mismatch</option>
                <option value="SECURITY_FLAG">SECURITY_FLAG — Border Security Directive</option>
                <option value="DUTY_UNPAID">DUTY_UNPAID — Cross-Border Duty Assessment Pending</option>
              </select>
            </div>
          )}

          <div>
            <label className="block text-[11px] font-medium text-slate-300 mb-1">
              Officer Notes / Verification Comments
            </label>
            <textarea
              value={customsForm.notes}
              onChange={(e) => setCustomsForm({ ...customsForm, notes: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 rounded-xl bg-[#141822] border border-[#262c3c] text-white"
              placeholder="Official comments recorded at border checkpoint..."
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#222834]">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-2 rounded-xl bg-[#181d28] hover:bg-[#202737] text-slate-300 text-xs font-semibold cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={customsSubmitting}
              className={`px-4 py-2 rounded-xl text-xs font-bold text-white flex items-center gap-1.5 shadow cursor-pointer ${
                customsModalAction === 'HOLD'
                  ? 'bg-rose-600 hover:bg-rose-500'
                  : 'bg-blue-600 hover:bg-blue-500'
              }`}
            >
              {customsSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" />
                  Confirm {customsModalAction}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
