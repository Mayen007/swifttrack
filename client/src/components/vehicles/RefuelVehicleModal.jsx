import React from 'react';
import { Fuel, X, RefreshCw, CheckCircle2 } from 'lucide-react';

export function RefuelVehicleModal({
  isOpen,
  selectedVehicle,
  onClose,
  refuelForm,
  setRefuelForm,
  onSubmit,
  actionLoading,
  drivers
}) {
  if (!isOpen || !selectedVehicle) return null;

  return (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl">
            <div className="p-6 border-b border-slate-800 flex items-center justify-between gap-4 bg-slate-900/90">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  <Fuel className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">Log Refuel Voucher</h2>
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

            <form onSubmit={onSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                    Fuel Quantity (Liters) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="e.g. 45.0"
                    value={refuelForm.quantity_liters ?? ''}
                    onChange={(e) => {
                      const liters = e.target.value;
                      const price = refuelForm.cost_per_liter;
                      setRefuelForm({
                        ...refuelForm,
                        quantity_liters: liters,
                        total_cost: liters && price ? (Number(liters) * Number(price)).toFixed(2) : refuelForm.total_cost
                      });
                    }}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-slate-100 font-mono focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                    Price / Liter (KES) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={refuelForm.cost_per_liter ?? ''}
                    onChange={(e) => {
                      const price = e.target.value;
                      const liters = refuelForm.quantity_liters;
                      setRefuelForm({
                        ...refuelForm,
                        cost_per_liter: price,
                        total_cost: liters && price ? (Number(liters) * Number(price)).toFixed(2) : refuelForm.total_cost
                      });
                    }}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-slate-100 font-mono focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                    Total Amount (KES) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={refuelForm.total_cost ?? ''}
                    onChange={(e) => setRefuelForm({ ...refuelForm, total_cost: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-emerald-400 font-bold font-mono focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                    Odometer at Refuel (km) *
                  </label>
                  <input
                    type="number"
                    required
                    placeholder={selectedVehicle.current_odometer_km}
                    value={refuelForm.odometer_km ?? ''}
                    onChange={(e) => setRefuelForm({ ...refuelForm, odometer_km: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-slate-100 font-mono focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                    Gas Station / Petrol Vendor
                  </label>
                  <input
                    type="text"
                    value={refuelForm.gas_station_vendor ?? ''}
                    onChange={(e) => setRefuelForm({ ...refuelForm, gas_station_vendor: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-slate-100 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                    Receipt / Voucher Ref
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. VCH-98124"
                    value={refuelForm.voucher_number ?? ''}
                    onChange={(e) => setRefuelForm({ ...refuelForm, voucher_number: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-slate-100 uppercase font-mono focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                    Full Tank Refill?
                  </label>
                  <select
                    value={refuelForm.is_full_tank ?? 1}
                    onChange={(e) => setRefuelForm({ ...refuelForm, is_full_tank: Number(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-slate-100 focus:outline-none focus:border-emerald-500"
                  >
                    <option value={1}>Yes (Full Tank — Calibrate km/L)</option>
                    <option value={0}>No (Partial Top-up)</option>
                  </select>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-800 flex items-center justify-between gap-3">
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
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold shadow-lg shadow-emerald-600/30 transition-all flex items-center gap-2"
                >
                  {actionLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  <span>Confirm Refuel</span>
                </button>
              </div>
            </form>
          </div>
        </div>
  );
}
