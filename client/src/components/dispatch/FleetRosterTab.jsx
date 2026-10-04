import React from 'react';
import { Users, Phone } from 'lucide-react';

export function FleetRosterTab({
  drivers,
  onViewAssignedPipeline
}) {
  const availableCount = drivers.filter((d) => d.status === 'AVAILABLE').length;

  return (
    <div className="bg-[#12161f] border border-[#222834] rounded p-5 space-y-4">
      <div className="flex items-center justify-between border-b border-[#222834] pb-3">
        <div>
          <h2 className="text-xs font-bold text-slate-100 uppercase tracking-wider font-mono flex items-center gap-2">
            <Users className="w-4 h-4 text-amber-400" />
            Active Fleet Couriers & Workload Roster
          </h2>
          <p className="text-[11px] text-slate-400 mt-0.5 font-mono">
            Real-time driver availability, active drops load, and assigned dispatch vehicles
          </p>
        </div>
        <span className="text-xs font-mono text-slate-400">
          {availableCount} Available / {drivers.length} Registered
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {drivers.map((drv) => {
          const activeCount = drv.active_deliveries_count ?? 0;
          const isAvail = drv.status === 'AVAILABLE';

          return (
            <div
              key={drv.id}
              className="bg-[#0c0e12] border border-[#222834] hover:border-slate-700 rounded p-3.5 space-y-3 transition-colors"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded bg-[#181d28] border border-[#222834] text-slate-300 font-mono font-bold text-xs flex items-center justify-center">
                    {drv.full_name?.substring(0, 2).toUpperCase() || 'DR'}
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-100">{drv.full_name}</h4>
                    <span className="text-[10px] text-slate-400 font-mono">{drv.phone || '—'}</span>
                  </div>
                </div>

                <span
                  className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded border uppercase flex items-center gap-1 ${
                    isAvail
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                      : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${isAvail ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse'}`} />
                  {drv.status || 'AVAILABLE'}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[11px] font-mono border-y border-[#222834] py-2">
                <div>
                  <span className="text-slate-500 text-[10px] block">VEHICLE ASSIGNMENT</span>
                  <span className="text-slate-200 truncate font-semibold">
                    {drv.registration_number || drv.vehicle_type || 'Boda Boda'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 text-[10px] block">ACTIVE MANIFESTS</span>
                  <span className={`font-bold tabular-nums ${activeCount > 0 ? 'text-amber-400' : 'text-slate-400'}`}>
                    {activeCount} active drop{activeCount !== 1 ? 's' : ''}
                  </span>
                </div>
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => onViewAssignedPipeline(drv.id)}
                  className="flex-1 py-1.5 rounded bg-[#181d28] hover:bg-[#222834] text-slate-300 text-[11px] font-mono font-semibold border border-[#222834] transition-colors cursor-pointer"
                >
                  View Assigned Pipeline
                </button>
                {drv.phone && (
                  <a
                    href={`tel:${drv.phone}`}
                    className="p-1.5 rounded bg-[#181d28] hover:bg-emerald-600/20 text-slate-400 hover:text-emerald-300 border border-[#222834] transition-colors"
                    title="Call courier directly"
                  >
                    <Phone className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
