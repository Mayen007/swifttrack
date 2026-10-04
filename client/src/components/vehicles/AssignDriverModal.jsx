import React from 'react';
import { X, UserCheck, UserPlus, AlertCircle, Shield, Truck } from 'lucide-react';

export function AssignDriverModal({
  isOpen,
  selectedVehicle,
  onClose,
  selectedDriverId,
  setSelectedDriverId,
  drivers = [],
  onSubmit,
  actionLoading
}) {
  if (!isOpen || !selectedVehicle) return null;

  const currentAssignedDriver = drivers.find(
    (d) => Number(d.id) === Number(selectedVehicle.assigned_driver_id || selectedVehicle.driver_id)
  );

  const selectedDriver = drivers.find(
    (d) => Number(d.id) === Number(selectedDriverId)
  );

  const willReassignFromOtherVehicle =
    selectedDriver &&
    selectedDriver.vehicle_id &&
    Number(selectedDriver.vehicle_id) !== Number(selectedVehicle.id);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-xs animate-fadeIn">
      <div className="bg-[#12161f] rounded-2xl border border-[#222834] shadow-2xl w-full max-w-lg overflow-hidden text-white">
        {/* Header */}
        <div className="p-4 sm:p-5 bg-[#181d28] border-b border-[#222834] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
              <UserCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-white text-base">Assign Designated Driver</h3>
              <p className="text-xs text-slate-400">
                Link an active branch courier to this fleet vehicle
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
          {/* Target Vehicle Brief */}
          <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="px-2.5 py-1 rounded bg-amber-400 text-black font-black text-xs font-mono shrink-0 shadow-xs">
                {selectedVehicle.registration_number}
              </div>
              <div className="min-w-0">
                <div className="font-semibold text-slate-200 text-xs truncate">
                  {selectedVehicle.make} {selectedVehicle.model} ({selectedVehicle.vehicle_type})
                </div>
                <div className="text-[11px] text-slate-400 truncate">
                  {selectedVehicle.branch_name || 'Fleet'} Depot
                </div>
              </div>
            </div>

            <div className="text-right shrink-0">
              <span className="text-[10px] text-slate-400 block uppercase tracking-wider">Current Driver</span>
              <span className="text-xs font-medium text-slate-300">
                {selectedVehicle.driver_name || currentAssignedDriver?.full_name || 'Unassigned'}
              </span>
            </div>
          </div>

          {/* Driver Selection Dropdown */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center justify-between">
              <span>Select Fleet Courier / Driver *</span>
              <span className="text-[11px] text-slate-400 font-normal">
                {drivers.length} registered driver{drivers.length === 1 ? '' : 's'}
              </span>
            </label>
            <select
              value={selectedDriverId || ''}
              onChange={(e) => setSelectedDriverId(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-950/80 border border-slate-700/80 rounded-xl text-sm text-slate-100 focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 focus:outline-hidden cursor-pointer"
            >
              <option value="">-- Unassigned (No Designated Driver) --</option>
              {drivers.map((drv) => {
                const isCurrent = Number(drv.id) === Number(selectedVehicle.assigned_driver_id || selectedVehicle.driver_id);
                const isAssignedElsewhere =
                  drv.vehicle_id &&
                  Number(drv.vehicle_id) !== Number(selectedVehicle.id);

                return (
                  <option key={drv.id} value={drv.id}>
                    {drv.full_name} ({drv.employee_code || drv.phone})
                    {isCurrent ? ' [Currently Assigned]' : ''}
                    {isAssignedElsewhere ? ` [On ${drv.vehicle_reg || 'other vehicle'}]` : ''}
                    {drv.status ? ` — ${drv.status}` : ''}
                  </option>
                );
              })}
            </select>
          </div>

          {/* Conflict Warning Alert if Driver has another vehicle */}
          {willReassignFromOtherVehicle && (
            <div className="flex items-start gap-2.5 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs animate-fadeIn">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" />
              <div>
                <span className="font-semibold block">Automatic Vehicle Transfer</span>
                <span className="text-amber-200/90 text-[11px] leading-relaxed">
                  {selectedDriver.full_name} is currently assigned to{' '}
                  <strong className="font-mono text-amber-300">{selectedDriver.vehicle_reg || 'another vehicle'}</strong>.
                  Assigning them here will automatically release their previous vehicle.
                </span>
              </div>
            </div>
          )}

          {/* Unassign Notice */}
          {!selectedDriverId && (selectedVehicle.driver_name || selectedVehicle.assigned_driver_id) && (
            <div className="flex items-start gap-2.5 p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-300 text-xs">
              <Shield className="w-4 h-4 shrink-0 mt-0.5 text-blue-400" />
              <div>
                <span className="font-semibold block">Unassign Current Driver</span>
                <span className="text-slate-300 text-[11px]">
                  Saving with no driver selected will release {selectedVehicle.driver_name || 'the driver'} from this vehicle and set its status to Unassigned.
                </span>
              </div>
            </div>
          )}

          {/* Footer Actions */}
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
                !selectedDriverId
                  ? 'bg-rose-600 hover:bg-rose-500 text-white'
                  : 'bg-blue-600 hover:bg-blue-500 text-white'
              }`}
            >
              {actionLoading ? (
                <span>Saving...</span>
              ) : !selectedDriverId ? (
                <span>Confirm Unassignment</span>
              ) : (
                <>
                  <UserPlus className="w-4 h-4" />
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
