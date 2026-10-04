import React from 'react';
import { Activity, CheckCircle2, Clock, AlertTriangle, TrendingUp, Star } from 'lucide-react';

export function DriverTelemetryCards({ telemetry }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-2.5">
      {/* Active on Road */}
      <div className="bg-[#12161f] px-3 py-2 rounded-xl border border-[#222834] hover:border-slate-700 transition-colors">
        <div className="flex items-center justify-between text-blue-400">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">On Road</span>
          <Activity className="w-3.5 h-3.5" />
        </div>
        <div className="flex items-baseline justify-between mt-0.5">
          <span className="text-xl font-bold text-white tracking-tight tabular-nums">
            {telemetry?.on_delivery_drivers ?? 0}
          </span>
          <span className="text-[10px] font-medium text-blue-400/80">Active</span>
        </div>
      </div>

      {/* Available in Yard */}
      <div className="bg-[#12161f] px-3 py-2 rounded-xl border border-[#222834] hover:border-slate-700 transition-colors">
        <div className="flex items-center justify-between text-emerald-400">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">In Yard</span>
          <CheckCircle2 className="w-3.5 h-3.5" />
        </div>
        <div className="flex items-baseline justify-between mt-0.5">
          <span className="text-xl font-bold text-emerald-400 tracking-tight tabular-nums">
            {telemetry?.available_drivers ?? 0}
          </span>
          <span className="text-[10px] font-medium text-emerald-500/80">Ready</span>
        </div>
      </div>

      {/* Off Duty / Leave */}
      <div className="bg-[#12161f] px-3 py-2 rounded-xl border border-[#222834] hover:border-slate-700 transition-colors">
        <div className="flex items-center justify-between text-slate-400">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Off-Duty</span>
          <Clock className="w-3.5 h-3.5" />
        </div>
        <div className="flex items-baseline justify-between mt-0.5">
          <span className="text-xl font-bold text-slate-300 tracking-tight tabular-nums">
            {telemetry?.off_duty_drivers ?? 0}
          </span>
          <span className="text-[10px] font-medium text-slate-500">Rest/Leave</span>
        </div>
      </div>

      {/* Expiry Warnings */}
      <div className="bg-[#12161f] px-3 py-2 rounded-xl border border-amber-500/30 hover:border-amber-500/50 transition-colors">
        <div className="flex items-center justify-between text-amber-400">
          <span className="text-[10px] font-bold uppercase tracking-wider text-amber-300/90">DL Expiry</span>
          <AlertTriangle className="w-3.5 h-3.5" />
        </div>
        <div className="flex items-baseline justify-between mt-0.5">
          <span className="text-xl font-bold text-amber-400 tracking-tight tabular-nums">
            {telemetry?.expiring_licenses_count ?? 0}
          </span>
          <span className="text-[10px] font-medium text-amber-400/80">&lt;30d notice</span>
        </div>
      </div>

      {/* Fleet On-Time Rate */}
      <div className="bg-[#12161f] px-3 py-2 rounded-xl border border-[#222834] hover:border-slate-700 transition-colors">
        <div className="flex items-center justify-between text-indigo-400">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">On-Time</span>
          <TrendingUp className="w-3.5 h-3.5" />
        </div>
        <div className="flex items-baseline justify-between mt-0.5">
          <span className="text-xl font-bold text-white tracking-tight tabular-nums">
            {telemetry?.fleet_on_time_rate_pct ?? 0}%
          </span>
          <span className="text-[10px] font-medium text-indigo-400/80">Fleet target</span>
        </div>
      </div>

      {/* Avg Rating */}
      <div className="bg-[#12161f] px-3 py-2 rounded-xl border border-[#222834] hover:border-slate-700 transition-colors">
        <div className="flex items-center justify-between text-amber-400">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Avg Rating</span>
          <Star className="w-3.5 h-3.5 fill-amber-400" />
        </div>
        <div className="flex items-baseline justify-between mt-0.5">
          <span className="text-xl font-bold text-white tracking-tight tabular-nums">
            {telemetry?.fleet_avg_rating ?? '5.0'}
          </span>
          <span className="text-[10px] font-medium text-amber-400/80">/ 5.0 rating</span>
        </div>
      </div>
    </div>
  );
}
