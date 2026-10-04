import React from 'react';
import { X, CheckCircle2, Activity } from 'lucide-react';
import { DRIVER_STATUS_OPTIONS } from './constants.js';

export function DriverStatusModal({
  isOpen,
  selectedDriver,
  onClose,
  statusForm,
  setStatusForm,
  onSubmit,
  actionLoading
}) {
  if (!isOpen || !selectedDriver) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-fadeIn">
      <div className="bg-[#12161f] rounded-2xl border border-[#222834] shadow-2xl w-full max-w-md overflow-hidden text-white">
        <div className="p-4 bg-[#181d28] border-b border-[#222834] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-blue-400" />
            <h3 className="font-bold text-white text-base">Update Driver Status</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded text-slate-400 hover:text-white cursor-pointer"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={onSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">Target Status</label>
            <select
              value={statusForm.status}
              onChange={(e) => setStatusForm({ ...statusForm, status: e.target.value })}
              className="w-full px-3 py-2 bg-slate-950/60 border border-slate-700/80 rounded-lg text-sm font-semibold text-slate-200 focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 focus:outline-hidden cursor-pointer"
            >
              {DRIVER_STATUS_OPTIONS.map(opt => (
                <option key={opt.key} value={opt.key}>{opt.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">Reason / Notes</label>
            <input
              type="text"
              placeholder="e.g. End of shift, leave authorization, vehicle breakdown..."
              value={statusForm.notes}
              onChange={(e) => setStatusForm({ ...statusForm, notes: e.target.value })}
              className="w-full px-3 py-2 bg-slate-950/60 border border-slate-700/80 rounded-lg text-sm text-white placeholder-slate-500 focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 focus:outline-hidden"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#222834]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-slate-700/80 text-slate-300 hover:text-white rounded-lg text-sm bg-[#181d28] hover:bg-[#1f2534] font-medium transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={actionLoading}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-semibold transition-colors shadow-sm cursor-pointer disabled:opacity-50"
            >
              {actionLoading ? 'Saving...' : 'Update Status'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
