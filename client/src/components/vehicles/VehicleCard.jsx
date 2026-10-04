import React from 'react';
import {
  MapPin, User, UserPlus, Calendar, Wrench, Fuel, Gauge, Eye,
  Activity, CheckCircle2, AlertTriangle, ShieldCheck,
  RefreshCw, ChevronRight
} from 'lucide-react';
import { sound } from '../../services/sound.js';
import { renderStatusBadge, renderVehicleTypeIcon } from './constants.jsx';

export function VehicleCard({
  veh,
  onOpenDetail,
  onOpenStatus,
  onOpenRefuel,
  onOpenMaintenance,
  onOpenMileage,
  onOpenAssignDriver
}) {
  const isDue = veh.is_service_due;
  const currentOdo = Number(veh.current_odometer_km) || 0;
  const nextOdo = Number(veh.next_service_odometer_km) || (currentOdo + 5000);

  return (
              <div
                key={veh.id}
                className="bg-slate-900/60 backdrop-blur-md rounded-2xl p-4 sm:p-5 border border-[#2a3447] hover:border-blue-500/50 transition-all shadow-sm flex flex-col justify-between group relative overflow-hidden"
              >
                {/* Top Badge Row */}
                <div>
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                    {/* Kenya Registration Plate Graphic */}
                    <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
                      <div className="px-2.5 py-1 bg-amber-400 text-black font-black tracking-widest text-xs sm:text-sm rounded-lg border-2 border-black shadow-sm font-mono flex items-center gap-1.5 shrink-0">
                        <span className="w-1.5 h-3 bg-black/40 rounded-xs" />
                        {veh.registration_number}
                      </div>
                      <div className="p-1.5 bg-slate-100 dark:bg-slate-800/80 rounded-lg text-slate-700 dark:text-slate-300 shrink-0 border border-slate-300 dark:border-[#2a3447]" title={veh.vehicle_type}>
                        {renderVehicleTypeIcon(veh.vehicle_type)}
                      </div>
                    </div>

                    {/* Operational Status */}
                    <div className="shrink-0 ml-auto sm:ml-0">
                      {renderStatusBadge(veh.status)}
                    </div>
                  </div>

                  {/* Make, Model, Year & Branch */}
                  <div className="mb-3.5">
                    <h3 className="text-base font-bold text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors truncate">
                      {veh.make || 'Toyota'} {veh.model || ''} {veh.year_of_manufacture ? `(${veh.year_of_manufacture})` : ''}
                    </h3>
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-600 dark:text-slate-400 mt-1">
                      <div className="flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                        <span>{veh.branch_name} Depot</span>
                      </div>
                      <span className="text-slate-400 dark:text-slate-600 hidden sm:inline">•</span>
                      <span className="capitalize">{veh.fuel_type?.toLowerCase() || 'diesel'}</span>
                      <span className="text-slate-400 dark:text-slate-600 hidden sm:inline">•</span>
                      <span className="capitalize">{veh.ownership_type?.replace(/_/g, ' ')?.toLowerCase()}</span>
                    </div>
                  </div>

                  {/* Specs & Capacity Grid */}
                  <div className="grid grid-cols-2 gap-2.5 p-3 bg-slate-50 dark:bg-slate-950/60 rounded-xl border border-slate-200 dark:border-[#2a3447] text-xs mb-3.5">
                    <div className="min-w-0">
                      <span className="text-slate-600 dark:text-slate-400 block text-[11px]">Payload Capacity</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200 block truncate">
                        {veh.capacity_kg ? `${Number(veh.capacity_kg).toLocaleString()} kg` : 'N/A'}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <span className="text-slate-600 dark:text-slate-400 block text-[11px]">Cargo Volume</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200 block truncate">
                        {veh.cargo_volume_cbm ? `${veh.cargo_volume_cbm} m³` : 'N/A'}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <span className="text-slate-600 dark:text-slate-400 block text-[11px]">Current Odometer</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1 truncate">
                        <Gauge className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400 shrink-0" />
                        <span className="truncate">{currentOdo.toLocaleString()} km</span>
                      </span>
                    </div>
                    <div className="min-w-0">
                      <span className="text-slate-600 dark:text-slate-400 block text-[11px]">Active Deliveries</span>
                      <span className="font-semibold text-blue-600 dark:text-blue-400 block truncate">
                        {veh.active_deliveries_count || 0} active runs
                      </span>
                    </div>
                  </div>

                  {/* Assigned Driver Chip */}
                  <div className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800/40 border border-slate-200 dark:border-[#2a3447] mb-3.5 text-xs min-w-0">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${
                        veh.driver_name
                          ? 'bg-blue-500/20 text-blue-600 dark:text-blue-400'
                          : 'bg-slate-500/20 text-slate-400'
                      }`}>
                        <User className="w-3.5 h-3.5" />
                      </div>
                      <div className="min-w-0">
                        <span className="text-[10px] text-slate-600 dark:text-slate-400 block leading-none">Designated Driver</span>
                        <span className="font-medium text-slate-800 dark:text-slate-200 block truncate">
                          {veh.driver_name ? veh.driver_name : 'No Driver Assigned'}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {veh.driver_phone && (
                        <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono hidden sm:inline">
                          {veh.driver_phone}
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          sound.playClick();
                          onOpenAssignDriver?.(veh);
                        }}
                        className={`px-2 py-1 rounded-lg text-[11px] font-semibold transition-all cursor-pointer flex items-center gap-1 ${
                          veh.driver_name
                            ? 'bg-blue-50 hover:bg-blue-100 dark:bg-blue-500/10 dark:hover:bg-blue-500/20 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-500/30'
                            : 'bg-blue-600 hover:bg-blue-500 text-white shadow-xs'
                        }`}
                        title={veh.driver_name ? 'Reassign or change designated driver' : 'Assign a driver to this vehicle'}
                      >
                        <UserPlus className="w-3 h-3" />
                        <span>{veh.driver_name ? 'Change' : 'Assign'}</span>
                      </button>
                    </div>
                  </div>

                  {/* Service Target Alert */}
                  {isDue && (
                    <div className="flex items-start gap-2 p-2.5 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-300 dark:border-amber-500/30 text-amber-800 dark:text-amber-400 text-xs mb-3.5">
                      <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                      <span className="font-medium leading-tight">
                        Service Due in {veh.km_until_service} km (Target: {nextOdo.toLocaleString()} km)
                      </span>
                    </div>
                  )}
                </div>

                {/* Card Actions Bento Footer */}
                <div className="pt-3 border-t border-slate-200 dark:border-[#2a3447] space-y-2">
                  {/* Row 1: Operational Logging Action Grid */}
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      onClick={() => {
                        sound.playClick();
                        onOpenRefuel(veh);
                      }}
                      className="py-1.5 px-2 rounded-lg bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-500/10 dark:hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-500/30 font-semibold transition-all flex items-center justify-center gap-1.5 text-xs cursor-pointer"
                      title="Log Fuel Receipt"
                    >
                      <Fuel className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">Refuel</span>
                    </button>

                    <button
                      onClick={() => {
                        sound.playClick();
                        onOpenMaintenance(veh);
                      }}
                      className="py-1.5 px-2 rounded-lg bg-amber-50 hover:bg-amber-100 dark:bg-amber-500/10 dark:hover:bg-amber-500/20 text-amber-800 dark:text-amber-400 border border-amber-300 dark:border-amber-500/30 font-semibold transition-all flex items-center justify-center gap-1.5 text-xs cursor-pointer"
                      title="Log / Schedule Maintenance"
                    >
                      <Wrench className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">Service</span>
                    </button>

                    <button
                      onClick={() => {
                        sound.playClick();
                        onOpenMileage(veh);
                      }}
                      className="py-1.5 px-2 rounded-lg bg-sky-50 hover:bg-sky-100 dark:bg-sky-500/10 dark:hover:bg-sky-500/20 text-sky-800 dark:text-sky-400 border border-sky-300 dark:border-sky-500/30 font-semibold transition-all flex items-center justify-center gap-1.5 text-xs cursor-pointer"
                      title="Log Trip Mileage"
                    >
                      <Gauge className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">Trip</span>
                    </button>
                  </div>

                  {/* Row 2: Status Quick-Change & Dossier Inspection */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        sound.playClick();
                        onOpenStatus(veh);
                      }}
                      className="py-1.5 px-2.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800/80 dark:hover:bg-slate-700/80 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-[#2a3447] transition-all flex items-center justify-center gap-1.5 text-xs font-semibold cursor-pointer shrink-0"
                      title="Change Operational Status"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Status</span>
                    </button>

                    <button
                      onClick={() => {
                        sound.playClick();
                        onOpenDetail(veh);
                      }}
                      className="flex-1 py-1.5 px-3 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold transition-all flex items-center justify-center gap-1.5 text-xs shadow-sm cursor-pointer"
                      title="Full Dossier & Telemetry"
                    >
                      <span>View Vehicle Dossier</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
  );
}
