import React from 'react';
import { X } from 'lucide-react';

export function ResolveDiscrepancyModal({
  selectedDiscrepancy,
  resolutionAction,
  setResolutionAction,
  resolutionNotes,
  setResolutionNotes,
  onClose,
  onSubmit
}) {
  if (!selectedDiscrepancy) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-md bg-[#12161f] border border-[#222834] rounded-2xl p-6 shadow-2xl space-y-4">
        <div className="flex items-center justify-between border-b border-[#222834] pb-3">
          <h3 className="font-bold text-white text-base">Resolve Operational Discrepancy</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Ticket Reference</label>
            <input
              type="text"
              disabled
              value={selectedDiscrepancy.discrepancy_number}
              className="w-full px-3 py-2 bg-[#181d28] border border-[#222834] rounded-xl text-xs text-slate-400 font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Resolution Action</label>
            <select
              value={resolutionAction}
              onChange={(e) => setResolutionAction(e.target.value)}
              className="w-full px-3 py-2 bg-[#181d28] border border-[#222834] rounded-xl text-xs text-white focus:outline-none"
            >
              <option value="FOUND_AND_RECONCILED">Found & Reconciled Into Session</option>
              <option value="REROUTED_TO_CORRECT_HUB">Rerouted To Correct Hub</option>
              <option value="DAMAGED_RETURN_TO_SENDER">Damaged: Return To Shipper</option>
              <option value="INSURANCE_CLAIM_FILED">Insurance Claim Filed</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Investigation Notes</label>
            <textarea
              rows="3"
              required
              placeholder="Enter resolution notes and investigator signature..."
              value={resolutionNotes}
              onChange={(e) => setResolutionNotes(e.target.value)}
              className="w-full px-3 py-2 bg-[#181d28] border border-[#222834] rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-[#181d28] text-xs font-semibold text-slate-400 hover:text-white cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs font-bold text-white shadow cursor-pointer"
            >
              Execute Resolution
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
