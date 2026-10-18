import React from 'react';
import { X, Car, AlertCircle, Truck, Shield } from 'lucide-react';

export function AssignVehicleModal({
  isOpen,
  selectedDriver,
  onClose,
  selectedVehicleId,
  setSelectedVehicleId,
  vehicles = [],
  onSubmit,
  actionLoading
}) {
  if (!isOpen || !selectedDriver) return null;

  const currentVehicle = vehicles.find(
    (v) => Number(v.id) === Number(selectedDriver.vehicle_id || selectedDriver.assigned_vehicle_id)
  );

  const chosenVehicle = vehicles.find(
    (v) => Number(v.id) === Number(selectedVehicleId)
  );

  const willReassignFromOtherDriver =
    chosenVehicle &&
    chosenVehicle.driver_name &&
    Number(chosenVehicle.assigned_driver_id || chosenVehicle.driver_id) !== Number(selectedDriver.id);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-xs animate-fadeIn">
      <div className="bg-[#12161f] rounded-2xl border border-[#222834] shadow-2xl w-full max-w-lg overflow-hidden text-white">
        {/* Header */}
        <div className="p-4 sm:p-5 bg-[#181d28] border-b border-[#222834] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
              <Car className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-white text-base">Assign Fleet Vehicle</h3>
              <p className="text-xs text-slate-400">
                Designate a vehicle to courier driver
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={onSubmit} className="p-5 space-y-4">
          {/* Driver Brief Card */}
          <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <span className="text-[10px] text-slate-400 block uppercase tracking-wider">Courier Driver</span>
              <div className="font-semibold text-white text-sm truncate flex items-center gap-1.5 mt-0.5">
                <span>{selectedDriver.full_name}</span>
                <span className="px-1.5 py-0.5 rounded text-[10px] font-mono text-slate-400 bg-slate-950 border border-slate-800">
                  {selectedDriver.employee_code || `DRV-${selectedDriver.id}`}
                </span>
              </div>
              <div className="text-xs text-slate-400 mt-0.5">
                {selectedDriver.phone || selectedDriver.branch_name || 'Depot Driver'}
              </div>
            </div>

            <div className="text-right shrink-0">
              <span className="text-[10px] text-slate-400 block uppercase tracking-wider">Current Vehicle</span>
              <span className="text-xs font-mono font-bold text-amber-400">
                {selectedDriver.vehicle_reg || currentVehicle?.registration_number || 'None (Unassigned)'}
              </span>
            </div>
          </div>

          {/* Vehicle Dropdown */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center justify-between">
              <span>Select Fleet Vehicle *</span>
              <span className="text-[11px] text-slate-400 font-normal">
                {vehicles.length} vehicle{vehicles.length === 1 ? '' : 's'} available
              </span>
            </label>
            <select
              value={selectedVehicleId || ''}
              onChange={(e) => setSelectedVehicleId(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-950/80 border border-slate-700/80 rounded-xl text-sm text-slate-100 focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 focus:outline-hidden cursor-pointer"
            >
              <option value="">-- Unassigned (No Vehicle) --</option>
              {vehicles.map((v) => {
                const isCurrent = Number(v.id) === Number(selectedDriver.vehicle_id || selectedDriver.assigned_vehicle_id);
                const hasOtherDriver = v.driver_name && !isCurrent;

                return (
                  <option key={v.id} value={v.id}>
                    {v.registration_number} — {v.make ? `${v.make} ` : ''}{v.model || v.vehicle_type}
                    {isCurrent ? ' [Currently Assigned]' : ''}
                    {hasOtherDriver ? ` [With ${v.driver_name}]` : ''}
                    {v.status ? ` — ${v.status}` : ''}
                  </option>
                );
              })}
            </select>
          </div>

          {/* Transfer Alert if vehicle is assigned to another driver */}
          {willReassignFromOtherDriver && (
            <div className="flex items-start gap-2.5 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs animate-fadeIn">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" />
              <div>
                <span className="font-semibold block">Vehicle Transfer Notice</span>
                <span className="text-amber-200/90 text-[11px] leading-relaxed">
                  <strong className="font-mono text-amber-300">{chosenVehicle.registration_number}</strong> is currently designated to{' '}
                  <strong>{chosenVehicle.driver_name}</strong>. Reassigning it will transfer the vehicle to {selectedDriver.full_name}.
                </span>
              </div>
            </div>
          )}

          {/* Unassign Notice */}
          {!selectedVehicleId && (selectedDriver.vehicle_reg || selectedDriver.vehicle_id) && (
            <div className="flex items-start gap-2.5 p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-300 text-xs">
              <Shield className="w-4 h-4 shrink-0 mt-0.5 text-blue-400" />
              <div>
                <span className="font-semibold block">Unassign Vehicle</span>
                <span className="text-slate-300 text-[11px]">
                  Saving with no vehicle selected will release {selectedDriver.full_name} from {selectedDriver.vehicle_reg || 'their current vehicle'}.
                </span>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[#222834]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-slate-700/80 text-slate-300 hover:text-white rounded-xl text-xs sm:text-sm bg-[#181d28] hover:bg-[#1f2534] font-medium transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={actionLoading}
              className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all shadow-sm cursor-pointer disabled:opacity-50 flex items-center gap-1.5 ${
                !selectedVehicleId
                  ? 'bg-rose-600 hover:bg-rose-500 text-white'
                  : 'bg-blue-600 hover:bg-blue-500 text-white'
              }`}
            >
              {actionLoading ? (
                <span>Saving...</span>
              ) : !selectedVehicleId ? (
                <span>Confirm Unassignment</span>
              ) : (
                <>
                  <Truck className="w-4 h-4" />
                  <span>Confirm Assignment</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
