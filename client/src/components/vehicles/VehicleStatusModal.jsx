import React from 'react';
import { X, RefreshCw, CheckCircle2 } from 'lucide-react';
import { VEHICLE_STATUS_OPTIONS } from './constants.jsx';

export function VehicleStatusModal({
  isOpen,
  selectedVehicle,
  onClose,
  statusForm,
  setStatusForm,
  onSubmit,
  actionLoading
}) {
  if (!isOpen || !selectedVehicle) return null;

  return (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
            <div className="p-6 border-b border-slate-800 flex items-center justify-between bg-slate-900/90">
              <div>
                <h2 className="text-lg font-bold text-white">Update Vehicle Status</h2>
                <p className="text-xs text-slate-400 font-mono">{selectedVehicle.registration_number}</p>
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={onSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase mb-2">
                  Select New Operational State
                </label>
                <div className="grid grid-cols-1 gap-2">
                  {VEHICLE_STATUS_OPTIONS.map(opt => (
                    <button
                      key={opt.key}
                      type="button"
                      onClick={() => setStatusForm({ ...statusForm, status: opt.key })}
                      className={`p-3 rounded-xl border text-left transition-all flex items-center justify-between ${
                        statusForm.status === opt.key
                          ? 'bg-blue-600/20 border-blue-500 text-white font-semibold'
                          : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      <span>{opt.label}</span>
                      {statusForm.status === opt.key && <CheckCircle2 className="w-4 h-4 text-blue-400" />}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                  Reason / State Change Notes
                </label>
                <input
                  type="text"
                  placeholder="e.g. Cleared workshop inspection, ready for dispatch"
                  value={statusForm.notes}
                  onChange={(e) => setStatusForm({ ...statusForm, notes: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-slate-100 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold shadow-lg shadow-blue-600/30 flex items-center gap-2"
                >
                  {actionLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  <span>Save Status</span>
                </button>
              </div>
            </form>
          </div>
        </div>
  );
}
