import React from 'react';
import { Truck, CheckCircle2, Activity, Wrench, Gauge, Fuel } from 'lucide-react';

export function VehicleTelemetryCards({ telemetry, vehicles }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3 pt-3.5 border-t border-[#2a3447]">
      <div className="bg-slate-950/40 hover:bg-slate-950/60 rounded-xl p-3 sm:p-3.5 border border-[#2a3447] shadow-sm transition-all group">
        <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-wider">Total Fleet</span>
          <div className="w-7 h-7 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-600 dark:text-blue-400">
            <Truck className="w-3.5 h-3.5" />
          </div>
        </div>
        <div className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white font-mono">
          {telemetry?.total_vehicles ?? vehicles.length}
        </div>
        <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 truncate">
          {telemetry?.total_payload_capacity_kg ? `${telemetry.total_payload_capacity_kg.toLocaleString()} kg` : 'Payload capacity'}
        </div>
      </div>

      <div className="bg-slate-950/40 hover:bg-slate-950/60 rounded-xl p-3 sm:p-3.5 border border-[#2a3447] shadow-sm transition-all group">
        <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-wider">Available</span>
          <div className="w-7 h-7 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="w-3.5 h-3.5" />
          </div>
        </div>
        <div className="text-xl sm:text-2xl font-bold text-emerald-600 dark:text-emerald-400 font-mono">
          {telemetry?.available_vehicles ?? vehicles.filter(v => v.status === 'AVAILABLE').length}
        </div>
        <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">Ready for dispatch</div>
      </div>

      <div className="bg-slate-950/40 hover:bg-slate-950/60 rounded-xl p-3 sm:p-3.5 border border-[#2a3447] shadow-sm transition-all group">
        <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-wider">In Transit</span>
          <div className="w-7 h-7 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-600 dark:text-blue-400">
            <Activity className="w-3.5 h-3.5" />
          </div>
        </div>
        <div className="text-xl sm:text-2xl font-bold text-blue-600 dark:text-blue-400 font-mono">
          {telemetry?.in_transit_vehicles ?? vehicles.filter(v => v.status === 'IN_TRANSIT').length}
        </div>
        <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">Active on delivery runs</div>
      </div>

      <div className="bg-slate-950/40 hover:bg-slate-950/60 rounded-xl p-3 sm:p-3.5 border border-[#2a3447] shadow-sm transition-all group">
        <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-wider">Maintenance</span>
          <div className="w-7 h-7 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-600 dark:text-amber-400">
            <Wrench className="w-3.5 h-3.5" />
          </div>
        </div>
        <div className="text-xl sm:text-2xl font-bold text-amber-600 dark:text-amber-400 font-mono">
          {telemetry?.maintenance_vehicles ?? vehicles.filter(v => v.status === 'UNDER_MAINTENANCE').length}
        </div>
        <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">In workshop & repairs</div>
      </div>

      <div className="bg-slate-950/40 hover:bg-slate-950/60 rounded-xl p-3 sm:p-3.5 border border-[#2a3447] shadow-sm transition-all group">
        <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-wider">Total Odometer</span>
          <div className="w-7 h-7 rounded-lg bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-600 dark:text-sky-400">
            <Gauge className="w-3.5 h-3.5" />
          </div>
        </div>
        <div className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white font-mono truncate">
          {telemetry?.total_fleet_distance_km ? `${Number(telemetry.total_fleet_distance_km).toLocaleString()} km` : '0 km'}
        </div>
        <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">Fleet logged distance</div>
      </div>

      <div className="bg-slate-950/40 hover:bg-slate-950/60 rounded-xl p-3 sm:p-3.5 border border-[#2a3447] shadow-sm transition-all group">
        <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-wider">Fuel Spend</span>
          <div className="w-7 h-7 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
            <Fuel className="w-3.5 h-3.5" />
          </div>
        </div>
        <div className="text-xl sm:text-2xl font-bold text-emerald-600 dark:text-emerald-400 font-mono truncate">
          KES {telemetry?.monthly_fuel_spend ? Number(telemetry.monthly_fuel_spend).toLocaleString() : '0'}
        </div>
        <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 truncate">
          Avg {telemetry?.fleet_avg_consumption_kml || '8.5'} km/L
        </div>
      </div>
    </div>
  );
}
