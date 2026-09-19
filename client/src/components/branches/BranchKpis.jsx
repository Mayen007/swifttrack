// client/src/components/branches/BranchKpis.jsx
import React from 'react';
import { Building2, Warehouse, Users, Package } from 'lucide-react';

export function BranchKpis({ kpis }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {/* Metric 1: Active Hubs */}
      <div className="bg-[#12161f] border border-[#222834] rounded p-3.5 flex flex-col justify-between">
        <div className="flex items-center justify-between text-slate-400">
          <span className="font-mono text-[10px] tracking-wider uppercase text-slate-400">
            OPERATIONAL HUBS
          </span>
          <Building2 className="w-4 h-4 text-blue-400" />
        </div>
        <div className="mt-2 flex items-baseline gap-2">
          <span className="font-mono text-2xl font-bold text-white tracking-tight tabular-nums">
            {kpis.activeHubs}
          </span>
          <span className="font-mono text-xs text-slate-400">/ {kpis.totalHubs} NODES</span>
        </div>
        <div className="mt-2 pt-2 border-t border-[#222834] flex items-center justify-between font-mono text-[10px]">
          <span className="text-emerald-400 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            {kpis.operationalRate}% OPERATIONAL
          </span>
          <span className="text-slate-500">PROVINCIAL</span>
        </div>
      </div>

      {/* Metric 2: Attached Warehouses */}
      <div className="bg-[#12161f] border border-[#222834] rounded p-3.5 flex flex-col justify-between">
        <div className="flex items-center justify-between text-slate-400">
          <span className="font-mono text-[10px] tracking-wider uppercase text-slate-400">
            DEPOT WAREHOUSES
          </span>
          <Warehouse className="w-4 h-4 text-emerald-400" />
        </div>
        <div className="mt-2 flex items-baseline gap-2">
          <span className="font-mono text-2xl font-bold text-white tracking-tight tabular-nums">
            {kpis.totalWarehouses}
          </span>
          <span className="font-mono text-xs text-slate-400">FACILITIES</span>
        </div>
        <div className="mt-2 pt-2 border-t border-[#222834] flex items-center justify-between font-mono text-[10px]">
          <span className="text-slate-400">STORAGE LOCATIONS</span>
          <span className="text-emerald-400 font-bold">100% ISOLATED</span>
        </div>
      </div>

      {/* Metric 3: Station Personnel */}
      <div className="bg-[#12161f] border border-[#222834] rounded p-3.5 flex flex-col justify-between">
        <div className="flex items-center justify-between text-slate-400">
          <span className="font-mono text-[10px] tracking-wider uppercase text-slate-400">
            STATION OPERATORS
          </span>
          <Users className="w-4 h-4 text-purple-400" />
        </div>
        <div className="mt-2 flex items-baseline gap-2">
          <span className="font-mono text-2xl font-bold text-white tracking-tight tabular-nums">
            {kpis.totalStaff}
          </span>
          <span className="font-mono text-xs text-slate-400">PERSONNEL</span>
        </div>
        <div className="mt-2 pt-2 border-t border-[#222834] flex items-center justify-between font-mono text-[10px]">
          <span className="text-slate-400">RBAC ASSIGNED</span>
          <span className="text-purple-400">ACTIVE ROSTER</span>
        </div>
      </div>

      {/* Metric 4: Aggregate Orders */}
      <div className="bg-[#12161f] border border-[#222834] rounded p-3.5 flex flex-col justify-between">
        <div className="flex items-center justify-between text-slate-400">
          <span className="font-mono text-[10px] tracking-wider uppercase text-slate-400">
            NETWORK CARGO
          </span>
          <Package className="w-4 h-4 text-amber-400" />
        </div>
        <div className="mt-2 flex items-baseline gap-2">
          <span className="font-mono text-2xl font-bold text-white tracking-tight tabular-nums">
            {kpis.totalOrders.toLocaleString()}
          </span>
          <span className="font-mono text-xs text-slate-400">ORDERS</span>
        </div>
        <div className="mt-2 pt-2 border-t border-[#222834] flex items-center justify-between font-mono text-[10px]">
          <span className="text-slate-400">LIFETIME VOLUME</span>
          <span className="text-amber-400 font-mono">THROUGHPUT</span>
        </div>
      </div>
    </div>
  );
}
