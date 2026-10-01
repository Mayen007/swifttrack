import React from 'react';
import { Truck, X, RefreshCw, CheckCircle2 } from 'lucide-react';
import { VEHICLE_TYPE_OPTIONS } from './constants.jsx';

export function RegisterVehicleModal({
  isOpen,
  onClose,
  registerForm,
  setRegisterForm,
  onSubmit,
  actionLoading,
  branches,
  drivers
}) {
  if (!isOpen) return null;

  return (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl my-8">
            <div className="p-6 border-b border-slate-800 flex items-center justify-between bg-slate-900/90">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-blue-500/20 text-blue-400 border border-blue-500/30">
                  <Truck className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">Register Fleet Vehicle</h2>
                  <p className="text-xs text-slate-400">Onboard a vehicle into the SwiftTrack Kenya fleet registry</p>
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
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Registration Number */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                    Registration Number (Kenya Plate) *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. KDL 456X or KBZ 789C"
                    value={registerForm.registration_number}
                    onChange={(e) => setRegisterForm({ ...registerForm, registration_number: e.target.value.toUpperCase() })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-slate-100 uppercase font-mono font-bold placeholder-slate-600 focus:outline-none focus:border-blue-500"
                  />
                </div>

                {/* Vehicle Type */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                    Vehicle Type *
                  </label>
                  <select
                    value={registerForm.vehicle_type}
                    onChange={(e) => setRegisterForm({ ...registerForm, vehicle_type: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-slate-100 focus:outline-none focus:border-blue-500"
                  >
                    {VEHICLE_TYPE_OPTIONS.map(opt => (
                      <option key={opt.key} value={opt.key}>{opt.label}</option>
                    ))}
                  </select>
                </div>

                {/* Make & Model */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                    Make *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Toyota, Isuzu, Bajaj, Nissan"
                    value={registerForm.make}
                    onChange={(e) => setRegisterForm({ ...registerForm, make: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-slate-100 focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                    Model & Year *
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    <input
                      type="text"
                      required
                      placeholder="HiAce, Boxer..."
                      value={registerForm.model}
                      onChange={(e) => setRegisterForm({ ...registerForm, model: e.target.value })}
                      className="col-span-2 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-blue-500"
                    />
                    <input
                      type="number"
                      required
                      placeholder="2023"
                      value={registerForm.year_of_manufacture}
                      onChange={(e) => setRegisterForm({ ...registerForm, year_of_manufacture: e.target.value })}
                      className="bg-slate-950 border border-slate-800 rounded-xl px-2 py-2 text-sm text-slate-100 focus:outline-none focus:border-blue-500 font-mono"
                    />
                  </div>
                </div>

                {/* Chassis Number & Engine Number */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                    Chassis / VIN Number
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. JTFHL22P500129482"
                    value={registerForm.chassis_number}
                    onChange={(e) => setRegisterForm({ ...registerForm, chassis_number: e.target.value.toUpperCase() })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-slate-100 font-mono focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                    Color
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. White, Silver, Navy"
                    value={registerForm.color}
                    onChange={(e) => setRegisterForm({ ...registerForm, color: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-slate-100 focus:outline-none focus:border-blue-500"
                  />
                </div>

                {/* Fuel Type & Fuel Tank */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                    Fuel Type
                  </label>
                  <select
                    value={registerForm.fuel_type}
                    onChange={(e) => setRegisterForm({ ...registerForm, fuel_type: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-slate-100 focus:outline-none focus:border-blue-500"
                  >
                    <option value="DIESEL">Diesel</option>
                    <option value="PETROL">Petrol</option>
                    <option value="ELECTRIC">Electric</option>
                    <option value="HYBRID">Hybrid</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                    Tank Capacity (Liters)
                  </label>
                  <input
                    type="number"
                    value={registerForm.fuel_tank_capacity_liters}
                    onChange={(e) => setRegisterForm({ ...registerForm, fuel_tank_capacity_liters: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-slate-100 focus:outline-none focus:border-blue-500"
                  />
                </div>

                {/* Capacity (kg) & Cargo Volume (m3) */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                    Payload Capacity (kg) *
                  </label>
                  <input
                    type="number"
                    required
                    placeholder="e.g. 1200"
                    value={registerForm.capacity_kg}
                    onChange={(e) => setRegisterForm({ ...registerForm, capacity_kg: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-slate-100 focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                    Cargo Volume (m³)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    placeholder="e.g. 6.5"
                    value={registerForm.cargo_volume_cbm}
                    onChange={(e) => setRegisterForm({ ...registerForm, cargo_volume_cbm: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-slate-100 focus:outline-none focus:border-blue-500"
                  />
                </div>

                {/* Initial Odometer & Current Odometer */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                    Initial / Current Odometer (km) *
                  </label>
                  <input
                    type="number"
                    required
                    value={registerForm.initial_odometer_km}
                    onChange={(e) => setRegisterForm({
                      ...registerForm,
                      initial_odometer_km: e.target.value,
                      current_odometer_km: e.target.value
                    })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-slate-100 focus:outline-none focus:border-blue-500 font-mono"
                  />
                </div>

                {/* Ownership Type */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                    Ownership Type
                  </label>
                  <select
                    value={registerForm.ownership_type}
                    onChange={(e) => setRegisterForm({ ...registerForm, ownership_type: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-slate-100 focus:outline-none focus:border-blue-500"
                  >
                    <option value="COMPANY_OWNED">Company Owned</option>
                    <option value="LEASED">Leased</option>
                    <option value="THIRD_PARTY">Third Party Contractor</option>
                  </select>
                </div>

                {/* Branch Assignment */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                    Depot Branch *
                  </label>
                  <select
                    required
                    value={registerForm.branch_id}
                    onChange={(e) => setRegisterForm({ ...registerForm, branch_id: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-slate-100 focus:outline-none focus:border-blue-500"
                  >
                    {branches.map(b => (
                      <option key={b.id} value={b.id}>{b.name} ({b.code})</option>
                    ))}
                  </select>
                </div>

                {/* Driver Pairing */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                    Assigned Driver (Optional)
                  </label>
                  <select
                    value={registerForm.assigned_driver_id}
                    onChange={(e) => setRegisterForm({ ...registerForm, assigned_driver_id: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-slate-100 focus:outline-none focus:border-blue-500"
                  >
                    <option value="">-- No Driver Assigned --</option>
                    {drivers.map(d => (
                      <option key={d.id} value={d.id}>{d.full_name} ({d.employee_code || d.phone})</option>
                    ))}
                  </select>
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
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold shadow-lg shadow-blue-600/30 transition-all flex items-center gap-2"
                >
                  {actionLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  <span>Save Vehicle</span>
                </button>
              </div>
            </form>
          </div>
        </div>
  );
}
