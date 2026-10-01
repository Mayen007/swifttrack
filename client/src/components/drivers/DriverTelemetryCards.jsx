import React from 'react';
import { Activity, CheckCircle2, Clock, AlertTriangle, TrendingUp, Star } from 'lucide-react';

export function DriverTelemetryCards({ telemetry }) {
  return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Active on Road */}
        <div className="bg-[#12161f] p-3.5 rounded-xl border border-[#2a3447]">
          <div className="flex items-center justify-between text-blue-600 dark:text-blue-400 mb-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Active on Road</span>
            <Activity className="w-4 h-4" />
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">{telemetry?.on_delivery_drivers ?? 0}</div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">En route with parcels</p>
        </div>

        {/* Available in Yard */}
        <div className="bg-[#12161f] p-3.5 rounded-xl border border-[#2a3447]">
          <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400 mb-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Available Yard</span>
            <CheckCircle2 className="w-4 h-4" />
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">{telemetry?.available_drivers ?? 0}</div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Ready for dispatch</p>
        </div>

        {/* Off Duty / Leave */}
        <div className="bg-[#12161f] p-3.5 rounded-xl border border-[#2a3447]">
          <div className="flex items-center justify-between text-slate-600 dark:text-slate-400 mb-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Off-Duty / Leave</span>
            <Clock className="w-4 h-4" />
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">{telemetry?.off_duty_drivers ?? 0}</div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Rest or annual leave</p>
        </div>

        {/* Expiry Warnings */}
        <div className="bg-amber-50 dark:bg-[#12161f] p-3.5 rounded-xl border border-amber-300 dark:border-amber-500/30">
          <div className="flex items-center justify-between text-amber-600 dark:text-amber-400 mb-1">
            <span className="text-xs font-bold uppercase tracking-wider text-amber-800 dark:text-amber-400">Expiry Alert</span>
            <AlertTriangle className="w-4 h-4" />
          </div>
          <div className="text-2xl font-bold text-amber-800 dark:text-amber-400 tracking-tight">{telemetry?.expiring_licenses_count ?? 0}</div>
          <p className="text-xs text-amber-800 dark:text-amber-400/90 mt-0.5 font-medium">License expires &lt;30d</p>
        </div>

        {/* Fleet On-Time Rate */}
        <div className="bg-[#12161f] p-3.5 rounded-xl border border-[#2a3447]">
          <div className="flex items-center justify-between text-indigo-600 dark:text-indigo-400 mb-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">On-Time Rate</span>
            <TrendingUp className="w-4 h-4" />
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">{telemetry?.fleet_on_time_rate_pct ?? 0}%</div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Fleet delivery target</p>
        </div>

        {/* Avg Rating */}
        <div className="bg-[#12161f] p-3.5 rounded-xl border border-[#2a3447]">
          <div className="flex items-center justify-between text-amber-500 mb-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Fleet Rating</span>
            <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">{telemetry?.fleet_avg_rating ?? '5.0'} / 5</div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Customer satisfaction</p>
        </div>
      </div>
  );
}
