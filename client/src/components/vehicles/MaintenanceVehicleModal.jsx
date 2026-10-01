import React from 'react';
import { Wrench, X, RefreshCw, CheckCircle2 } from 'lucide-react';
import { SERVICE_TYPE_OPTIONS } from './constants.jsx';

export function MaintenanceVehicleModal({
  isOpen,
  selectedVehicle,
  onClose,
  maintenanceForm: maintForm,
  setMaintenanceForm: setMaintForm,
  onSubmit,
  actionLoading
}) {
  if (!isOpen || !selectedVehicle) return null;

  return (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-xl overflow-hidden shadow-2xl my-6">
            <div className="p-6 border-b border-slate-800 flex items-center justify-between bg-slate-900/90">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
                  <Wrench className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">Log Vehicle Service / Maintenance</h2>
                  <p className="text-xs text-slate-400 font-mono">
                    {selectedVehicle.registration_number} • {selectedVehicle.make} {selectedVehicle.model}
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={onSubmit} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                    Service Type *
                  </label>
                  <select
                    value={maintForm.service_type}
                    onChange={(e) => setMaintForm({ ...maintForm, service_type: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-slate-100 focus:outline-none focus:border-amber-500"
                  >
                    {SERVICE_TYPE_OPTIONS.map(opt => (
                      <option key={opt.key} value={opt.key}>{opt.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                    Service Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={maintForm.service_date}
                    onChange={(e) => setMaintForm({ ...maintForm, service_date: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-slate-100 focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                    Odometer at Service (km) *
                  </label>
                  <input
                    type="number"
                    required
                    value={maintForm.service_odometer_km}
                    onChange={(e) => setMaintForm({ ...maintForm, service_odometer_km: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-slate-100 font-mono focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                    Service Provider / Workshop *
                  </label>
                  <input
                    type="text"
                    required
                    value={maintForm.service_provider}
                    onChange={(e) => setMaintForm({ ...maintForm, service_provider: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-slate-100 focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                    Total Cost (KES) *
                  </label>
                  <input
                    type="number"
                    required
                    placeholder="e.g. 18500"
                    value={maintForm.total_cost}
                    onChange={(e) => setMaintForm({ ...maintForm, total_cost: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-amber-400 font-bold font-mono focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                    Labor Cost (KES)
                  </label>
                  <input
                    type="number"
                    placeholder="e.g. 5000"
                    value={maintForm.labor_cost}
                    onChange={(e) => setMaintForm({ ...maintForm, labor_cost: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-slate-100 font-mono focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                    Next Target Odometer (km)
                  </label>
                  <input
                    type="number"
                    value={maintForm.next_service_target_km}
                    onChange={(e) => setMaintForm({ ...maintForm, next_service_target_km: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-slate-100 font-mono focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                    Initial Status
                  </label>
                  <select
                    value={maintForm.status}
                    onChange={(e) => setMaintForm({ ...maintForm, status: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-slate-100 focus:outline-none focus:border-amber-500"
                  >
                    <option value="IN_PROGRESS">In Progress (Sets vehicle to UNDER_MAINTENANCE)</option>
                    <option value="SCHEDULED">Scheduled</option>
                    <option value="COMPLETED">Already Completed</option>
                  </select>
                </div>

                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                    Description & Diagnostic Notes
                  </label>
                  <textarea
                    rows={2}
                    value={maintForm.description}
                    onChange={(e) => setMaintForm({ ...maintForm, description: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm text-slate-100 focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                    Parts Replaced / Installed
                  </label>
                  <input
                    type="text"
                    value={maintForm.parts_replaced}
                    onChange={(e) => setMaintForm({ ...maintForm, parts_replaced: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-slate-100 focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-slate-800 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-semibold transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-sm font-bold shadow-lg shadow-amber-600/30 transition-all flex items-center gap-2"
                >
                  {actionLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  <span>Save Service Record</span>
                </button>
              </div>
            </form>
          </div>
        </div>
  );
}
