import React from 'react';
import { Search, X } from 'lucide-react';
import { sound } from '../../services/sound.js';

export function UserFilterBar({
  searchQuery,
  setSearchQuery,
  roleFilter,
  setRoleFilter,
  branchFilter,
  setBranchFilter,
  statusFilter,
  setStatusFilter,
  usersCount,
  kpis,
  isSuperAdmin,
  branches,
}) {
  return (
    <div className="bg-[#12161f] border border-[#222834] rounded p-3 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
      <div className="relative w-full lg:w-80">
        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Filter staff by name, @username, email, phone, hub..."
          className="w-full bg-[#181d28] border border-[#222834] rounded pl-9 pr-8 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 font-mono"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto justify-between lg:justify-end">
        <div className="flex items-center gap-1.5 flex-1 sm:flex-none">
          <span className="text-[10px] font-mono text-slate-400 uppercase hidden sm:inline">
            ROLE:
          </span>
          <select
            value={roleFilter}
            onChange={(e) => {
              sound.playScan();
              setRoleFilter(e.target.value);
            }}
            className="w-full sm:w-auto bg-[#181d28] border border-[#222834] rounded px-2.5 py-1 text-xs font-mono text-slate-200 focus:outline-none focus:border-blue-500 cursor-pointer"
          >
            <option value="ALL">ALL ROLES ({usersCount})</option>
            <option value="SUPER_ADMIN">SUPER_ADMIN ({kpis.roleCounts['SUPER_ADMIN'] || 0})</option>
            <option value="BRANCH_MANAGER">BRANCH_MANAGER ({kpis.roleCounts['BRANCH_MANAGER'] || 0})</option>
            <option value="DISPATCHER">DISPATCHER ({kpis.roleCounts['DISPATCHER'] || 0})</option>
            <option value="CASHIER">CASHIER ({kpis.roleCounts['CASHIER'] || 0})</option>
            <option value="DRIVER">DRIVER ({kpis.roleCounts['DRIVER'] || 0})</option>
          </select>
        </div>

        {isSuperAdmin && (
          <div className="flex items-center gap-1.5 flex-1 sm:flex-none">
            <span className="text-[10px] font-mono text-slate-400 uppercase hidden sm:inline">
              HUB:
            </span>
            <select
              value={branchFilter}
              onChange={(e) => {
                sound.playScan();
                setBranchFilter(e.target.value);
              }}
              className="w-full sm:w-auto bg-[#181d28] border border-[#222834] rounded px-2.5 py-1 text-xs font-mono text-slate-200 focus:outline-none focus:border-blue-500 cursor-pointer"
            >
              <option value="ALL">ALL REGIONS</option>
              <option value="GLOBAL">HQ GLOBAL (NO BRANCH)</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.code} - {b.name}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="flex items-center bg-[#181d28] border border-[#222834] rounded p-0.5 text-[11px] font-mono">
          <button
            onClick={() => {
              sound.playScan();
              setStatusFilter('ALL');
            }}
            className={`px-2 py-0.5 rounded transition-colors ${
              statusFilter === 'ALL'
                ? 'bg-blue-600 text-white font-bold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            ALL
          </button>
          <button
            onClick={() => {
              sound.playScan();
              setStatusFilter('ACTIVE');
            }}
            className={`px-2 py-0.5 rounded transition-colors ${
              statusFilter === 'ACTIVE'
                ? 'bg-emerald-600 text-white font-bold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            ACTIVE
          </button>
          {kpis.suspendedStaff > 0 && (
            <button
              onClick={() => {
                sound.playScan();
                setStatusFilter('SUSPENDED');
              }}
              className={`px-2 py-0.5 rounded transition-colors ${
                statusFilter === 'SUSPENDED'
                  ? 'bg-rose-600 text-white font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              SUSPENDED
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
