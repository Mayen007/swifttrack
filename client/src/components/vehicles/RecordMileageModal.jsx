import React from 'react';
import { Gauge, X, RefreshCw, CheckCircle2 } from 'lucide-react';

export function RecordMileageModal({
  isOpen,
  selectedVehicle,
  onClose,
  mileageForm: tripForm,
  setMileageForm: setTripForm,
  onSubmit,
  actionLoading,
  drivers
}) {
  if (!isOpen || !selectedVehicle) return null;

  return (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl">
            <div className="p-6 border-b border-slate-800 flex items-center justify-between bg-slate-900/90">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-sky-500/10 text-sky-400 border border-sky-500/20">
                  <Gauge className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">Log Trip & Advance Mileage</h2>
                  <p className="text-xs text-slate-400 font-mono">
                    {selectedVehicle.registration_number} • Current: {Number(selectedVehicle.current_odometer_km).toLocaleString()} km
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={onSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                    Trip Date
                  </label>
                  <input
                    type="date"
                    required
                    value={tripForm.log_date}
                    onChange={(e) => setTripForm({ ...tripForm, log_date: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-slate-100 focus:outline-none focus:border-sky-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                    Trip Type
                  </label>
                  <select
                    value={tripForm.trip_type}
                    onChange={(e) => setTripForm({ ...tripForm, trip_type: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-slate-100 focus:outline-none focus:border-sky-500"
                  >
                    <option value="DELIVERY_RUN">Delivery Run</option>
                    <option value="RELOCATION">Depot Transfer / Relocation</option>
                    <option value="MAINTENANCE">Garage Service Trip</option>
                    <option value="TEST_DRIVE">Post-Repair Test Run</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                    Start Odometer (km) *
                  </label>
                  <input
                    type="number"
                    required
                    value={tripForm.start_odometer_km}
                    onChange={(e) => {
                      const start = Number(e.target.value);
                      const end = Number(tripForm.end_odometer_km);
                      setTripForm({
                        ...tripForm,
                        start_odometer_km: e.target.value,
                        distance_km: end > start ? end - start : tripForm.distance_km
                      });
                    }}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-slate-100 font-mono focus:outline-none focus:border-sky-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                    End Odometer (km) *
                  </label>
                  <input
                    type="number"
                    required
                    value={tripForm.end_odometer_km}
                    onChange={(e) => {
                      const end = Number(e.target.value);
                      const start = Number(tripForm.start_odometer_km);
                      setTripForm({
                        ...tripForm,
                        end_odometer_km: e.target.value,
                        distance_km: end > start ? end - start : tripForm.distance_km
                      });
                    }}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-sky-400 font-bold font-mono focus:outline-none focus:border-sky-500"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                    Destination / Route
                  </label>
                  <input
                    type="text"
                    value={tripForm.destination}
                    onChange={(e) => setTripForm({ ...tripForm, destination: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-slate-100 focus:outline-none focus:border-sky-500"
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-slate-800 flex items-center justify-end gap-3">
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
                  className="px-5 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-sm font-semibold shadow-sm flex items-center gap-2"
                >
                  {actionLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  <span>Record Trip</span>
                </button>
              </div>
            </form>
          </div>
        </div>
  );
}
