import React from 'react';
import {
  X, Truck, Car, Bike, Fuel, Wrench, Gauge, Calendar, User,
  CheckCircle2, AlertTriangle, Clock, Plus, TrendingUp, History, Activity,
  Layers, FileText
} from 'lucide-react';
import { renderStatusBadge, renderVehicleTypeIcon, SERVICE_TYPE_OPTIONS } from './constants.jsx';

export function VehicleDetailModal({
  isOpen,
  selectedVehicle,
  onClose,
  vehicleTelemetry,
  detailTab,
  setDetailTab,
  fuelLogs,
  maintenanceRecords,
  mileageLogs,
  onOpenRefuel,
  onOpenMaintenance,
  onOpenMileage,
  onOpenStatus
}) {
  if (!isOpen || !selectedVehicle) return null;

  return (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl overflow-hidden shadow-2xl my-4 flex flex-col max-h-[90vh]">
            {/* Header banner */}
            <div className="p-6 border-b border-slate-800 flex items-center justify-between bg-slate-950/70">
              <div className="flex items-center gap-4">
                <div className="px-3.5 py-1.5 bg-amber-400 text-black font-black tracking-widest text-base rounded border-2 border-black font-mono shadow-md">
                  {selectedVehicle.registration_number}
                </div>
                <div>
                  <div className="text-[11px] font-mono text-slate-400 mb-1 flex items-center gap-1.5">
                    <span className="text-slate-500 uppercase tracking-wider">Fleet Vehicles</span>
                    <span className="text-slate-600">›</span>
                    <span className="text-amber-400 font-semibold">{selectedVehicle.registration_number}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-bold text-white">
                      {selectedVehicle.make} {selectedVehicle.model} {selectedVehicle.year_of_manufacture ? `(${selectedVehicle.year_of_manufacture})` : ''}
                    </h2>
                    {renderStatusBadge(selectedVehicle.status)}
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {selectedVehicle.branch_name} Depot • {selectedVehicle.vehicle_type} • {selectedVehicle.ownership_type?.replace('_', ' ')}
                  </p>
                </div>
              </div>

              <button
                onClick={onClose}
                className="p-2.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-all"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Tab navigation bar */}
            <div className="flex items-center gap-1 px-6 border-b border-slate-800 bg-slate-950/40 text-xs font-semibold overflow-x-auto">
              <button
                onClick={() => setDetailTab('overview')}
                className={`py-3 px-4 border-b-2 transition-all flex items-center gap-2 ${
                  detailTab === 'overview'
                    ? 'border-blue-500 text-blue-400 font-bold'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <Layers className="w-4 h-4" />
                <span>Overview & Specs</span>
              </button>

              <button
                onClick={() => setDetailTab('fuel')}
                className={`py-3 px-4 border-b-2 transition-all flex items-center gap-2 ${
                  detailTab === 'fuel'
                    ? 'border-emerald-500 text-emerald-400 font-bold'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <Fuel className="w-4 h-4" />
                <span>Fuel Logs & Efficiency ({fuelLogs.length})</span>
              </button>

              <button
                onClick={() => setDetailTab('maintenance')}
                className={`py-3 px-4 border-b-2 transition-all flex items-center gap-2 ${
                  detailTab === 'maintenance'
                    ? 'border-amber-500 text-amber-400 font-bold'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <Wrench className="w-4 h-4" />
                <span>Maintenance & Repairs ({maintenanceRecords.length})</span>
              </button>

              <button
                onClick={() => setDetailTab('mileage')}
                className={`py-3 px-4 border-b-2 transition-all flex items-center gap-2 ${
                  detailTab === 'mileage'
                    ? 'border-sky-500 text-sky-400 font-bold'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <Gauge className="w-4 h-4" />
                <span>Mileage & Trips ({mileageLogs.length})</span>
              </button>
            </div>

            {/* Tab content area */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1">
              {/* TAB 1: OVERVIEW & SPECS */}
              {detailTab === 'overview' && (
                <div className="space-y-6">
                  {/* Telemetry Stat Cards */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="p-3.5 bg-slate-950/70 rounded-2xl border border-slate-800">
                      <span className="text-[11px] text-slate-400 uppercase tracking-wider block font-semibold">Total Distance</span>
                      <div className="text-xl font-black text-white mt-1">
                        {vehicleTelemetry?.total_distance_km ? `${Number(vehicleTelemetry.total_distance_km).toLocaleString()} km` : '0 km'}
                      </div>
                      <span className="text-[10px] text-slate-500">Logged since onboarding</span>
                    </div>

                    <div className="p-3.5 bg-slate-950/70 rounded-2xl border border-slate-800">
                      <span className="text-[11px] text-slate-400 uppercase tracking-wider block font-semibold">Fuel Spend</span>
                      <div className="text-xl font-black text-emerald-400 mt-1">
                        KES {vehicleTelemetry?.total_fuel_spend ? Number(vehicleTelemetry.total_fuel_spend).toLocaleString() : '0'}
                      </div>
                      <span className="text-[10px] text-slate-500">{vehicleTelemetry?.fuel_logs_count || 0} refuel entries</span>
                    </div>

                    <div className="p-3.5 bg-slate-950/70 rounded-2xl border border-slate-800">
                      <span className="text-[11px] text-slate-400 uppercase tracking-wider block font-semibold">Maintenance Spend</span>
                      <div className="text-xl font-black text-amber-400 mt-1">
                        KES {vehicleTelemetry?.total_maintenance_spend ? Number(vehicleTelemetry.total_maintenance_spend).toLocaleString() : '0'}
                      </div>
                      <span className="text-[10px] text-slate-500">{vehicleTelemetry?.maintenance_records_count || 0} service jobs</span>
                    </div>

                    <div className="p-3.5 bg-slate-950/70 rounded-2xl border border-slate-800">
                      <span className="text-[11px] text-slate-400 uppercase tracking-wider block font-semibold">Operating Cost / km</span>
                      <div className="text-xl font-black text-sky-400 mt-1">
                        KES {vehicleTelemetry?.operating_cost_per_km || '0.00'}
                      </div>
                      <span className="text-[10px] text-slate-500">Total cost per km traveled</span>
                    </div>
                  </div>

                  {/* Technical Specifications */}
                  <div className="bg-slate-950/50 rounded-2xl p-5 border border-slate-800">
                    <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                      <FileText className="w-4 h-4 text-blue-400" />
                      <span>Technical Registry Specifications</span>
                    </h3>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs">
                      <div>
                        <span className="text-slate-500 block">Registration Plate</span>
                        <span className="font-bold text-white font-mono">{selectedVehicle.registration_number}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block">Vehicle Type</span>
                        <span className="font-semibold text-slate-200">{selectedVehicle.vehicle_type}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block">Make & Model</span>
                        <span className="font-semibold text-slate-200">{selectedVehicle.make} {selectedVehicle.model}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block">Chassis / VIN</span>
                        <span className="font-mono text-slate-300">{selectedVehicle.chassis_number || 'N/A'}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block">Engine Number</span>
                        <span className="font-mono text-slate-300">{selectedVehicle.engine_number || 'N/A'}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block">Color</span>
                        <span className="font-semibold text-slate-200">{selectedVehicle.color || 'White'}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block">Payload Capacity</span>
                        <span className="font-semibold text-slate-200">{selectedVehicle.capacity_kg ? `${selectedVehicle.capacity_kg} kg` : 'N/A'}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block">Cargo Volume</span>
                        <span className="font-semibold text-slate-200">{selectedVehicle.cargo_volume_cbm ? `${selectedVehicle.cargo_volume_cbm} m³` : 'N/A'}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block">Fuel Tank Capacity</span>
                        <span className="font-semibold text-slate-200">{selectedVehicle.fuel_tank_capacity_liters ? `${selectedVehicle.fuel_tank_capacity_liters} Liters` : 'N/A'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Service Target Countdown Card */}
                  <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80 flex items-center justify-between">
                    <div>
                      <span className="text-xs text-blue-400 font-semibold uppercase tracking-wider block">Preventive Service Target</span>
                      <div className="text-lg font-bold text-white mt-0.5">
                        Next Target: {selectedVehicle.next_service_odometer_km ? `${Number(selectedVehicle.next_service_odometer_km).toLocaleString()} km` : 'Unset'}
                      </div>
                      <p className="text-xs text-slate-400">
                        {vehicleTelemetry?.km_until_service !== undefined ? (
                          vehicleTelemetry.km_until_service <= 0
                            ? 'Overdue for scheduled maintenance'
                            : `${vehicleTelemetry.km_until_service.toLocaleString()} km remaining before scheduled service`
                        ) : 'Pending schedule calculation'}
                      </p>
                    </div>

                    <button
                      onClick={() => onOpenMaintenance(selectedVehicle)}
                      className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs shadow-md transition-all flex items-center gap-1.5"
                    >
                      <Wrench className="w-3.5 h-3.5" />
                      <span>Schedule Service</span>
                    </button>
                  </div>
                </div>
              )}

              {/* TAB 2: FUEL LOGS & EFFICIENCY */}
              {detailTab === 'fuel' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-white">Fuel Consumption & Refill History</h3>
                      <p className="text-xs text-slate-400">Voucher numbers, station vendors, and calculated km/L efficiency</p>
                    </div>
                    <button
                      onClick={() => onOpenRefuel(selectedVehicle)}
                      className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all flex items-center gap-1.5"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Log Refuel</span>
                    </button>
                  </div>

                  {fuelLogs.length === 0 ? (
                    <div className="p-8 text-center text-slate-400 bg-slate-950/40 rounded-2xl border border-slate-800">
                      No fuel logs recorded yet for this vehicle.
                    </div>
                  ) : (
                    <div className="overflow-x-auto rounded-2xl border border-slate-800">
                      <table className="w-full text-left text-xs text-slate-300">
                        <thead className="bg-slate-950 text-slate-400 uppercase font-semibold border-b border-slate-800">
                          <tr>
                            <th className="p-3">Date</th>
                            <th className="p-3">Station</th>
                            <th className="p-3">Liters</th>
                            <th className="p-3">Price/L</th>
                            <th className="p-3">Total Cost</th>
                            <th className="p-3">Odometer</th>
                            <th className="p-3">Economy</th>
                            <th className="p-3">Voucher</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/60 bg-slate-900/40">
                          {fuelLogs.map((log) => (
                            <tr key={log.id} className="hover:bg-slate-800/40">
                              <td className="p-3 font-mono">{log.fuel_date}</td>
                              <td className="p-3 font-medium text-white">{log.gas_station_vendor || 'N/A'}</td>
                              <td className="p-3 font-mono">{log.quantity_liters} L</td>
                              <td className="p-3 font-mono">KES {log.cost_per_liter}</td>
                              <td className="p-3 font-bold text-emerald-400 font-mono">KES {Number(log.total_cost).toLocaleString()}</td>
                              <td className="p-3 font-mono">{Number(log.odometer_km).toLocaleString()} km</td>
                              <td className="p-3">
                                {log.calculated_consumption_kml ? (
                                  <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-bold font-mono text-[11px]">
                                    {log.calculated_consumption_kml} km/L
                                  </span>
                                ) : (
                                  <span className="text-slate-500 text-[10px]">
                                    {log.is_full_tank ? 'Base Full' : 'Partial'}
                                  </span>
                                )}
                              </td>
                              <td className="p-3 font-mono uppercase">{log.voucher_number || '-'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 3: MAINTENANCE & REPAIRS */}
              {detailTab === 'maintenance' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-white">Workshop & Preventative Maintenance Records</h3>
                      <p className="text-xs text-slate-400">Scheduled repairs, parts replaced, and labor expenses</p>
                    </div>
                    <button
                      onClick={() => onOpenMaintenance(selectedVehicle)}
                      className="px-3.5 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold transition-all flex items-center gap-1.5"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Log Service</span>
                    </button>
                  </div>

                  {maintenanceRecords.length === 0 ? (
                    <div className="p-8 text-center text-slate-400 bg-slate-950/40 rounded-2xl border border-slate-800">
                      No maintenance records recorded yet for this vehicle.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {maintenanceRecords.map((rec) => (
                        <div key={rec.id} className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-400 border border-amber-500/30 font-mono font-bold">
                                {rec.service_number}
                              </span>
                              <span className="font-bold text-white text-sm">{rec.service_type?.replace(/_/g, ' ')}</span>
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono ${
                                rec.status === 'COMPLETED' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-blue-500/20 text-blue-400 animate-pulse'
                              }`}>
                                {rec.status}
                              </span>
                            </div>
                            <p className="text-slate-400 mt-1">
                              Garage: <strong className="text-slate-200">{rec.service_provider}</strong> • Date: {rec.service_date} • Odometer: {Number(rec.service_odometer_km).toLocaleString()} km
                            </p>
                            {rec.parts_replaced && (
                              <p className="text-slate-500 mt-0.5">
                                Parts: {rec.parts_replaced}
                              </p>
                            )}
                          </div>

                          <div className="text-right">
                            <span className="text-slate-400 block text-[10px]">Total Service Cost</span>
                            <span className="text-base font-black text-amber-400 font-mono">
                              KES {Number(rec.total_cost).toLocaleString()}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 4: MILEAGE & TRIPS */}
              {detailTab === 'mileage' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-white">Trip Logs & Mileage History</h3>
                      <p className="text-xs text-slate-400">Routes, dispatch runs, and odometer progression</p>
                    </div>
                    <button
                      onClick={() => onOpenMileage(selectedVehicle)}
                      className="px-3.5 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold shadow-sm transition-all flex items-center gap-1.5"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Log Trip</span>
                    </button>
                  </div>

                  {mileageLogs.length === 0 ? (
                    <div className="p-8 text-center text-slate-400 bg-slate-950/40 rounded-2xl border border-slate-800">
                      No mileage logs recorded yet for this vehicle.
                    </div>
                  ) : (
                    <div className="overflow-x-auto rounded-2xl border border-slate-800">
                      <table className="w-full text-left text-xs text-slate-300">
                        <thead className="bg-slate-950 text-slate-400 uppercase font-semibold border-b border-slate-800">
                          <tr>
                            <th className="p-3">Date</th>
                            <th className="p-3">Type</th>
                            <th className="p-3">Start Odo</th>
                            <th className="p-3">End Odo</th>
                            <th className="p-3">Distance</th>
                            <th className="p-3">Route</th>
                            <th className="p-3">Driver</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/60 bg-slate-900/40">
                          {mileageLogs.map((log) => (
                            <tr key={log.id} className="hover:bg-slate-800/40">
                              <td className="p-3 font-mono">{log.log_date}</td>
                              <td className="p-3 font-semibold text-white">{log.trip_type?.replace(/_/g, ' ')}</td>
                              <td className="p-3 font-mono">{Number(log.start_odometer_km).toLocaleString()} km</td>
                              <td className="p-3 font-mono">{Number(log.end_odometer_km).toLocaleString()} km</td>
                              <td className="p-3 font-bold text-sky-400 font-mono">{log.distance_km} km</td>
                              <td className="p-3 text-slate-300">{log.origin || 'Depot'} → {log.destination || 'CBD'}</td>
                              <td className="p-3 text-slate-400">{log.driver_name || 'Assigned'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
  );
}
