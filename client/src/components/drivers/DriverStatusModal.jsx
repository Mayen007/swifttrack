import React from 'react';
import { X, CheckCircle2 } from 'lucide-react';
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-[#12161f] rounded-2xl border border-[#222834] shadow-2xl w-full max-w-md overflow-hidden text-white">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-bold text-white">Update Driver Status</h3>
              <button onClick={onClose}>
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            <form onSubmit={onSubmit} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Target Status</label>
                <select
                  value={statusForm.status}
                  onChange={(e) => setStatusForm({ ...statusForm, status: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-semibold focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                >
                  {DRIVER_STATUS_OPTIONS.map(opt => (
                    <option key={opt.key} value={opt.key}>{opt.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Reason / Notes</label>
                <input
                  type="text"
                  placeholder="e.g. End of shift, leave authorization, vehicle breakdown..."
                  value={statusForm.notes}
                  onChange={(e) => setStatusForm({ ...statusForm, notes: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 border border-[#222834] text-slate-400 hover:text-white rounded-lg text-sm bg-[#181d28] hover:bg-[#1f2534] font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700"
                >
                  {actionLoading ? 'Saving...' : 'Update Status'}
                </button>
              </div>
            </form>
          </div>
        </div>
  );
}
