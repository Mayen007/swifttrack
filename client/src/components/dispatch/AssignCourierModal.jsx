import React from 'react';
import { Truck, X } from 'lucide-react';
import { api } from '../../services/api.js';

export function AssignCourierModal({
  isOpen,
  selectedDelivery,
  drivers,
  vehicles,
  selectedDriverId,
  setSelectedDriverId,
  selectedVehicleId,
  setSelectedVehicleId,
  vehicleNotes,
  setVehicleNotes,
  assignPriority,
  setAssignPriority,
  dispatchNotes,
  setDispatchNotes,
  onClose,
  onSubmit
}) {
  if (!isOpen || !selectedDelivery) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-xs p-4">
      <div className="bg-[#12161f] border border-[#222834] rounded p-6 max-w-lg w-full shadow-2xl relative space-y-4 animate-in fade-in zoom-in-95">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        <div>
          <span className="text-[10px] font-mono text-blue-400 uppercase tracking-wider block font-bold">
            DISPATCH // ALLOCATE FLEET COURIER
          </span>
          <h3 className="text-base font-bold text-slate-100 flex items-center gap-2 font-mono">
            <Truck className="w-4 h-4 text-blue-400" />
            Assign Courier to #{selectedDelivery.delivery_number}
          </h3>
        </div>

        <div className="bg-[#0c0e12] border border-[#222834] rounded p-3 text-xs font-mono space-y-1.5">
          <div className="flex justify-between">
            <span className="text-slate-500">Destination:</span>
            <span className="text-slate-200 font-semibold">{selectedDelivery.delivery_address}{selectedDelivery.delivery_city ? ` (${selectedDelivery.delivery_city})` : ''}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Recipient:</span>
            <span className="text-slate-200">{selectedDelivery.recipient_name} ({selectedDelivery.recipient_phone})</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Order Value:</span>
            <span className="text-slate-200 font-bold tabular-nums">
              {selectedDelivery.total_amount ? api.formatKES(selectedDelivery.total_amount) : 'Standard Manifest'}
            </span>
          </div>
        </div>

        <div className="space-y-3.5 text-xs font-mono">
          <div>
            <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1.5">
              Select Fleet Driver *
            </label>
            <select
              value={selectedDriverId}
              onChange={(e) => setSelectedDriverId(e.target.value)}
              className="w-full px-3 py-2 rounded bg-[#0c0e12] border border-[#222834] text-slate-200 font-mono focus:outline-none focus:border-blue-500 cursor-pointer"
            >
              <option value="">-- Choose Courier --</option>
              {drivers.map((drv) => (
                <option key={drv.id} value={drv.id}>
                  {drv.full_name} &mdash; {drv.status || 'AVAILABLE'} ({drv.active_deliveries_count ?? 0} active drops)
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                Vehicle Allocation
              </label>
              <select
                value={selectedVehicleId}
                onChange={(e) => {
                  setSelectedVehicleId(e.target.value);
                  const veh = vehicles.find((v) => String(v.id) === e.target.value);
                  if (veh) setVehicleNotes(`${veh.model || veh.vehicle_type} (${veh.registration_number})`);
                }}
                className="w-full px-3 py-2 rounded bg-[#0c0e12] border border-[#222834] text-slate-200 font-mono focus:outline-none focus:border-blue-500 cursor-pointer"
              >
                <option value="">-- Custom Vehicle --</option>
                {vehicles.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.registration_number} ({v.vehicle_type})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                Vehicle Details / Plate
              </label>
              <input
                type="text"
                value={vehicleNotes}
                onChange={(e) => setVehicleNotes(e.target.value)}
                className="w-full px-3 py-2 rounded bg-[#0c0e12] border border-[#222834] text-slate-200 font-mono focus:outline-none focus:border-blue-500"
                placeholder="e.g. Boxer 150 (KME 391A)"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1.5">
              Priority Flag
            </label>
            <div className="flex gap-2">
              {['NORMAL', 'HIGH', 'URGENT'].map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setAssignPriority(p)}
                  className={`flex-1 py-1.5 rounded text-[11px] font-bold font-mono border transition-colors cursor-pointer ${
                    assignPriority === p
                      ? p === 'URGENT'
                        ? 'bg-rose-500/20 text-rose-400 border-rose-500/40'
                        : p === 'HIGH'
                        ? 'bg-amber-500/20 text-amber-400 border-amber-500/40'
                        : 'bg-blue-500/20 text-blue-400 border-blue-500/40'
                      : 'bg-[#0c0e12] text-slate-400 border-[#222834]'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1.5">
              Dispatcher Instructions (Optional)
            </label>
            <input
              type="text"
              value={dispatchNotes}
              onChange={(e) => setDispatchNotes(e.target.value)}
              className="w-full px-3 py-2 rounded bg-[#0c0e12] border border-[#222834] text-slate-200 font-mono focus:outline-none focus:border-blue-500"
              placeholder="e.g. Security pass at gate; customer requested morning delivery"
            />
          </div>

          <div className="pt-2 flex gap-2.5">
            <button
              onClick={onSubmit}
              className="flex-1 py-2.5 rounded bg-blue-600 hover:bg-blue-500 text-white font-bold font-mono text-xs uppercase tracking-wider shadow-lg shadow-blue-900/30 transition-colors cursor-pointer"
            >
              Confirm & Dispatch Manifest
            </button>
            <button
              onClick={onClose}
              className="py-2.5 px-4 rounded bg-[#181d28] hover:bg-slate-700 text-slate-300 font-semibold font-mono text-xs cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
